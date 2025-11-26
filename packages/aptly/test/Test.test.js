
import assertly from 'assertly';
import { mockery } from './utils.js';

const { expect } = assertly;


describe('Test utils', () => {
    describe('mockery', () => {
        it('basic use', () => {
            let mock = mockery();

            mock.returns(42, 427);

            let a = mock('a');
            let b = mock('b', 'c');

            expect(mock.calls).to.equal([
                ['a'],
                ['b', 'c']
            ]);
            expect(a).to.equal(42);
            expect(b).to.equal(427);
        });

        it('method hook', () => {
            let log = [];

            class A {
                foo (...args) {
                    log.push(args);
                    return args[0] * 42;
                }
            }

            let inst = new A();
            let mock = mockery(inst, 'foo');

            let r = inst.foo(10);

            expect(log).to.equal([]);
            expect(r).to.be(undefined);
            expect(mock.calls).to.equal([
                [10]
            ]);

            //------------------------------------------
            mock.clear();
            mock.returns(42);

            r = inst.foo(100, 200);

            expect(log).to.equal([]);
            expect(r).to.be(42);
            expect(mock.calls).to.equal([
                [100, 200]
            ]);

            //------------------------------------------
            mock.clear().detach();

            r = inst.foo(100, 200);

            expect(log).to.equal([
                [100, 200]
            ]);
            expect(r).to.be(4200);
            expect(mock.calls).to.equal([]);

            //------------------------------------------
            mock.clear().callThru().attach();
            log.length = 0;

            r = inst.foo(100, 200);

            expect(log).to.equal([
                [100, 200]
            ]);
            expect(r).to.be(4200);
            expect(mock.calls).to.equal([
                [100, 200]
            ]);
            expect(mock.results).to.equal([
                4200
            ]);
        });
    });
});
