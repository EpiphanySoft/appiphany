import { Configurable } from '@appiphany/aptly';
import { Delayable } from '@appiphany/aptly/mixin';


export class StateProvider extends Configurable.mixin(Delayable) {
    static instance = null;

    static abstract = {
        _loadData (data) {},
        _saveData (dirtyData) {}
    };

    static granular = true;

    static delayable = {
        _flush: 'asap'
    };

    #data = new Map();
    #dirty = null;
    #queue = null;

    async initialize () {
        super.initialize();

        await this._loadData(this.#data);
    }

    get granular () {
        return this.constructor.granular;
    }

    delete (key) {
        this.set(key);
    }

    get (key) {
        return this.#data.get(key);
    }

    set (key, value) {
        let me = this,
            data = me.#data;

        if (data.get(key) !== value) {
            if (value === undefined) {
                data.delete(key);
            }
            else {
                data.set(key, value);
            }

            if (me.granular) {
                (me.#dirty ??= new Set()).add(key);
            }
            else {
                me.#dirty = true;
            }
        }
    }

    // Internal methods

    clearDirty (dirtyData) {
        let me = this,
            dirty = me.#dirty,
            data, key;

        if (dirtyData && dirty) {
            if (!me.granular) {
                dirty = false;
            }
            else {
                data = me.#data;

                for (key of dirtyData.keys()) {
                    if (data.get(key) === dirtyData.get(key)) {
                        dirty.delete(key);
                    }
                }

                if (!dirty.size()) {
                    dirty = null;
                }
            }

            me.#dirty = dirty;
        }
    }

    enqueue (item) {
        (this.#queue ??= new Map()).set(item.stateId, item);
        this._flush();
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
            { granular } = me,
            data = me.#data,
            dirty = me.#dirty,
            dirtyData = dirty && new Map(),
            key;

        if (dirty) {
            for (key of (granular ? dirty : data).keys()) {
                // if a key has been deleted, get(key) will return undefined
                // which is what triggers its deletion by _saveData()
                dirtyData.set(key, data.get(key));
            }

            return me._saveData(dirtyData);  // can be async if it returns a promise
        }
    }
}


export class ChildStateProvider extends StateProvider {
    static configurable = {
        stateId: null,

        stateProvider: null
    };

    _loadData (data) {
        // no data source
    }

    _saveData (dirtyData) {
        this.clearDirty(dirtyData);
    }
}


export class MemoryStateProvider extends StateProvider {
    _loadData (_) {
        // no data source
    }

    _saveData (dirtyData) {
        this.clearDirty(dirtyData);
    }
}

StateProvider.instance = new MemoryStateProvider();


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

    _loadData (data) {
        let { encoder, scope, storage } = this,
            { length } = storage,
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

        this.clearDirty(dirtyData);
    }
}
