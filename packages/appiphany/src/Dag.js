import { panik } from '@appiphany/appiphany';
import { WeakDict } from './WeakDict.js';

const NULL_PAIR = [null, null];


export class Hook {
    level = 0;

    enter (name) {
        console.log(`${' '.repeat(this.level)}  >> ${name}`);
        ++this.level;
    }

    leave (name) {
        --this.level;
        console.log(`${' '.repeat(this.level)}  << ${name}`);
    }

    use (name) {
        console.log(`${' '.repeat(this.level)}  -- ${name}`);
    }
}


export class Dag {
    #items = new WeakDict();
    #formulas = [];
    #lockReads = false;

    hook = null;
    // hook = new Hook();

    get active () {
        return this.#formulas.at(-1) ?? NULL_PAIR;
    }

    read (item) {
        if (this.#lockReads) {
            panik('Cannot read signals in a locked state');
        }

        let [, refs] = this.active;

        refs?.push(item);

        this.hook?.use(item.name, item.id);
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

        this.hook?.enter(formula.name, formula.id);

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

            this.hook?.leave(formula.name, formula.id);
        }
    }
}
