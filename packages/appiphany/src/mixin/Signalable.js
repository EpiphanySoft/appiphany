import { Signal, keys } from '@appiphany/appiphany';


export const Signalable = Base => class Signalable extends Base {
    static configurable = {
        parent: class {
            value = undefined;

            update(me, v) {
                if (me._signals) {
                    Object.setPrototypeOf(me._signals, v?.signals ?? null);
                }
            }
        },

        signals: class {
            value = undefined;

            apply(me, sigs, was) {
                sigs && me.addSignal(sigs);
                was && me.removeSignal(...keys(was).filter(k => !sigs || !(k in sigs)));

                // do not return anything... _signals is populated by addSignal
            }
        }
    };

    addSignal (name, signal) {
        let add = (typeof name === 'string') ? { [name]: signal } : name,
            signalDefs = this.$signalDefs ??= Object.create(null),
            signals = this._signals ??= Object.create(this.parent?.signals ?? null),
            options = {};

        for (name in add) {
            let existing = signalDefs[name],
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
            sig = formula ? Signal.formula(sig.bind(signals), options) : Signal.value(sig, options);
            signalDefs[name] = sig;

            if (formula) {
                delete property.set;
            }

            if (existing) {
                delete signals[name];
            }

            Object.defineProperty(signals, name, property)

            if (existing) {
                existing.invalidate();
            }
        }
    }

    removeSignal (...names) {
        let signalDefs = this.$signalDefs,
            sig;

        for (const name of names) {
            sig = signalDefs?.[name];

            if (sig) {
                delete signalDefs[name];
                delete this._signals?.[name];

                sig.invalidate();
            }
        }
    }
}
