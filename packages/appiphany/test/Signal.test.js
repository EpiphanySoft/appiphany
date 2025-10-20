import { Signal, Formula } from '@appiphany/appiphany';
import assertly from 'assertly';

const { expect } = assertly;

describe('Signal', () => {
    it('should create a signal', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        let v1 = new Signal.Value(42);
        let v2 = new Signal.Value(100);
        let f1 = new Formula(() => {
            let x = v1.get() * 10;
            log.push(`get f = ${x}`);
            return x;
        });
        let f2 = new Formula(() => {
            let x = f1.get() + v2.get();
            log.push(`get f2 = ${x}`);
            return x;
        });
        let f3 = new Formula(() => {
            let x = f2.get() * 2;
            log.push(`get f3 = ${x}`);
            return x;
        });
        let f4 = new Formula(() => {
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
});
