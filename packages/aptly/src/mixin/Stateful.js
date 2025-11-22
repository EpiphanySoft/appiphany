import { Config, Configurable } from '@appiphany/aptly';
import { Delayable } from '@appiphany/aptly/mixin';


export const Stateful = Base => class Stateful extends Base {
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

        stateId: class {
            value = null;

            get (instance) {
                return instance._stateId ?? instance.id;
            }
        },

        stateProvider: class {
            value = null;

            get (instance) {
                return instance._stateProvider || StateProvider.instance;
            }
        }
    };

    onConfigChange (name) {
        let me = this;

        if (me.initialized && me.stateId && me.stateful?.[name]) {
            me.stateProvider?.enqueue(me);
        }
    }
}


export class StateProvider extends Configurable.mixin(Delayable) {
    static instance = null;

    static abstract = {
        _loadData () {},
        _saveData (dirtyData) {}
    };

    static delayable = {
        _flush: 'asap'
    };

    #data = new Map();
    #dirty = null;
    #queue = null;

    async initialize () {
        super.initialize();

        this.#data = await this._loadData();
    }

    enqueue (item) {
        (this.#queue ??= new Map()).set(item.stateId, item);
        this._flush();
    }

    get (key) {
        return this.#data.get(key);
    }

    remove (key) {
        this.set(key);
    }

    set (key, value) {
        let me = this;

        if (me.#data.get(key) !== value) {
            if (value === undefined) {
                me.#data.delete(key);
            }
            else {
                me.#data.set(key, value);
            }

            (me.#dirty ??= new Set()).add(key);
        }
    }

    // Private methods

    _flush () {
        let queue = this.#queue,
            id, item;

        this.#queue = null;

        for ([id, item] of queue.entries()) {
            // TODO
        }

        return this._save();
    }

    _save () {
        let me = this,
            data = me.#data,
            dirty = me.#dirty,
            dirtyData = dirty && new Map(),
            key;

        if (dirty) {
            for (key of dirty.keys()) {
                dirtyData.set(key, data.get(key) ?? null);
            }

            me.#dirty = null;

            return me._saveData(dirtyData);  // can be async if it returns a promise
        }
    }
}


export class StorageStateProvider extends StateProvider {
    static configurable = {
        encoder: JSON,

        /**
         * @config {String}
         * The prefix to use for state keys.
         */
        scope: class {
            default = '';
            value   = null;
        },

        /**
         * @config {Object}
         * Either a `localStorage` or `sessionStorage` object or an object that conforms to the
         * same interface.
         */
        storage: null
    };

    // Overridable methods

    _loadData () {
        let { encoder, scope, storage } = this,
            { length } = storage,
            data = new Map(),
            i, key, value;

        for (i = 0; i < length; ++i) {
            key = storage.key(i);
            value = storage.getItem(key);

            if (key.startsWith(scope)) {
                if (encoder) {
                    value = value ? encoder.parse(value) : null;
                }

                data.set(key.slice(scope.length), value);
            }
        }

        return data;
    }

    _saveData (dirtyData) {
        let { encoder, scope, storage } = this,
            key, value;

        for ([key, value] of dirtyData.entries()) {
            key = scope + key;

            if (value === undefined) {
                storage.removeItem(key);
            }
            else {
                if (value != null && encoder) {
                    value = encoder.stringify(value);
                }

                storage.setItem(key, value);
            }
        }
    }
}
