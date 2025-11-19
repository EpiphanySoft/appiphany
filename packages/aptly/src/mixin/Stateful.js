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
    static abstract = {
        clearValues () {},
        deleteValue (key) {},
        getValue (key) {},
        setValue (key, value) {}
    };

    static configurable = {
        scope: null
    };
}
