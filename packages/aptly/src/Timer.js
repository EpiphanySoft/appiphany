import { applyTo, deferred, Scheduler, thenable } from '@appiphany/aptly';


export class Timer {
    static types = {};

    #args = null;
    #disabled = false;
    #deferred = null;
    #generation = 0;
    #running = false;
    #timerId = null;

    /**
     * @config {Number}
     * The number of milliseconds to wait before invoking the callback. This does not apply to
     * derived types of timers.
     */
    delay = 0;

    /**
     * @config {Boolean}
     * Set to `true` to immediately invoke the callback, rather than waiting for the delay.
     */
    immediate = false;

    /**
     * @config {String}
     * A string containing 'a' for args to be restartable, or 't' for the timer to be restartable,
     * or both.
     */
    restartable = '';

    // TODO throttle

    constructor (fn, options) {
        this.fn = fn;

        options && applyTo(this, options);
    }

    get disabled () {
        return this.#disabled;
    }

    set disabled (v) {
        this.#disabled = v;
        v && this.cancel();
    }

    get pending () {
        return this.#args !== null;
    }

    get running () {
        return this.#running;
    }

    get timerId () {
        return this.#timerId;
    }

    cancel () {
        let me = this;

        me._cancelTimer();
        me.#args = null;
        me.#deferred?.resolve(false);
        me.#deferred = me.#timerId = null;
    }

    flush () {
        let me = this,
            args = me.#args,
            deferred = me.#deferred,
            ret = false;

        if (me.pending) {
            me.#deferred = null;
            me.cancel();

            me.#args = args;
            me.#deferred = deferred;
            me._onTick();
            ret = true;
        }

        return ret;
    }

    start (...args) {
        let me = this,
            ret = false,
            gen, restartable;

        if (!me.#disabled) {
            restartable = me.restartable || '';

            if (me.#running) {
                if (!me.immediate) {
                    if (!me.#args || restartable.includes('a')) {
                        me.#args = args;
                    }

                    ret = (me.#deferred ??= deferred()).promise;
                }
            }
            else {
                if (!me.pending) {
                    me.#args = args;
                }
                else {
                    if (restartable.includes('a')) {
                        // if the args are restartable, replace them
                        me.#args = args;
                    }

                    if (!restartable.includes('t')) {
                        // if the timer is not restartable, return the current promise
                        // and leave the timer running
                        return me.#deferred.promise;
                    }

                    // otherwise, cancel the current timer and start a new one
                    me._cancelTimer();
                }

                if (me.immediate) {
                    me._onTick();
                    ret = true;
                }
                else {
                    gen = ++me.#generation;
                    ret = (me.#deferred ??= deferred()).promise;

                    me.#timerId = me._start(() => me._onTick(gen));
                }
            }
        }

        return ret;
    }

    //------------------------------------------------
    // Overridable methods based on timer type

    _cancel (timerId) {
        clearTimeout(timerId);
    }

    _start (fn) {
        return setTimeout(fn, this.delay);
    }

    //------------------------------------------------
    // Private

    _cancelTimer () {
        let me = this,
            timerId = me.#timerId;

        if (timerId) {
            me._cancel(timerId);
            me.#timerId = null;
            ++me.#generation;
        }
    }

    _onTick (gen = this.#generation) {
        let me = this,
            args = me.#args,
            deferred, ret,
            finish = _ => {
                deferred?.resolve(true);
                me.#running = false;

                if (me.#args) {
                    let newGen = ++me.#generation;

                    me.#timerId = me._start(() => me._onTick(newGen));
                }
            };

        // if the Timer instance has been modified since the timer was scheduled,
        // ignore this call.
        if (gen === me.#generation) {
            deferred = me.#deferred;
            me.#deferred = me.#timerId = me.#args = null;
            me.#running = true;

            ret = args?.length ? me.fn(...args) : me.fn();

            if (thenable(ret)) {
                ret.finally(finish);
            }
            else {
                finish();
            }
        }
    }
}

/**
 * Timer that uses queueMicrotask to schedule the callback.
 */
export class AsapTimer extends Timer {
    static nextId = 0;

    _cancel () {
        // cannot un-queueMicrotask so we rely on the generation number mismatch to
        // avoid calling our fn (we rely on the generation number to effectively
        // cancel the timer)
    }

    _start (fn) {
        queueMicrotask(fn);

        return ++AsapTimer.nextId;
    }
}

/**
 * Timer that uses requestAnimationFrame to schedule the callback.
 *
 * This is a client-only form of timer.
 */
export class RafTimer extends Timer {
    _cancel (timerId) {
        cancelAnimationFrame(timerId);
    }

    _start (fn) {
        return requestAnimationFrame(fn);
    }
}

/**
 * Timer that uses requestAnimationFrame to schedule the callback.
 *
 * This is a client-only form of timer.
 */
export class SchedulerTimer extends Timer {
    static nextId = 0;

    _cancel () {
        // no cancel method - see AsapTimer
    }

    _start (fn) {
        (this.scheduler || Scheduler.instance).add(fn, this.priority);

        return ++SchedulerTimer.nextId;
    }
}

applyTo(SchedulerTimer.prototype, {
    priority: 0,
    scheduler: null
});


Timer.types.asap    = AsapTimer;
Timer.types.raf     = RafTimer;
Timer.types.sched   = SchedulerTimer;
Timer.types.timeout = Timer;
