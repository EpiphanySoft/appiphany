import { applyTo, chain, clone, Configurable } from '@appiphany/aptly';
import { Delayable, Factoryable } from '@appiphany/aptly/mixin';


export class PersistenceProvider extends Configurable.mixin(Delayable, Factoryable) {
    static instance = null;

    static abstract = {
        _loadData (data) {},
        _saveData (dirtyData) {}
    };

    static factory = {
        // defaultType: 'memory'
    };

    static configurable = {
        flushPriority: class {
            default = 100;
            value   = null;

            update (instance, value) {
                instance._flush.timer.priority = value;
            }
        }
    };

    static monolithic = false;

    static delayable = {
        _flush: {
            type: 'sched',
            priority: 100
        }
    };

    #data = chain();
    #dirty = null;
    #persistenceQueue = null;

    async initialize () {
        super.initialize();

        await this._loadData(this.#data);
    }

    get dirty () {
        return this.monolithic ? this.#dirty : !!this.#dirty?.size;
    }

    get monolithic () {
        return this.constructor.monolithic;
    }

    delete (key) {
        this.set(key);
    }

    get (key) {
        return this.#data[key];
    }

    set (key, value) {
        let me = this,
            data = me.#data;

        if (data[key] !== value) {
            if (value === undefined) {
                delete data[key];
            }
            else {
                data[key] = value;
            }

            if (me.monolithic) {
                me.#dirty = true;
            }
            else {
                (me.#dirty ??= new Set()).add(key);
            }

            !me._flush.timer.running && me._flush();
        }
    }

    // Internal methods

    clearDirty (dirtyData) {
        let me = this,
            dirty = me.#dirty,
            data, key;

        if (dirtyData && dirty) {
            if (me.monolithic) {
                me.#dirty = false;
            }
            else {
                data = me.#data;

                for (key in dirtyData) {
                    if (data[key] === dirtyData[key]) {
                        dirty.delete(key);
                    }
                }
            }
        }
    }

    enqueue (persistableItem) {
        (this.#persistenceQueue ??= new Map()).set(persistableItem.persistId, persistableItem);
        this._flush();
    }

    // Private methods

    _flush () {
        let me = this,
            persistenceQueue = me.#persistenceQueue,
            persistableItem, persistId;

        me.#persistenceQueue = null;

        if (persistenceQueue) {
            for (persistableItem of persistenceQueue.values()) {
                persistId = persistableItem.persistId;

                if (persistId) {
                    me.set(persistId, persistableItem.getPersist());
                }
            }
        }

        return me._save();
    }

    _save () {
        let me = this,
            { monolithic } = me,
            data = me.#data,
            dirty = me.#dirty,
            dirtyData = dirty && chain(),
            key;

        if (dirty) {
            if (monolithic) {
                applyTo(dirtyData, data);
            }
            else {
                for (key of dirty.keys()) {
                    // if a key has been deleted, [key] evaluates to undefined
                    // which is what triggers its deletion by _saveData()
                    dirtyData[key] = data[key];
                }
            }

            return me._saveData(dirtyData);  // can be async if it returns a promise
        }
    }
}


export class MemoryPersistenceProvider extends PersistenceProvider {
    static type = 'memory';

    _loadData (_) {
        // no data source
    }

    _saveData (dirtyData) {
        this.clearDirty(dirtyData);
    }
}

PersistenceProvider.instance = new MemoryPersistenceProvider();


export class ChildPersistenceProvider extends PersistenceProvider {
    static monolithic = true;

    static type = 'child';

    static configurable = {
        flushPriority: 99,

        owner: null,

        persistId: 'childPersist'
    };

    _loadData (data) {
        applyTo(data, clone(this.owner[this.persistId]));
    }

    _saveData (dirtyData) {
        this.owner[this.persistId] = dirtyData;
        this.clearDirty(dirtyData);
    }
}

ChildPersistenceProvider.initClass();


export class StoragePersistenceProvider extends PersistenceProvider {
    static type = 'storage';

    static configurable = {
        encoder: JSON,

        /**
         * @config {String}
         * The prefix to use for persistence keys.
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

                data[key.slice(scope.length)] = value;
            }
        }
    }

    _saveData (dirtyData) {
        let { encoder, scope, storage } = this,
            key, value;

        for (key in dirtyData) {
            value = dirtyData[key];
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

StoragePersistenceProvider.initClass();
