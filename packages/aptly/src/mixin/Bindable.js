import { Destroyable, Scheduler, Signal, panik, chain, applyTo, isClass } from '@appiphany/aptly';
import { Hierarchical } from '@appiphany/aptly/mixin';

const
    getParentProps = parent => parent?.props || null,
    createProps = parent => Object.create(getParentProps(parent));


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

            if (flow !== '<') {
                sig.configWatch = owner.watchConfigs((_, v) => props[prop] = v, { [configName]: 1 });
            }
            // sig.update = flow !== '<' && (v => props[prop] = v);
        }

        sig.configName = configName;

        if (sig.flow === '>') {
            props[prop] = owner[configName];
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

        me.#handler = () => me.#onRun();
        me.#owner = owner;
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
            cleanup = fn.call(owner, owner.props);
        }, { name });

        un = () => {
            cleanup?.();
            cleanup = null;
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
 * This mixin adds the ability to define props on a class, accessed via the `props`
 * property.
 *
 * Props are also available to child instances (connected via their `parent` config).
 *
 * Internally, props are defined using a prototype chain. The following diagram shows how
 * this is implemented:
 *
 *           ╔══════════════╗
 *           ║              ║
 *           ║  instance1   ║    props
 *           ║              ╟─────┐
 *           ╚═══════▲══════╝     │
 *                   │            │      ┌──────────────┐
 *                   │            │      │              │
 *                   │            └──────▶    props     │
 *                   │                   │              │
 *                   │ parent            └──────△───────┘
 *                   │                          :
 *                   │                          :
 *           ╔═══════╧══════╗                   :
 *           ║              ║                   :
 *           ║  instance2   ║    props          :
 *           ║              ╟─────────┐         : __proto__
 *           ╚══════════════╝         │         :
 *                                    │     ┌───┴──────────┐
 *                                    │     │              │
 *                                    └─────▶    props     │
 *                                          │              │
 *                                          └──────────────┘
 *
 * Even though props are defined using a prototype chain, they behave like a scope chain.
 * This means that setting a prop declared on a parent instance using a child instance's
 * `props` will affect the parent instance (and all its children).
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
            update (instance, parent, was) {
                super.update(instance, parent, was);

                let { props } = instance.$config,
                    signals;

                if (props) {
                    Object.setPrototypeOf(props, getParentProps(parent));

                    signals = instance._signals;

                    if (signals) {
                        for (let name in signals) {
                            signals[name].invalidate();
                        }
                    }
                }
            }
        },

        bind: class {
            update (instance, bind, was) {
                instance.getConfig('props');

                bind = applyTo(chain(), bind);

                if (was) {
                    for (let name in was) {
                        if (!(name in bind)) {
                            bind[name] = null;
                        }
                    }
                }

                instance.bindings.update(bind);
            }
        },

        effects: class {
            phase = 'init';

            apply (instance, effects, was) {
                if (effects) {
                    was ??= new Effects(instance, effects);

                    was.addMany(effects);
                }

                return was;
            }
        },

        props: class {
            signalize = false;
            value = {};

            apply (instance, props, was) {
                was && panik('props cannot be reconfigured');

                let instProps = createProps(instance.parent),
                    name;

                for (name in props) {
                    name !== 'sealed' && instance.declareProp(name, props[name], instProps);
                }

                //props.sealed !== false && Object.seal(instProps);

                return instProps;
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

    get scheduler () {
        return this.inheritable.$scheduler ?? Scheduler.instance;
    }

    set scheduler (value) {
        let { inheritable } = this;

        if (value) {
            inheritable.$scheduler = value;
        }
        else {
            delete inheritable.$scheduler;
        }
    }

    configure (config) {
        let me = this,
            { initialConfig } = me,
            classConfigs,
            bind, name, val;

        if (config && initialConfig && me.constructing && !('bind' in initialConfig)) {
            classConfigs = me.$meta.configs;
            bind = config.bind;

            if (bind) {
                bind = chain(bind);
            }

            for (name in config) {
                val = config[name];

                if (typeof val === 'function' && !isClass(val) && classConfigs[name]?.autoBind) {
                    (bind ??= {})[name] = val;
                    delete config[name];
                }
            }

            if (bind) {
                config.bind = bind;
            }
        }

        return super.configure(config);
    }

    //----------------------------------------------------------------------------------------
    // props support

    declareProp (name, value, props = this.props) {
        let formula = typeof value === 'function',
            opt = { name },
            signals = this._signals ??= chain(),
            sig = formula ? Signal.formula(value.bind(this, props), opt) : Signal.value(value, opt),
            descriptor = {
                configurable: true,
                get: () => sig.get(),
                set: v => sig.set(v)
            };

        signals[name]?.invalidate();
        signals[name] = sig;

        if (formula) {
            delete descriptor.set;
        }

        Object.defineProperty(props, name, descriptor);
    }

    declareProps (add, props = this.props) {
        for (let name in add) {
            this.declareProp(name, add[name], props);
        }
    }

    //----------------------------------------------------------------------------------------
    // Stateful support

    loadStatefulProps (state) {
        let me = this,
            { props } = me,
            signals = me._signals,
            name, sig, value;

        for (name in state) {
            sig = signals[name];

            if (sig) {
                value = state[name];
                delete state[name];

                props[name] = value;
            }
        }
    }

    watchStatefulProps (stateful) {
        let me = this,
            watcher = me.$statefulWatcher ??= Signal.watch(() => me._onStatefulWatcherNotify()),
            add, name, sig, signals;

        if (stateful) {
            me.getConfig('props');
            signals = me._signals;

            for (name in stateful) {
                sig = signals[name];
                sig && (add ??= []).push(sig);
            }
        }

        watcher.unwatch();

        add && watcher.watch(...add);
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
}
