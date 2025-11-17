import { Declarable } from "@appiphany/aptly";

import assertly from 'assertly';

const { expect } = assertly;

describe('Declarable', () => {
    describe('implements', () => {
        it('should basically work', () => {
            let log = [];

            class Bar {
                foo (a) {}
                bar (x, y) {}
            }

            class Foo extends Declarable.implements(Bar) {
            }

            expect(() => {
                let foo = new Foo();
            }).to.throw('Cannot instantiate class with unimplemented methods (Bar.foo, Bar.bar)');

            expect(!Foo.abstract).to.be(false);

            class Foo2 extends Declarable.implements(Bar) {
                foo (a) {}
            }

            expect(() => {
                let foo = new Foo2();
            }).to.throw('Cannot instantiate class with unimplemented methods (Bar.bar)');

            expect(!Foo2.abstract).to.be(false);

            class Foo3 extends Declarable.implements(Bar) {
                foo (a) {}
                bar (a) {}
            }

            let foo = new Foo3();

            expect(Foo3.abstract).to.be(false);
        });
    });
});
