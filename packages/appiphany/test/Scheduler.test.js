import { Scheduler } from '@appiphany/appiphany';

import assertly from 'assertly';
import { sleep, until } from './utils.js';

const { expect } = assertly;

describe('Scheduler', () => {
    it('should basically work', async () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        let scheduler = new Scheduler();

        scheduler.add(() => { log.push('a'); });
        scheduler.add(() => { log.push('b'); });

        expect(logged()).to.equal([]);

        await sleep(10);

        expect(logged()).to.equal([
            'a',
            'b'
        ]);

        scheduler.add(async() => {
            log.push(['c', scheduler.cycles]);
            await sleep(20);
        });

        scheduler.add(() => { log.push(['d', scheduler.cycles]); });

        expect(logged()).to.equal([]);

        await until(() =>
            log.length === 2);

        expect(scheduler.cycles).to.equal(3);
        expect(logged()).to.equal([
            ['c', 2],
            ['d', 3]
        ]);
    });
});
