import { Destroyable } from "@appiphany/appiphany";


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
export const Observable = Base => class Observable extends Base {
    firing = null;
    observers = new Map();
    nextId = 0;

    broadcast(inform) {
        let me = this,
            { observers } = me,
            entry, id, observer;

        if (me.firing) {
            throw new Error('Reentrancy not allowed');
        }

        try {
            me.firing = observers;

            for ([id, entry] of observers.entries()) {
                if (!(observer = entry.deref()) || observer.destroyed) {
                    observers.delete(id);
                }
                else {
                    observer.inform(inform);
                }
            }
        }
        finally {
            me.firing = null;
        }
    }

    mutableObservers() {
        let me = this,
            { observers } = me;

        if (me.firing === observers) {
            me.observers = observers = new Map(observers);
        }

        return observers;
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
            observers = me.mutableObservers();

        observers.set(id, new WeakRef(observer));

        return sub;
    }

    unobserve(observer) {
        let me = this,
            observers = me.mutableObservers(),
            obj, id, entry;

        for ([id, entry] of observers.entries()) {
            if (!(obj = entry.deref()) || obj === observer) {
                observers.delete(id);
            }
        }
    }
}


export const Observer = Base => class Observer extends Base {
    inform(inform) {
        let { type } = inform;

        if (typeof type === 'string') {
            return this['on_' + type]?.(inform);
        }
    }
};
