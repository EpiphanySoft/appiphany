import { PriorityQueue } from './PriorityQueue.js';
import { Configurable } from './Configurable.js';

const
    tock = () => performance.now();

export class Scheduler extends Configurable {
    static instance = new Scheduler();

    static configurable = {
        maxTimesliceMillis: 10
    };

    #pending = false;
    #queue = new PriorityQueue();

    add (work, priority) {
        this.#queue.enqueue(work, priority);
        this.#runSoon();
    }

    #runSoon () {
        if (!this.#pending && !this.#queue.empty) {
            this.#pending = true;
            queueMicrotask(() => this.#run());
        }
    }

    #run () {
        let { maxTimesliceMillis } = this,
            tick = tock(),
            w;

        while ((w = this.#queue.dequeue())) {
            w();

            if (tock() - tick >= maxTimesliceMillis) {
                this.#runSoon();
                break;
            }
        }
    }
}
