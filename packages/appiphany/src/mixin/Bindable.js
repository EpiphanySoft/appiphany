import { Scheduler, Signal, keys } from '@appiphany/appiphany';

const
    getProto = o => o ? Object.getPrototypeOf(o) : null,
    getProps = p => getProto(p?.props),
    createProps = p => Object.create(Object.create(getProps(p)));

/**
 * This mixin adds the ability to define props on a class. Signals exist as both
 * published and internal. Internal props are only available to the instance and
 * are accessed via the `props` property. Published props are available to child
 * instances (connected via their `parent` property).
 *
 *
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
                    Object.setPrototypeOf(getProto(props), getProps(v));

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

                me.propBind(full);

                // do not return anything... $bindings is populated by propsAdd
            }
        },

        internal: class {
            value = undefined;

            apply(me, props, was) {
                props && me.propsAdd(props, true);
                was && me.propsRemove(...keys(was).filter(k => !props || !(k in props)));

                // do not return anything... _props is populated by propsAdd
            }
        },

        publish: class {
            value = undefined;

            apply(me, props, was) {
                props && me.propsAdd(props, false);
                was && me.propsRemove(...keys(was).filter(k => !props || !(k in props)));

                // do not return anything... _props is populated by propsAdd
            }
        }
    };

    get props () {
        return this._props ??= createProps(this.parent);
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

    _onPropBind () {
        debugger;
    }

    propBind (bind) {
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
            watcher = this.$watcher ??= Signal.watch(() => this._onPropBind()),
            add, configName, remove;

        for (configName in bind) {
            // config: 'prop'   one-way
            // config: '~prop'  two-way
            let prop = bind[configName], // in for-loop to avoid stale closure
                was = bindings[configName],
                sig, twoWay;

            if (prop) {
                twoWay = prop[0] === '~';
                prop = twoWay ? prop.slice(1) : prop;

                if (was && was.name === prop && was.twoWay === twoWay) {
                    continue;
                }

                sig = Signal.formula(() => this.props[prop], { name: prop });
                sig.twoWay = twoWay;
                sig.update = twoWay && (v => this.props[prop] = v);

                (add ??= []).push(sig);

                bindings[configName] = sig;
            }

            if (was) {
                delete bindings[configName];
                (remove ??= []).push(was);
            }
        }

        add && watcher.watch(...add);
        remove && watcher.unwatch(...remove);
    }

    propsAdd (add, internal) {
        let signals = this._signals ??= Object.create(null),
            props = this.props,  // internal props
            target = internal ? props : getProto(props),
            options = {};

        for (const name in add) {
            let existing = signals[name],
                sig = add[name],
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

    propsRemove (...names) {
        let signals = this._signals,
            sig;

        for (const name of names) {
            sig = signals?.[name];

            if (sig) {
                delete signals[name];
                delete this._props?.[name];

                sig.invalidate();
            }
        }
    }
}
