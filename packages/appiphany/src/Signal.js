import { Dag } from './Dag.js';
import { WeakDict } from './WeakDict.js';

export const dag = new Dag();

const EMPTY = [];

export class Signal {
    static #idSeed = 0;

    #dependents = new WeakDict();  // Formulas that depend on this Signal
    #watchers = null;  // Watchers that are watching this Signal
    #id = ++Signal.#idSeed;
    #name;

    static formula (fn, options) {
        return new Formula(fn, options);
    }

    static value (v, options) {
        return new Value(v, options);
    }

    static watch (notify) {
        return new Watcher(notify);
    }

    constructor (options) {
        this.#name = options?.name ?? '';
    }

    get dependents () {
        return Array.from(this.#dependents.values());
    }

    get id () {
        return this.#id;
    }

    get name () {
        return this.#name;
    }

    invalidate () {
        for (const dep of this.#dependents.values()) {
            dep.invalidate();  // must be a Formula (a Value cannot be a dependent)
        }

        if (this.#watchers) {
            for (const watcher of this.#watchers.values()) {
                watcher.notify();
            }
        }
    }

    register (formula) {
        this.#dependents.set(formula.id, formula);
    }

    unregister (formula) {
        this.#dependents.delete(formula.id);
    }

    unwatch (watcher) {
        this.#watchers?.delete(watcher.id);
    }

    watch (watcher) {
        (this.#watchers ??= new WeakDict()).set(watcher.id, watcher);
    }

    toString () {
        return `<${this.id}> => [${this.dependents.map(d => d.id).join(', ')}]`;
        // <1> => [2, 3, 4]
    }
}

//---------------------------------------------------------------------------------------

class Formula extends Signal {
    #active = false;
    #dirty = true;
    #refs = EMPTY;  // Signals used by this formula
    #error = null;
    #value = null;

    #fn;

    constructor (fn, options) {
        super(options);

        this.#fn = fn;
    }

    get dirty () {
        return this.#dirty;
    }

    get () {
        dag.read(this);

        if (this.#dirty) {
            const oldRefs = this.#refs;
            const was = this.#value;

            this.#dirty = false;
            this.#active = true;

            dag.track(
                this,
                () => {
                    this.#value = this.#fn();
                },
                (refs, err) => {
                    this.#active = false;
                    this.#error = err;

                    if (!err) {
                        this.#refs = refs;

                        for (const ref of oldRefs) {
                            if (!refs.includes(ref)) {  // no longer used by this formula
                                ref.unregister(this);
                            }
                        }

                        for (const ref of refs) {
                            if (!oldRefs.includes(ref)) {  // not previously used by this formula
                                ref.register(this);
                            }
                        }
                    }
                }
            );

            if (was !== this.#value) {
                //
            }
        }

        if (this.#error) {
            throw new Error(`Formula failed: "${this.name}"`, { cause: this.#error });
        }

        return this.#value;
    }

    invalidate () {
        if (this.#active) {
            throw new Error('Cannot invalidate a formula while it is recalculating');
        }

        if (!this.#dirty) {
            this.#dirty = true;

            super.invalidate();
        }
    }

    toString () {
        return `[${this.#refs.map(d => d.id).join(', ')}] => ${super.toString()}`;
        // [1, 2, 3] => <10> => [20, 30, 40]
    }
}

//---------------------------------------------------------------------------------------

class Value extends Signal {
    #value;

    constructor (value, options) {
        super(options);

        this.#value = value;
    }

    get () {
        dag.read(this);

        return this.#value;
    }

    set (value) {
        if (this.#value !== value) {
            this.#value = value;

            this.invalidate();
        }
    }
}

//---------------------------------------------------------------------------------------

class Watcher {
    static #idSeed = 0;

    #id = ++Watcher.#idSeed;
    #notify;
    #state = 0; // 0 = idle, 1 = notifying, 2 = notified
    #watched = new WeakDict();

    constructor (notify) {
        this.#notify = notify;
    }

    get id () {
        return this.#id;
    }

    getPending () {
        let pending = [];

        for (const signal of this.#watched.values()) {
            if (signal.dirty) {
                pending.push(signal);
            }
        }

        return pending;
    }

    notify () {
        if (this.#state === 0) {
            this.#state = 1;

            dag.readLock();

            try {
                this.#notify();
            }
            finally {
                dag.readUnlock();
                this.#state = 2;
            }
        }
    }

    watch (...signals) {
        if (this.#state === 1) {
            throw new Error('Cannot watch a signal while it is notifying');
        }

        for (const signal of signals) {
            signal.watch(this);
            this.#watched.set(signal.id, signal);
        }

        this.#state = 0;
    }

    unwatch (...signals) {
        if (this.#state === 1) {
            throw new Error('Cannot unwatch a signal while it is notifying');
        }

        for (const signal of signals) {
            if (this.#watched.delete(signal.id)) {
                signal.unwatch(this);
            }
        }
    }
}
