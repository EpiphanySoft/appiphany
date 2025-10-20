
export class WeakDict {
    #dict = new Map();

    get size () {
        return this.#dict.size;
    }

    clear () {
        this.#dict.clear();
    }

    delete (key) {
        return this.#dict.delete(key);
    }

    forEach (fn, thisArg) {
        for (const [key, value] of this.entries()) {
            fn.call(thisArg, value, key, this);
        }
    }

    get (key) {
        const ent = this.#dict.get(key);
        const ref = ent?.deref();

        if (ref) {
            return ref;
        }

        ent && this.#dict.delete(key);

        return null;
    }

    has (key) {
        return this.get(key) !== null;
    }

    set (key, value) {
        this.#dict.set(key, new WeakRef(value));
    }

    *entries () {
        for (const [key, ref] of this.#dict) {
            const value = ref.deref();

            if (value) {
                yield [key, value];
            }
        }
    }

    *keys () {
        for (const [key, ref] of this.#dict) {
            if (ref.deref()) {
                yield key;
            }
            else {
                this.#dict.delete(key);
            }
        }
    }

    *values () {
        for (const [key, ref] of this.#dict) {
            const value = ref.deref();

            if (value) {
                yield value;
            }
            else {
                this.#dict.delete(key);
            }
        }
    }

    [Symbol.iterator] () {
        return this.entries();
    }
}
