import { Config, isObject, StateProvider } from '@appiphany/aptly';
import { Hierarchical } from '@appiphany/aptly/mixin';


export const Stateful = Base => class Stateful extends Base.mixin(Hierarchical) {
    static configurable = {
        childState: class {
            value = null;

            apply (instance, value) {
                return isObject(value) ? value : {};
            }
        },

        childStateProvider: class {
            value = null;

            apply (instance, value, was) {
                return StateProvider.reconfigure(was, value, {
                    defaults: {
                        type: 'child'
                    }
                });
            }

            get (instance) {
                return instance.inherited.stateProvider || StateProvider.instance;
            }

            update (instance, value) {
                if (value) {
                    instance.inherited.stateProvider = value;
                }
                else {
                    delete instance.inherited.stateProvider;
                }
            }
        },

        stateful: class extends Config.Flags {
            value = 'childState';
            priority = -999;

            update (instance, value) {
                let { configuring, stateId: id, stateProvider: provider } = instance,
                    // state is only restored on first-time configuration and is limited to
                    // those properties that are stateful.
                    state = value && id && configuring?.firstTime && provider?.get(id),
                    config, key;

                if (state) {
                    for (key in state) {
                        if (value[key]) {
                            // at least 1 saved property is still stateful, so keep the state
                            // object and whatever keys remain at the end of the loop.
                            config = state;
                        }
                        else {
                            // any key in state that is not (or no longer) stateful should not
                            // be restored.
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
                return StateProvider.reconfigure(was, value);
            }

            get (instance) {
                return instance.inherited.stateProvider || StateProvider.instance;
            }

            update (instance, value) {
                if (value) {
                    instance.inherited.stateProvider = value;
                }
                else {
                    delete instance.inherited.stateProvider;
                }
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
