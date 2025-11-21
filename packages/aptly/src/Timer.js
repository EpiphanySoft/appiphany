import { applyTo, deferred, Scheduler } from '@appiphany/aptly';

const { defineProperty: defineProp } = Object;

export class Timer {
    static types = {};

    static decorate (prototype, name, options) {
        let cls = this,
            methodFn = prototype[name];

        defineProp(prototype, name, {
            get () {
                let invokeFn = (...args) => methodFn.apply(this, args),
                    wrapFn = (...args) => wrapFn.timer.start(...args),
                    scheduler = (cls === SchedulerTimer) && this.scheduler;

                wrapFn.timer = new cls(invokeFn, options);

                if (scheduler) {
                    wrapFn.timer.scheduler = scheduler;
                }

                // On first access of the delayable method, this getter is called. It
                // shadows the getter on the prototype with the wrapFn that is bound
                // this the instance. This means each instance will gets its own timer.
                defineProp(this, name, { value: wrapFn });

                // This is the only time this getter is called on this instance (due
                // to the above), but we still need to return the wrapFn for this call.
                return wrapFn;
            }
        });
    }

    #disabled = false;
    #deferred = null;
    #timerId = null;

    args = null;
    delay = 0;
    generation = 0;
    immediate = false;
    restartable = '';

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
        return this.#timerId !== null;
    }

    get timerId () {
        return this.#timerId;
    }

    start (...args) {
        let me = this,
            ret = false,
            gen, restartable;

        if (!me.#disabled) {
            if (!me.pending) {
                me.args = args;
            }
            else {
                restartable = me.restartable || '';

                if (restartable.includes('a')) {
                    // if the args are restartable, replace them
                    me.args = args;
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
                gen = ++me.generation;
                ret = (me.#deferred ??= deferred()).promise;

                me.#timerId = me._start(() => me._onTick(gen));
            }
        }

        return ret;
    }

    cancel () {
        let me = this;

        me._cancelTimer();
        me.args = null;
        me.#deferred?.resolve(false);
        me.#deferred = me.#timerId = null;
    }

    flush () {
        let me = this,
            args = me.args,
            deferred = me.#deferred;

        if (me.pending) {
            me.#deferred = null;
            me.cancel();

            me.args = args;
            me.#deferred = deferred;
            me._onTick();
        }
    }

    _cancel (timerId) {
        clearTimeout(timerId);
    }

    _cancelTimer () {
        let me = this,
            timerId = me.#timerId;

        if (timerId) {
            me._cancel(timerId);
            me.#timerId = null;
            ++me.generation;
        }
    }

    _onTick (gen = this.generation) {
        let me = this,
            args = me.args;

        // if the Timer instance has been modified since the timer was scheduled,
        // ignore this call.
        if (gen === me.generation) {
            me.#timerId = me.args = null;

            args?.length ? me.fn(...args) : me.fn();

            me.#deferred?.resolve(true);
            me.#deferred = null;
        }
    }

    _start (fn) {
        return setTimeout(fn, this.delay);
    }
}

/**
 * Timer that uses queueMicrotask to schedule the callback.
 */
class AsapTimer extends Timer {
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
class RafTimer extends Timer {
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
class SchedulerTimer extends Timer {
    static nextId = 0;

    priority = 0;
    scheduler = null;

    _cancel () {
        // no cancel method
    }

    _start (fn) {
        (this.scheduler || Scheduler.instance).add(fn, this.priority);

        return ++SchedulerTimer.nextId;
    }
}


Timer.types.asap      = AsapTimer;
Timer.types.raf       = RafTimer;
Timer.types.scheduler = SchedulerTimer;
Timer.types.timeout   = Timer;
