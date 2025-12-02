import { Config, isObject, StateProvider } from '@appiphany/aptly';
import { Hierarchical } from '@appiphany/aptly/mixin';

const
    EMPTY_OBJECT = Object.freeze({}),
    stateWatchSym = Symbol('stateWatch');


export const Stateful = Base => class Stateful extends Base.mixin(Hierarchical) {
    static className= 'Stateful';

    static configurable = {
        childState: class {
            value = null;

            apply (instance, value) {
                return (value === true) ? {} : value;
            }

            update (instance, value) {
                if (value && !instance.childStateProvider) {
                    instance.childStateProvider = {};
                }
            }
        },

        childStateProvider: class {
            value = null;

            apply (instance, value, was) {
                return StateProvider.reconfigure(was, value, {
                    defaults: {
                        type: 'child',
                        owner: instance
                    }
                });
            }

            update (instance, value) {
                let { inheritable } = instance;

                if (value) {
                    inheritable.stateProvider = value;
                }
                else {
                    delete inheritable.stateProvider;
                }
            }
        },

        stateful: class extends Config.Flags {
            value = null;
            priority = -999;

            apply (instance, value, was) {
                let ret = super.apply(instance, value, was),
                    // don't trigger childState update here ... just need to know if it will
                    // be activated.
                    childState = ret && instance.peekConfig('childState');

                if (childState) {
                    ret.childState = true;
                }

                return ret;
            }

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
                        instance.loadStatefulProps?.(config);
                        configuring.modified = config;
                    }
                }

                instance.watchStatefulConfigs(value);
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
                let { inherited } = instance;

                if (value) {
                    inherited.stateProvider = value;
                }
                else {
                    delete inherited.stateProvider;
                }
            }
        }
    };

    getState (clean = true) {
        let me = this,
            { stateful } = me,
            classConfigs = me.$meta.configs,
            props = me.$props || EMPTY_OBJECT,
            state = null,
            cfg, key, value;

        if (stateful) {
            state = {};

            for (key in stateful) {
                if (stateful[key]) {
                    cfg = classConfigs[key];
                    value = cfg || !(key in props) ? me[key] : props[key];

                    if (!cfg || value !== cfg.default) {
                        state[key] = value;
                    }
                }
            }
        }

        if (clean) {
            me.stateDirty = false;
        }

        return state;
    }

    watchStatefulConfigs (stateful) {
        let me = this,
            { stateId, [stateWatchSym]: configWatcher } = me;

        if (!configWatcher && stateful) {
            me[stateWatchSym] = configWatcher = me.watchConfigs(_ => me.stateDirty = true);
        }

        configWatcher?.(stateful);

        stateId && me.watchStatefulProps?.(stateful);
    }
}
