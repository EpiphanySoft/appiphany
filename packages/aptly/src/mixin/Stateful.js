import { Config, StateProvider } from '@appiphany/aptly';
import { Hierarchical } from '@appiphany/aptly/mixin';


export const Stateful = Base => class Stateful extends Base.mixin(Hierarchical) {
    static configurable = {
        stateful: class extends Config.Flags {
            value = null;
            priority = -999;

            update (instance, value) {
                let { configuring, stateId: id, stateProvider: provider } = instance,
                    state = value && id && configuring?.firstTime && provider?.get(id),
                    config, key;

                if (state) {
                    for (key in state) {
                        if (value[key]) {
                            config = state;
                        }
                        else {
                            delete state[key];
                        }
                    }

                    if (config) {
                        configuring.modified = config;
                    }
                }
            }
        },

        stateDirty: class {
            value = null;

            update (instance, dirty) {
                dirty && instance.stateProvider?.enqueue(instance);
            }
        },

        stateId: class {
            value = null;

            get (instance) {
                return instance._stateId ?? instance.id;
            }
        },

        stateProvider: class {
            value = null;

            apply (instance, value, was) {
                let global = StateProvider.instance;

                if (value) {
                    //
                }

                return value;
            }

            get (instance) {
                return instance._stateProvider || StateProvider.instance;
            }
        }
    };

    onConfigChange (name) {
        let me = this;

        if (me.initialized && me.stateId && me.stateful?.[name]) {
            me.stateDirty = true;
        }
    }
}
