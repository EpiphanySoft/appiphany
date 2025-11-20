import { applyTo } from '@appiphany/aptly';

const { defineProperty: defineProp } = Object;

export class Timer {
    static types = {};

    static create (fn, options) {
        if (typeof options === 'number') {
            options = { delay: options };
        }

        let timer = new this(fn, options);

        timer.start();

        return timer;
    }

    static decorate (prototype, name, options) {
        let cls = this,
            methodFn = prototype[name];

        defineProp(prototype, name, {
            get () {
                let invokeFn = (...args) => {
                        methodFn.apply(this, args);
                    },
                    wrapFn = (...args) => {
                        wrapFn.timer.start(...args);
                        // TODO return a promise
                    };

                wrapFn.timer = new cls(invokeFn, options);

                defineProp(this, name, {
                    value: wrapFn
                });

                return wrapFn;
            }
        });
    }

    #disabled = false;

    args = null;
    delay = 0;
    generation = 0;
    id = null;
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
        return this.id !== null;
    }

    start (...args) {
        let me = this,
            gen, restartable;

        if (!me.#disabled) {
            if (!me.pending) {
                me.args = args;
            }
            else {
                restartable = me.restartable || '';

                if (restartable.includes('a')) {
                    me.args = args;
                }

                if (!restartable.includes('t')) {
                    return;
                }

                me._cancelTimer();
            }

            if (me.immediate) {
                me._onTick();
            }
            else {
                gen = ++me.generation;

                me.id = me._start(() => me._onTick(gen));
            }
        }
    }

    cancel () {
        this._cancelTimer();
        this.args = null;
    }

    flush () {
        let me = this,
            args = me.args;

        if (me.pending) {
            me.cancel();
            me.args = args;
            me._onTick();
        }
    }

    _cancel (id) {
        clearTimeout(id);
    }

    _cancelTimer () {
        let id = this.id;

        if (id) {
            this._cancel(id);
            this.id = null;
            ++this.generation;
        }
    }

    _onTick (gen = this.generation) {
        let me = this,
            args = me.args;

        if (gen === me.generation) {
            me.id = me.args = null;

            args?.length ? me.fn(...args) : me.fn();
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
        // avoid calling our fn
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
    _cancel (id) {
        cancelAnimationFrame(id);
    }

    _start (fn) {
        return requestAnimationFrame(fn);
    }
}


Timer.types.asap    = AsapTimer;
Timer.types.raf     = RafTimer;
Timer.types.timeout = Timer;
