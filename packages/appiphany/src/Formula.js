import { Signal, dag } from './Signal.js';

const EMPTY = [];


export class Formula extends Signal {
    #active = false;
    #dirty = true;
    #refs = EMPTY;  // Signals used by this formula
    #value = null;

    #fn;

    constructor (fn) {
        super();

        this.#fn = fn;
    }

    get () {
        dag.read(this);

        if (this.#dirty) {
            this.#dirty = false;

            dag.track(
                this,
                refs => {
                    const was = this.#refs;

                    this.#active = true;
                    this.#value = this.#fn();

                    this.#refs = refs;

                    for (const ref of was) {
                        if (!refs.includes(ref)) {  // no longer used by this formula
                            ref.unregister(this);
                        }
                    }

                    for (const ref of refs) {
                        if (!was.includes(ref)) {  // not previously used by this formula
                            ref.register(this);
                        }
                    }
                },
                refs => {
                    this.#active = false;
                }
            );
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

Signal.Formula = Formula;
