import { WeakDict } from './WeakDict.js';

const NULL_PAIR = [null, null];


export class Dag {
    #items = new WeakDict();
    #formulas = [];

    get active () {
        return this.#formulas.at(-1) ?? NULL_PAIR;
    }

    read (item) {
        let [, refs] = this.active;

        refs?.push(item);
    }

    track (formula, action, cleanup) {
        const refs = [];

        this.#formulas.push([formula, refs]);

        try {
            action(refs);

            this.#items.set(formula.id, formula);
        }
        // TODO
        //  catch (e) {
        //      ...
        //  }
        finally {
            this.#formulas.pop();
            cleanup?.(refs);
        }
    }
}
