import { Config, Configurable } from '@appiphany/aptly';
import { Delayable } from '@appiphany/aptly/mixin';


export const Stateful = Base => class Stateful extends Base {
    static configurable = {
        state: class {
            value = null;
        },

        stateId: class {
            value = null;

            get (instance) {
                return instance._stateId ?? instance.id;
            }
        },

        stateful: class extends Config.Flags {
            value = null;
        },

        stateProvider: null
    };

    onConfigChange (name) {
        // TODO
    }
}

export class StateProvider extends Configurable.mixin(Delayable) {
    static configurable = {
        encoder: JSON,

        /**
         * @config {String}
         * The prefix to use for state keys.
         */
        scope: null,

        /**
         * @config {Object}
         * Either a `localStorage` or `sessionStorage` object or an object that conforms to the
         * same interface.
         */
        storage: null
    };

    static delayable = {
        _flush: 'asap'
    };

    #data = new Map();
    #dirty = null;

    async initialize () {
        super.initialize();

        await this._load();
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

    async _flush () {
        let data = this.#data,
            dirty = this.#dirty,
            { encoder, scope } = this,
            dirtyData = dirty && new Map(),
            key, value;

        if (dirty) {
            for (key of dirty.keys()) {
                value = data.get(key);

                if (value != null && encoder) {
                    value = encoder.stringify(value);
                }

                dirtyData.set(scope + key, value);
            }

            // TODO
        }
    }

    // Overridable methods

    _load () {
        let { encoder, scope, storage } = this,
            { length } = storage,
            data = new Map(),
            i, key, value;

        scope ??= '';

        for (i = 0; i < length; ++i) {
            key = storage.key(i);
            value = storage.getItem(key);

            if (key.startsWith(scope)) {
                if (encoder) {
                    value = encoder.parse(value);
                }

                key = key.slice(scope.length);
                data.set(key, value);
            }
        }

        this.#dirty = null;
        this.#data = data;
    }

    _save (dirtyData) {
        //
    }
}
