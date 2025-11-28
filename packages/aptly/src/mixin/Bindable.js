import { Destroyable, Scheduler, Signal, capitalize, panik, chain, applyTo } from '@appiphany/aptly';
import { Hierarchical } from '@appiphany/aptly/mixin';

const
    getProto = o => o ? Object.getPrototypeOf(o) : null,
    getParentProps = p => getProto(p?.props),
    createProps = p => Object.create(Object.create(getParentProps(p)));


class Bindings extends Destroyable {
    #handler;
    #owner;
    #watcher;

    #map = chain();
    // = {
    //      config: Signal.formula + {
    //          prop: 'foo',
    //          flow: true,
    //          update: v => { ... }
    //      }
    //  }

    constructor (owner) {
        super();

        let me = this;

        me.#handler = () => me.#onChange();
        me.#owner = owner;
        me.#watcher = Signal.watch(() => me.#onNotify());

        me.priority = 0;
    }

    destruct () {
        this.#watcher.unwatch();

        super.destruct();
    }

    get map () {
        return this.#map;
    }

    add (configName, prop, was) {
        let owner = this.#owner,
            { props } = owner,
            flow, sig, specialFlow;

        if (typeof prop === 'function') {
            if (was?.calc === prop) {
                return null;
            }

            sig = Signal.formula(() => prop.call(owner, props), { name: `bind:${configName}` });

            sig.calc = prop;
        }
        else {
            // config: 'prop'   one-way (prop sets config)
            // config: '~prop'  two-way
            // config: '>prop'  one-way (config sets prop)
            flow = prop[0];
            flow = (specialFlow = flow === '~' || flow === '>') ? flow : '<';
            prop = specialFlow ? prop.slice(1) : prop;

            if (was && was.name === prop && was.flow === flow) {
                return null;
            }

            sig = Signal.formula(() => props[prop], { name: prop });

            sig.flow = flow;
            sig.update = flow !== '<' && (v => props[prop] = v);
        }

        sig.configName = configName;

        if (sig.flow === '>') {
            sig.update(owner[configName]);
        }
        else {
            owner[configName] = sig.get();
        }

        return sig;
    }

    update (bind) {
        let bindings = this.#map,
            watcher = this.#watcher,
            add, configName, remove;

        for (configName in bind) {
            let prop = bind[configName], // in for-loop to avoid stale closure
                was = bindings[configName],
                sig;

            if (prop) {
                sig = this.add(configName, prop, was);

                if (!sig) {
                    continue;
                }

                bindings[configName] = sig;
                sig && (add ??= []).push(sig);
            }

            if (was) {
                delete bindings[configName];
                (remove ??= []).push(was);
            }
        }

        add && watcher.watch(...add);
        remove && watcher.unwatch(...remove);

    }

    #onChange () {
        let me = this,
            owner = me.#owner,
            watcher = me.#watcher,
            changes, sig;

        if (!owner.destroyed) {
            for (sig of watcher.getPending()) {
                (changes ??= {})[sig.configName] = sig.get();
            }

            changes && owner.configure(changes);

            watcher.watch();
        }
    }

    #onNotify () {
        if (!this.#owner.destroyed) {
            this.#owner.scheduler?.add(this.#handler, this.priority);
        }
    }
}


class Effects extends Destroyable {
    static idSeed = 0;

    #effects = chain();
    #handler;
    #owner;
    #priority;
    #watcher;

    constructor (owner, options) {
        super();

        let me = this;

        me.#owner = owner;
        me.#handler = me.#onRun.bind(me);
        me.#priority = options?.priority ?? 0;
        me.#watcher = Signal.watch(() => me.#onNotify());
    }

    destruct () {
        Object.values(this.#effects).forEach(un => un());

        this.#watcher.unwatch();

        super.destruct();
    }

    add (name, fn) {
        let me = this,
            effects = me.#effects,
            owner = me.#owner,
            watcher = me.#watcher,
            cleanup, signal, un;

        signal = Signal.formula(() => {
            cleanup?.();
            cleanup = !owner.destroyed && fn.call(owner);
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

    addMany (effects) {
        let uns = [],
            fn;

        for (let key in effects) {
            fn = effects[key];

            if (typeof fn === 'function') {
                uns.push(this.add(key, fn));
            }
            else if (fn == null) {
                this.remove(key);
            }
        }

        return () => uns.forEach(un => un());
    }

    remove (name) {
        this.#effects[name]?.();
    }

    #onNotify () {
        if (!this.#owner.destroyed) {
            this.#owner.scheduler?.add(this.#handler, this.#priority);
        }
    }

    #onRun () {
        if (!this.#owner.destroyed) {
            let watcher = this.#watcher,
                effect;

            for (effect of watcher.getPending()) {
                effect.get(); // run the effect fns
            }

            watcher.watch();
        }
    }
}

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
        $statefulWatcher: null,
        $onStatefulPropSync: null,

        _bindings: null,
        _signals: null
    };

    static configurable = {
        parent: class {
            update (me, parent, was) {
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

            update (me, bind, was) {
                me.getConfig('$props');

                bind = applyTo(chain(), bind);

                if (was) {
                    for (let name in was) {
                        if (!(name in bind)) {
                            bind[name] = null;
                        }
                    }
                }

                me.bindings.update(bind);
            }
        },

        effects: class {
            value = null;
            phase = 'init';

            apply (instance, effects, was) {
                if (effects) {
                    was ??= new Effects(instance, effects);

                    was.addMany(effects);
                }

                return was;
            }
        },

        $props: class {
            value = {};

            apply (me, props, was) {
                if (was) {
                    panik('$props cannot be reconfigured');
                }

                let ret = me.getConfig('props');

                me.defineProps(props, true);

                return ret;
            }

            declProp (proto, name, readonly) {
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

            extend (cls, props) {
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

            apply (me, props, was) {
                if (was) {
                    panik('props cannot be reconfigured');
                }

                me._props = createProps(me.parent);

                me.defineProps(props);
            }
        }
    };

    destruct () {
        this._bindings?.destroy();
        this.effects?.destroy();
        this.$statefulWatcher?.unwatch()

        super.destruct();
    }


    get bindings () {
        return this._bindings ??= new Bindings(this);
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

    onConfigChange (name, value, was) {
        let sig = this._bindings?.map[name];

        sig?.update?.(value);

        super.onConfigChange(name, value, was);
    }

    //----------------------------------------------------------------------------------------
    // props / $props support

    defineProps (add, internal) {
        let me = this,
            signals = me._signals ??= chain(),
            props = me.props,  // internal props
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
                sig = formula ? Signal.formula(sig.bind(me, props), options) : Signal.value(sig, options);
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

                existing?.invalidate();
            }
        }

        if (internal && add.sealed !== false) {
            Object.seal(props);
        }
    }

    //----------------------------------------------------------------------------------------
    // Effects

    addEffect (options) {
        let me = this,
            { effects } = me,
            t = typeof options,
            fn, name;

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

        name = name || `effect-${++Effects.idSeed}`;

        if (!effects) {
            me.effects = {};      // create the Effects instance
            effects = me.effects; // get the new Effects instance
        }

        return effects.add(name, fn);
    }

    removeEffect (name) {
        this.effects?.remove(name);
    }

    //----------------------------------------------------------------------------------------
    // Stateful support

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
