import { Declarable } from "@appiphany/aptly";

import assertly from 'assertly';

const { expect } = assertly;

describe('Declarable', () => {
    describe('abstract', () => {
        it('should basically work', () => {
            let log = [];

            class Foo extends Declarable {
                static abstract = true;
            }

            expect(() => {
                let foo = new Foo();
            }).to.throw('Cannot create instance of abstract class Foo');
        });

        it('should support abstract methods', () => {
            let log = [];

            class Foo extends Declarable {
                static abstract = {
                    foo (a) {},
                    bar (x, y) {}
                };
            }

            expect(() => {
                let foo = new Foo();
            }).to.throw('Cannot instantiate class with abstract methods (Foo.foo, Foo.bar)');

            expect(!Foo.abstract).to.be(false);

            class Foo2 extends Foo {
                foo (a) {}
            }

            expect(() => {
                let foo = new Foo2();
            }).to.throw('Cannot instantiate class with abstract methods (Foo.bar)');

            expect(!Foo2.abstract).to.be(false);

            class Foo3 extends Foo2 {
                bar (a) {}
            }

            let foo = new Foo3();

            expect(Foo3.abstract).to.be(false);
        });
    });

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
            }).to.throw('Cannot instantiate class with abstract methods (Bar.foo, Bar.bar)');

            expect(!Foo.abstract).to.be(false);

            class Foo2 extends Foo {
                foo (a) {}
            }

            expect(() => {
                let foo = new Foo2();
            }).to.throw('Cannot instantiate class with abstract methods (Bar.bar)');

            expect(!Foo2.abstract).to.be(false);

            class Foo3 extends Foo2 {
                bar (a) {}
            }

            let foo = new Foo3();

            expect(Foo3.abstract).to.be(false);
        });
    });
});
