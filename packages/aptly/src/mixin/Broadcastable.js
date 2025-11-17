import { Destroyable, panik } from "@appiphany/aptly";


class Subscription extends Destroyable {
    constructor(observable, observer) {
        super();

        let me = this;

        me.observable = new WeakRef(observable);
        me.observer = new WeakRef(observer);
        me.uncascade = new WeakRef(observer.cascadeDestroy?.(me));
    }

    destruct() {
        let me = this,
            observable = me.observable.deref(),
            observer = me.observer.deref(),
            uncascade = me.uncascade.deref();

        observer && observable?.unobserve(observer);
        uncascade?.();

        me.observable = me.observer = me.uncascade = null;
    }
}

/**
 * Hold objects via WeakRef that will be called with broadcast messages.
 */
export const Broadcastable = Base => class Broadcastable extends Base {
    firing = null;
    informants = new Map();
    nextId = 0;

    broadcast(inform) {
        let me = this,
            { informants } = me,
            entry, id, informant;

        if (me.firing) {
            panik('Reentrancy not allowed');
        }

        try {
            me.firing = informants;

            for ([id, entry] of informants.entries()) {
                if (!(informant = entry.deref()) || informant.destroyed) {
                    informants.delete(id);
                }
                else {
                    informant.inform(inform);
                }
            }
        }
        finally {
            me.firing = null;
        }
    }

    mutableInformants() {
        let me = this,
            { informants } = me;

        if (me.firing === informants) {
            me.informants = informants = new Map(informants);
        }

        return informants;
    }

    /**
     * Adds an object with an inform() method to be called with messages.
     * @param {Object} observer An object that has an inform() method
     * @returns {Function} A function to call to remove the observer
     */
    observe(observer) {
        let me = this,
            id = observer.id || `__${++me.nextId}__`,
            sub = new Subscription(me, observer),
            informants = me.mutableInformants();

        informants.set(id, new WeakRef(observer));

        return sub;
    }

    unobserve(observer) {
        let me = this,
            informants = me.mutableInformants(),
            obj, id, entry;

        for ([id, entry] of informants.entries()) {
            if (!(obj = entry.deref()) || obj === observer) {
                informants.delete(id);
            }
        }
    }
}


export const Informable = Base => class Informable extends Base {
    inform(inform) {
        let { type } = inform;

        if (typeof type === 'string') {
            return this[`on_${type}`]?.(inform);
        }
    }
};
