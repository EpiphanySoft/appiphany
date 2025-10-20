import { Dag } from './Dag.js';
import { WeakDict } from './WeakDict.js';

export const dag = new Dag();

let idSeed = 0;


export class Signal {
    #dependents = new WeakDict();  // Formulas that depend on this Signal
    #id = ++idSeed;

    get dependents () {
        return Array.from(this.#dependents.values());
    }

    get id () {
        return this.#id;
    }

    invalidate () {
        for (const dep of this.#dependents.values()) {
            dep.invalidate();
        }
    }

    register (formula) {
        this.#dependents.set(formula.id, formula);
    }

    unregister (formula) {
        this.#dependents.delete(formula.id);
    }

    toString () {
        return `<${this.id}> => [${this.dependents.map(d => d.id).join(', ')}]`;
        // <1> => [2, 3, 4]
    }
}

//---------------------------------------------------------------------------------------

class Value extends Signal {
    #value;

    constructor (value) {
        super();

        this.#value = value;
    }

    get () {
        dag.read(this);

        return this.#value;
    }

    set (value) {
        this.#value = value;

        this.invalidate();
    }
}

Signal.Value = Value;
