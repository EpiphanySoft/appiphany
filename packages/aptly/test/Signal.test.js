import { Signal } from '@appiphany/aptly';
import assertly from 'assertly';

const { expect } = assertly;

describe('Signal', () => {
    it('should basically work', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        let v1 = Signal.value(42);
        let f1 = Signal.formula(() => {
            let x = v1.get() * 10;
            log.push(`get f = ${x}`);
            return x;
        });

        expect(f1.get()).to.be(420);
        expect(logged()).to.equal([
            'get f = 420'
        ]);

        expect(String(v1)).to.be(`<${v1.id}> => [${f1.id}]`);
        expect(String(f1)).to.be(`[${v1.id}] => <${f1.id}> => []`);

        v1.set(21);
        expect(f1.get()).to.be(210);
        expect(logged()).to.equal([
            'get f = 210'
        ]);
    });

    it('should handle multiple related signals', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        let v1 = Signal.value(42);
        let v2 = Signal.value(100);
        let f1 = Signal.formula(() => {
            let x = v1.get() * 10;
            log.push(`get f = ${x}`);
            return x;
        });
        let f2 = Signal.formula(() => {
            let x = f1.get() + v2.get();
            log.push(`get f2 = ${x}`);
            return x;
        });
        let f3 = Signal.formula(() => {
            let x = f2.get() * 2;
            log.push(`get f3 = ${x}`);
            return x;
        });
        let f4 = Signal.formula(() => {
            let x = v2.get() * 2;
            log.push(`get f4 = ${x}`);
            return x;
        });

        expect(f1.get()).to.be(420);
        expect(logged()).to.equal([
            'get f = 420'
        ]);

        expect(f2.get()).to.be(520);
        expect(logged()).to.equal([
            'get f2 = 520'
        ]);

        expect(f3.get()).to.be(1040);
        expect(logged()).to.equal([
            'get f3 = 1040'
        ]);

        expect(f4.get()).to.be(200);
        expect(logged()).to.equal([
            'get f4 = 200'
        ]);

        expect(String(v1)).to.be(`<${v1.id}> => [${f1.id}]`);
        expect(String(v2)).to.be(`<${v2.id}> => [${f2.id}, ${f4.id}]`);
        expect(String(f1)).to.be(`[${v1.id}] => <${f1.id}> => [${f2.id}]`);
        expect(String(f2)).to.be(`[${f1.id}, ${v2.id}] => <${f2.id}> => [${f3.id}]`);
        expect(String(f3)).to.be(`[${f2.id}] => <${f3.id}> => []`);
        expect(String(f4)).to.be(`[${v2.id}] => <${f4.id}> => []`);

        v1.set(21);
        expect(f1.get()).to.be(210);
        expect(logged()).to.equal([
            'get f = 210'
        ]);
        expect(f2.get()).to.be(310);
        expect(logged()).to.equal([
            'get f2 = 310'
        ]);
        expect(f3.get()).to.be(620);
        expect(logged()).to.equal([
            'get f3 = 620'
        ]);
        expect(f4.get()).to.be(200);
        expect(logged()).to.equal([]);
    });

    it('should be watchable', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        let v1 = Signal.value(42);
        let f1 = Signal.formula(() => {
            let x = v1.get() * 10;
            log.push(`get f = ${x}`);
            return x;
        });
        let w = Signal.watch(() => {
            log.push(`notified ${w.id}`);
        });

        w.watch(f1);

        expect(f1.get()).to.be(420);
        expect(logged()).to.equal([
            'get f = 420'
        ]);

        expect(String(v1)).to.be(`<${v1.id}> => [${f1.id}]`);
        expect(String(f1)).to.be(`[${v1.id}] => <${f1.id}> => []`);

        v1.set(21);

        let pending = w.getPending();
        expect(pending.length).to.be(1);
        expect(pending[0]).to.be(f1);
        expect(f1.get()).to.be(210);

        expect(logged()).to.equal([
            `notified ${w.id}`,
            'get f = 210'
        ]);

        pending = w.getPending();
        expect(pending.length).to.be(0);

        v1.set(427);
        expect(f1.get()).to.be(4270);
        expect(logged()).to.equal([
            // no 'notified 1' because we didn't call w.watch() to clear watcher state
            'get f = 4270'
        ]);

        w.watch();
        v1.set(77);

        pending = w.getPending();
        expect(pending.length).to.be(1);
        expect(pending[0]).to.be(f1);

        expect(f1.get()).to.be(770);
        expect(logged()).to.equal([
            `notified ${w.id}`,
            'get f = 770'
        ]);
    });
});
