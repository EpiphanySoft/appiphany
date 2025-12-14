import { Config, PersistenceProvider } from '@appiphany/aptly';
import { Hierarchical } from '@appiphany/aptly/mixin';

const
    EMPTY_OBJECT = Object.freeze({}),
    persistWatchSym = Symbol('persistWatch');


export const Persistable = Base => class Persistable extends Base.mixin(Hierarchical) {
    static className= 'Persistable';

    static configurable = {
        childPersist: class {
            apply (instance, value) {
                return (value === true) ? {} : value;
            }

            update (instance, value) {
                if (value && !instance.childPersistenceProvider) {
                    instance.childPersistenceProvider = {};
                }
            }
        },

        childPersistenceProvider: class {
            apply (instance, value, was) {
                return PersistenceProvider.reconfigure(was, value, {
                    defaults: {
                        type: 'child',
                        owner: instance
                    }
                });
            }

            update (instance, value) {
                let { inheritable } = instance;

                if (value) {
                    inheritable.persistenceProvider = value;
                }
                else {
                    delete inheritable.persistenceProvider;
                }
            }
        },

        persistable: class extends Config.Flags {
            priority = -999;

            apply (instance, value, was) {
                let ret = super.apply(instance, value, was),
                    // don't trigger childPersist update here ... just need to know if it will
                    // be activated.
                    childPersist = ret && instance.peekConfig('childPersist');

                if (childPersist) {
                    ret.childPersist = true;
                }

                return ret;
            }

            update (instance, value) {
                let { configuring, persistId: id, persistenceProvider: provider } = instance,
                    // persistables are only restored on first-time configuration and are limited
                    // to those properties that are declared in "persistable".
                    persist = value && id && configuring?.firstTime && provider?.get(id),
                    config, key;

                if (persist) {
                    for (key in persist) {
                        if (value[key]) {
                            // at least 1 saved property is still persistable, so keep the persist
                            // object and whatever keys remain at the end of the loop.
                            config = persist;
                        }
                        else {
                            // any key persist that is not (or no longer) persistable should not
                            // be restored.
                            delete persist[key];
                        }
                    }

                    if (config) {
                        instance.loadPersistableProps?.(config);
                        configuring.modified = config;
                    }
                }

                instance.watchPersistableConfigs(value);
            }
        },

        persistDirty: class {
            default = false;

            update (instance, dirty) {
                dirty && instance.persistenceProvider?.enqueue(instance);
            }
        },

        persistId: class {
            get (instance) {
                return instance.$config.persistId ?? instance.id;
            }
        },

        persistenceProvider: class {
            apply (instance, value, was) {
                return PersistenceProvider.reconfigure(was, value);
            }

            get (instance) {
                return instance.inherited.persistenceProvider || PersistenceProvider.instance;
            }

            update (instance, value) {
                let { inherited } = instance;

                if (value) {
                    inherited.persistenceProvider = value;
                }
                else {
                    delete inherited.persistenceProvider;
                }
            }
        }
    };

    getPersist (clean = true) {
        let me = this,
            { persistable } = me,
            classConfigs = me.$meta.configs,
            props = me.props || EMPTY_OBJECT,
            persist = null,
            cfg, key, value;

        if (persistable) {
            persist = {};

            for (key in persistable) {
                if (persistable[key]) {
                    cfg = classConfigs[key];
                    value = cfg || !(key in props) ? me[key] : props[key];

                    if (!cfg || value !== cfg.default) {
                        persist[key] = value;
                    }
                }
            }
        }

        if (clean) {
            me.persistDirty = false;
        }

        return persist;
    }

    watchPersistableConfigs (persistable) {
        let me = this,
            { persistId, [persistWatchSym]: configWatcher } = me;

        if (!configWatcher && persistable) {
            me[persistWatchSym] = configWatcher = me.watchConfigs(_ => me.persistDirty = true);
        }

        configWatcher?.(persistable);

        persistId && me.watchPersistableProps?.(persistable);
    }
}
