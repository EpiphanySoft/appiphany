
const
    cmp = (a, b) => b[0] - a[0];
    // = [
    //    [ /* priority = */ 2, _ ],
    //    [ /* priority = */ 1, _ ],
    //    ...
    // ]

export class PriorityQueue {
    #dirty = false;
    #items = [];

    get dirty () {
        return this.#dirty;
    }

    get empty () {
        return !this.#items.length;
    }

    get size () {
        return this.#items.length;
    }

    #clean () {
        if (this.#dirty) {
            this.#items.sort(cmp);
            this.#dirty = false;
        }

        return this.#items;
    }

    * [Symbol.iterator] () {
        let items = this.#clean();

        for (let ent of items) {
            yield ent[1];
        }
    }

    dequeue () {
        return this.#clean().pop()?.[1] ?? null;
    }

    enqueue (item, priority) {
        let items = this.#items,
            ent = [priority || 0, item];

        if (items.length && cmp(ent, items.at(-1)) <= 0) {
            // more than 1 item and the new item is out of order with the last item
            this.#dirty = true;
        }

        items.push(ent);
    }

    peek () {
        return this.#clean().at(-1)?.[1] ?? null;
    }

    pull () {
        return this.#clean().shift()?.[1] ?? null;
    }
}
