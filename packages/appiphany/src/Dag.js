import { WeakDict } from './WeakDict.js';

const NULL_PAIR = [null, null];


export class Dag {
    #items = new WeakDict();
    #formulas = [];
    #lockReads = false;

    get active () {
        return this.#formulas.at(-1) ?? NULL_PAIR;
    }

    read (item) {
        if (this.#lockReads) {
            throw new Error('Cannot read signals in a locked state');
        }

        let [, refs] = this.active;

        refs?.push(item);
    }

    readLock () {
        this.#lockReads = true;
    }

    readUnlock () {
        this.#lockReads = false;
    }

    track (formula, action, cleanup) {
        const refs = [];

        let err = null;

        this.#formulas.push([formula, refs]);

        try {
            action(refs);

            this.#items.set(formula.id, formula);
        }
        catch (e) {
            err = e;
        }
        finally {
            this.#formulas.pop();
            cleanup?.(refs, err);
        }
    }
}
