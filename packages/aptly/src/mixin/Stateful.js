import { Config, Configurable } from '@appiphany/aptly';


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

export class StateProvider extends Configurable {
    static configurable = {
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
}
