import { PriorityQueue } from '@appiphany/aptly';

import assertly from 'assertly';

const { expect } = assertly;

describe('PriorityQueue', () => {
    it('should basically work', () => {
        let q = new PriorityQueue();
        let w1 = { w: 1 };
        let w2 = { w: 2 };
        let w3 = { w: 3 };

        q.enqueue(w3, -1);
        q.enqueue(w2);
        q.enqueue(w1, 10);

        expect(q.dirty).to.be(false); // items added in correct order

        let w = q.dequeue();

        expect(w).to.be(w3);

        w = q.dequeue();
        expect(w).to.be(w2);

        w = q.dequeue();
        expect(w).to.be(w1);
        expect(q.dirty).to.be(false);

        // add items in reverse order
        q.enqueue(w1, 10);
        expect(q.dirty).to.be(false);
        q.enqueue(w2);
        expect(q.dirty).to.be(true);
        q.enqueue(w3, -1);
        expect(q.dirty).to.be(true);

        w = q.dequeue();
        expect(w).to.be(w3);
        expect(q.dirty).to.be(false);

        w = q.dequeue();
        expect(w).to.be(w2);
        expect(q.dirty).to.be(false);

        w = q.dequeue();
        expect(w).to.be(w1);
        expect(q.dirty).to.be(false);

        // add items in order then last one out of order
        q.enqueue(w3, -1);
        expect(q.dirty).to.be(false);
        q.enqueue(w1, 10);
        expect(q.dirty).to.be(false);
        q.enqueue(w2);
        expect(q.dirty).to.be(true);

        w = q.dequeue();
        expect(w).to.be(w3);
        expect(q.dirty).to.be(false);

        w = q.dequeue();
        expect(w).to.be(w2);
        expect(q.dirty).to.be(false);

        w = q.dequeue();
        expect(w).to.be(w1);
        expect(q.dirty).to.be(false);
    });

    it('should be FIFO at equal priority', () => {
        let q = new PriorityQueue();
        let w1 = { w: 1 };
        let w2 = { w: 2 };
        let w3 = { w: 3 };

        q.enqueue(w1, 10);
        q.enqueue(w2, 10);

        let w = q.dequeue();
        expect(w).to.be(w1);

        w = q.dequeue();
        expect(w).to.be(w2);

        q.enqueue(w1, 10);
        q.enqueue(w2, 10);
        q.enqueue(w3, 1);

        w = q.dequeue();
        expect(w).to.be(w3);

        w = q.dequeue();
        expect(w).to.be(w1);

        w = q.dequeue();
        expect(w).to.be(w2);
    });
});
