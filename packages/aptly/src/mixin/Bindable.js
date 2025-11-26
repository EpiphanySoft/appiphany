import { Scheduler, Signal, capitalize, panik } from '@appiphany/aptly';
import { Hierarchical, Stateful } from '@appiphany/aptly/mixin';

const
    getProto = o => o ? Object.getPrototypeOf(o) : null,
    getParentProps = p => getProto(p?.props),
    createProps = p => Object.create(Object.create(getParentProps(p)));

let nextEffectId = 0;

/**
 * This mixin adds the ability to define props on a class. Props exist as both published
 * and internal. Props (both internal and published) and are accessed via the `props`
 * property.
 *
 * Internal props are only available to the instance that declared them.
 *
 * Published props are also available to child instances (connected via their `parent`
 * config).
 *
 * Internally, props are defined using a prototype chain. The following diagram shows how
 * this is implemented:
 *
 *           ╔══════════════╗                      ┌───────────────┐
 *           ║              ║                      │   published   │
 *           ║  instance1   ║    props             │     props     │
 *           ║              ╟─────┐                └──△──────△─────┘
 *           ╚═══════▲══════╝     │                   :      :
 *                   │            │         __proto__ :      :
 *                   │            │                   :      :
 *                   │            │      ┌────────────┴─┐    :
 *                   │            └──────▶   internal   │    :
 *                   │                   │    props     │    :
 *                   │ parent            └──────────────┘    :
 *                   │                                       : __proto__
 *                   │                                       :
 *           ╔═══════╧══════╗                        ┌───────┴───────┐
 *           ║              ║                        │   published   │
 *           ║  instance2   ║    props               │     props     │
 *           ║              ╟─────────┐              └───△───────────┘
 *           ╚══════════════╝         │                  :
 *                                    │        __proto__ :
 *                                    │                  :
 *                                    │     ┌────────────┴─┐
 *                                    └─────▶   internal   │
 *                                          │    props     │
 *                                          └──────────────┘
 *
 * Even though props are defined using a prototype chain, they behave like a scope chain.
 * This means that settings a prop declared on a parent instance using a child instance's
 * props will affect the parent instance (and all its children).
 *
 * A child instance can hide a parent instance's prop by defining its own prop by the same
 * name. Similar to how an assignment is different than a `let` declaration in a nested
 * scope.
 *
 * By default, props are sealed. This means that they cannot be extended to add new props
 * dynamically. To disable this, set the `sealed` property to false on the `props` config.
 */
export const Bindable = Base => class Bindable extends Base.mixin(Hierarchical) {
    static className= 'Bindable';

    static proto = {
        $bindWatcher: null,
        $effectWatcher: null,
        $statefulWatcher: null,
        $onBindPropSync: null,
        $onEffectHandler: null,
        $onStatefulPropSync: null,
        _signals: null
    };

    static configurable = {
        parent: class {
            update(me, parent, was) {
                super.update(me, parent, was);

                let props = me._props;

                if (props) {
                    Object.setPrototypeOf(getProto(props), getParentProps(parent));

                    let signals = me._signals;

                    if (signals) {
                        for (let name in signals) {
                            signals[name].invalidate();
                        }
                    }
                }
            }
        },

        bind: class {
            value = null;

            apply(me, bind, was) {
                let full = Object.create(null),
                    name;

                if (bind) {
                    for (name in bind) {
                        full[name] = bind[name];
                    }
                }

                if (was) {
                    for (name in was) {
                        if (!(name in full)) {
                            full[name] = null;
                        }
                    }
                }

                me.getConfig('$props');
                me.bindProps(full);

                // do not return anything... $bindings is populated by propsAdd
            }
        },

        $props: class {
            value = {};

            apply(me, props, was) {
                if (was) {
                    panik('$props cannot be reconfigured');
                }

                let ret = me.getConfig('props');

                me.defineProps(props, true);

                return ret;
            }

            declProp(proto, name, readonly) {
                let desc = {
                    configurable: true,

                    get () {
                        return this.$props[name];
                    },

                    set (v) {
                        this.$props[name] = v;

                        if (this.initialized !== false && !this.onConfigChange?.$nop) {
                            this.onConfigChange?.(name);
                        }
                    }
                };

                if (readonly) {
                    delete desc.set;
                }

                Object.defineProperty(proto, name, desc);
            }

            extend(cls, props) {
                if (props) {
                    let meta = cls.$meta,
                        { configs, expando } = meta,
                        proto = cls.prototype,
                        key;

                   for (key in props) {
                       if (!configs[key]) {
                           expando[key] = true;
                           this.declProp(proto, key, typeof props[key] === 'function');
                       }
                   }
                }
            }
        },

        props: class {
            value = {};

            apply(me, props, was) {
                if (was) {
                    panik('props cannot be reconfigured');
                }

                me._props = createProps(me.parent);

                me.defineProps(props);
            }
        }
    };

    destruct () {
        let me = this,
            effects = me._effects;

        me.$bindWatcher?.unwatch();
        me.$effectWatcher?.unwatch();
        me.$statefulWatcher?.unwatch()

        effects && Object.values(effects).forEach(un => un());

        super.destruct();
    }

    get published () {
        return getProto(this.props);
    }

    get scheduler () {
        return this.published.$scheduler ?? Scheduler.instance;
    }

    set scheduler (v) {
        let pub = this.published;

        if (v) {
            pub.$scheduler = v;
        }
        else {
            delete pub.$scheduler;
        }
    }

    _onBindPropSync () {
        let me = this,
            changes, sig;

        if (!me.destroyed) {
            for (sig of this.$bindWatcher.getPending()) {
                (changes ??= {})[sig.configName] = sig.get();
            }

            changes && this.configure(changes);

            this.$bindWatcher.watch();
        }
    }

    _onBindWatcherNotify () {
        if (!this.destroyed) {
            this.scheduler?.add(this.$onBindPropSync ??= () => this._onBindPropSync());
        }
    }

    bindProps (bind) {
        if (!bind) {
            return;
        }

        let bindings = this.$bindings ??= Object.create(null),
            // = {
            //      config: Signal.formula + {
            //          prop: 'foo',
            //          twoWay: true,
            //          update: v => { ... }
            //      }
            //  }
            props = this.props,
            watcher = this.$bindWatcher ??= Signal.watch(() => this._onBindWatcherNotify()),
            add, configName, remove;

        for (configName in bind) {
            // config: 'prop'   one-way
            // config: '~prop'  two-way
            let prop = bind[configName], // in for-loop to avoid stale closure
                was = bindings[configName],
                sig, twoWay;

            if (prop) {
                if (typeof prop === 'function') {
                    if (was?.calc === prop) {
                        continue;
                    }

                    sig = Signal.formula(() => prop.call(props), { name: `calc${capitalize(configName)}` });

                    sig.calc = prop;
                }
                else {
                    twoWay = prop[0] === '~';
                    prop = twoWay ? prop.slice(1) : prop;

                    if (was && was.name === prop && was.twoWay === twoWay) {
                        continue;
                    }

                    sig = Signal.formula(() => props[prop], { name: prop });

                    sig.twoWay = twoWay;
                    sig.update = twoWay && (v => props[prop] = v);
                }

                sig.configName = configName;

                (add ??= []).push(sig);

                bindings[configName] = sig;
                this[configName] = sig.get();
            }

            if (was) {
                delete bindings[configName];
                (remove ??= []).push(was);
            }
        }

        add && watcher.watch(...add);
        remove && watcher.unwatch(...remove);
    }

    defineProps (add, internal) {
        let signals = this._signals ??= Object.create(null),
            props = this.props,  // internal props
            target = internal ? props : getProto(props),
            options = {};

        if (!add) {
            return;
        }

        for (const name in add) {
            if (name !== 'sealed') {
                let existing = signals[name],
                    sig = add[name],  // <<< needs to be declared here to avoid a stale closure
                    formula = typeof sig === 'function',
                    property = {
                        configurable: true,

                        get () {
                            return sig.get();
                        },

                        set (v) {
                            sig.set(v);
                        }
                    };

                options.name = name;
                sig = formula ? Signal.formula(sig.bind(props), options) : Signal.value(sig, options);
                signals[name] = sig;
                sig.internal = internal;

                if (formula) {
                    delete property.set;
                }

                if (existing) {
                    if (existing.internal) {
                        delete props[name];
                    }
                    else {
                        delete target[name];
                    }
                }

                Object.defineProperty(target, name, property)

                if (existing) {
                    existing.invalidate();
                }
            }
        }

        if (internal && add.sealed !== false) {
            Object.seal(props);
        }
    }

    _onEffectHandler () {
        if (!this.destroyed) {
            let watcher = this.$effectWatcher,
                effect;

            for (effect of watcher.getPending()) {
                effect.get(); // run the effect fns
            }

            watcher.watch();
        }
    }

    _onEffectHandlerNotify () {
        if (!this.destroyed) {
            this.scheduler?.add(this.$onEffectHandler ??= () => this._onEffectHandler());
        }
    }

    effect (options) {
        let me = this,
            effects = me._effects ??= {},
            watcher = me.$effectWatcher ??= Signal.watch(() => me._onEffectHandlerNotify()),
            t = typeof options,
            cleanup, fn, name, signal, un;

        if (t === 'function') {
            fn = options;
            name = fn.name;
        }
        else if (t === 'string') {
            name = options;
            fn = (...args) => me[name](...args);
        }
        else if (options && t === 'object') {
            fn = options.fn;
            name = options.name || fn.name;
        }
        else {
            panik('invalid effect options');
        }

        name = name || `effect-${++nextEffectId}`;

        signal = Signal.formula(() => {
            cleanup?.();
            cleanup = fn.call(me);
        }, { name });

        un = () => {
            cleanup?.();
            delete effects[name];
            watcher.unwatch(signal);
        };

        un.signal = signal;

        effects[name]?.();
        effects[name] = un;

        watcher.watch(signal);
        signal.get();

        return un;
    }

    effects (effects) {
        let uns = [];

        for (let key in effects) {
            uns.push(this.effect(effects[key]));
        }

        return () => uns.forEach(un => un());
    }

    uneffect (name) {
        this._effects?.[name]?.();
    }

    _onStatefulPropChange () {
        if (!this.destroyed) {
            this.$statefulWatcher.watch();
            this.stateDirty = true;
        }
    }

    _onStatefulWatcherNotify () {
        if (!this.destroyed) {
            this.scheduler?.add(this.$onStatefulPropSync ??= () => this._onStatefulPropChange());
        }
    }

    loadStatefulProps (state) {
        let me = this,
            name, props, $props, sig, signals, value;

        me.getConfig('$props');
        signals = me._signals;

        for (name in state) {
            sig = signals[name];

            if (sig) {
                value = state[name];
                delete state[name];

                if (sig.internal) {
                    ($props ??= me.$props)[name] = value;
                }
                else {
                    (props ??= me.props)[name] = value;
                }
            }
        }
    }

    watchStatefulProps (stateful) {
        let me = this,
            watcher = me.$statefulWatcher ??= Signal.watch(() => me._onStatefulWatcherNotify()),
            add, name, sig, signals;

        if (stateful) {
            me.getConfig('$props');
            signals = me._signals;

            for (name in stateful) {
                sig = signals[name];
                sig && (add ??= []).push(sig);
            }
        }

        watcher.unwatch();

        add && watcher.watch(...add);
    }
}
