export const Signalable = Base => class Signalable extends Base {
    static configurable = {
        parent: class {
            value = undefined;

            update(me, v) {
                debugger;
                if (me._signals) {
                    Object.setPrototypeOf(me._signals, v?.signals ?? null);
                }
            }
        },

        signals: class {
            value = undefined;

            apply(me, sigs) {
                let signals = (me._signals ??= Object.create(me.parent?.signals ?? null)),
                    name, sig;
                debugger;

                if (sigs) {
                    for (name in sigs) {
                        sig = sigs[name];

                        if (typeof sig === 'function') {
                            //
                        }
                        else {
                            //
                        }
                    }
                }
            }
        }
    };


}
