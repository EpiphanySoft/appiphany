import { applyTo, chain } from '@appiphany/aptly';

const
    canon = chain(),
    addCanon = s => canon[s] = s,
    { now } = performance;

/**
 * This class represents an event that has been fired by an Eventable.
 */
export class Event {
    static canonicalize (type) {
        return canon[type] ??= addCanon(type.toLowerCase());
    }

    constructor (sender, options) {
        let me = this;

        me.target = sender;

        if (typeof options === 'string') {
            me.type = options;
        }
        else {
            applyTo(me, options);
        }

        me.sender = sender;
        me.stopped = false;
        me.t0 = now();
        me.t1 = 0;
        me.type = Event.canonicalize(me.type);
    }

    get done () {
        return !!this.t1;
    }

    get duration () {
        return (this.t1 || now()) - this.t0;
    }

    finish () {
        this.t1 = this.t1 || now();
    }

    stop () {
        this.finish();
        this.stopped = true;
    }
}
