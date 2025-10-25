import { PriorityQueue } from './PriorityQueue.js';
import { Configurable } from './Configurable.js';

const
    tock = () => performance.now();

export class Scheduler extends Configurable {
    static instance = null;

    static configurable = {
        maxTimesliceMillis: 10
    };

    #cycles = 0;
    #pending = false;
    #queue = new PriorityQueue();

    get cycles () {
        return this.#cycles;
    }

    get pending () {
        return this.#pending;
    }

    add (work, priority) {
        this.#queue.enqueue(work, priority);
        this.#runSoon();
    }

    async #run () {
        let { maxTimesliceMillis } = this,
            count = 0,
            queue = this.#queue,
            tick = tock(),
            work;

        ++this.#cycles;

        for (work of queue) {
            ++count;
            await work();

            if (tock() - tick >= maxTimesliceMillis) {
                break;
            }
        }

        count && queue.skip(count);

        this.#pending = false;
        this.#runSoon();  // runSoon checks for queue.empty
    }

    #runSoon () {
        if (!this.#pending && !this.#queue.empty) {
            this.#pending = true;

            queueMicrotask(() => this.#run());
        }
    }
}

Scheduler.instance = new Scheduler();
