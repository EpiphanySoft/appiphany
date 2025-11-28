import { applyTo, chain } from '@appiphany/aptly';

const
    canon = chain(),
    addCanon = s => canon[s] = s,
    now = () => performance.now();

let idSeed = 0;

/**
 * This class represents an event that has been fired by an Eventable.
 */
export class Event {
    static canonicalize (type) {
        return canon[type] ??= addCanon(type.toLowerCase());
    }

    constructor (sender, options) {
        let me = this,
            prior = null;

        me.target = sender;

        if (options instanceof Event) {
            prior = options;
            me.type = prior.type;
        }
        else if (typeof options === 'string') {
            me.type = options;
        }
        else {
            applyTo(me, options);
        }

        me.id = ++idSeed;
        me.prior = prior;
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
        if (!this.stopped) {
            this.stopped = true;
            this.finish();

            this.prior?.stop();
        }
    }
}
