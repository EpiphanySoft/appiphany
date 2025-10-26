import { Scheduler, Signal, keys, capitalize } from '@appiphany/appiphany';

const
    getProto = o => o ? Object.getPrototypeOf(o) : null,
    getParentProps = p => getProto(p?.props),
    createProps = p => Object.create(Object.create(getParentProps(p)));

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
export const Bindable = Base => class Bindable extends Base {
    static proto = {
        _signals: null
    };

    static configurable = {
        parent: class {
            value = null;

            update(me, v) {
                let props = me._props;

                if (props) {
                    Object.setPrototypeOf(getProto(props), getParentProps(v));

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

                me.getConfig('props');
                me.bindProps(full);

                // do not return anything... $bindings is populated by propsAdd
            }
        },

        props: class {
            value = {};

            apply(me, props, was) {
                if (was) {
                    throw new Error('props cannot be reconfigured');
                }

                me._props = createProps(me.parent);

                me.defineProps(props);
            }
        }
    };

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

    _onWatcherNotify () {
        let work = this.$onPropSync ??= this._onPropSync.bind(this);

        this.scheduler.add(work);
    }

    _onPropSync () {
        let changes = {};

        for (let sig of this.$watcher.getPending()) {
            changes[sig.configName] = sig.get();
        }

        this.$watcher.watch();
        this.configure(changes);
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
            watcher = this.$watcher ??= Signal.watch(() => this._onWatcherNotify()),
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
        if (!add) {
            return;
        }

        let signals = this._signals ??= Object.create(null),
            props = this.props,  // internal props
            target = internal ? props : getProto(props),
            options = {};

        for (const name in add) {
            if (name === 'internal') {
                !internal && this.defineProps(add[name], true);
            }
            else if (name !== 'sealed') {
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

        if (!internal && add.sealed !== false) {
            Object.seal(props);
        }
    }
}
