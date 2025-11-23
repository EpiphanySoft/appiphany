import { Configurable, Config, applyTo, clone, ignore } from '@appiphany/aptly';
import { Identifiable } from '@appiphany/aptly/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Configurable', () => {
    it('basically works', () => {
        class Foo extends Configurable {
            static proto = {
                derp: 42
            };
        }

        let foo = new Foo();

        expect(foo.derp).to.equal(42);

        let foo2 = new Foo();

        expect(foo2.derp).to.equal(42);

        expect(foo.$meta).to.be(foo2.$meta);
    });

    it('handles arrays', () => {
        class Foo extends Configurable {
            static configurable = {
                derp: class {
                    array = true;
                }
            };
        }

        let a = [1, 2, 3];
        let foo = new Foo({ derp: a });

        expect(foo.derp).to.equal(a);

        foo.derp = a.slice();

        expect(foo.derp).to.be(a);
    });

    it('handles flags', () => {
        class Foo extends Configurable {
            static configurable = {
                derp: class extends Config.Flags {
                    //
                }
            };
        }

        let a = { a: true, b: true };
        let foo = new Foo({ derp: a });

        expect(foo.derp).to.equal(a);

        foo.derp = { b: true, a: true };

        expect(foo.derp).to.be(a);

        foo.derp = 'a,b';

        expect(foo.derp).to.be(a);

        foo.derp = ['a', 'b'];

        expect(foo.derp).to.be(a);

        foo.derp = 'a,b,-c';

        expect(foo.derp).to.equal({ a: true, b: true, c: false });

        foo.derp = ['x', 'y'];

        expect(foo.derp).to.equal({ x: true, y: true });
    });

    it('className', () => {
        class Foo extends Configurable {
            //
        }

        class Bar extends Foo {
            static className = 'BAR';
        }

        class Baz extends Bar {
            //
        }

        Baz.initClass();

        expect(Configurable.className).to.equal('Configurable');
        expect(Foo.className).to.equal('Foo');
        expect(Bar.className).to.equal('BAR');
        expect(Baz.className).to.equal('Baz');

        expect(clone(Foo.is)).to.equal({
        });

        expect(clone(Bar.is)).to.equal({
            bar: true
        });

        expect(Bar.isA('bar')).to.be(true);
        expect(Bar.isA('bar')).to.be(true);
        expect(Bar.isA('bar', 'derp')).to.be(true);

        expect(clone(Baz.is)).to.equal({
            bar: true
        });

        expect(Baz.isA('bar')).to.be(true);
        expect(Baz.isA('derp')).to.be(false);
    });

    it('declarable', () => {
        let log = [];

        class Foo extends Configurable {
            static declarable = {
                foo(cls, v) {
                    ignore(cls.bar);
                    log.push(['foo', v]);
                },
                bar(cls, v) {
                    ignore(cls.baz);
                    log.push(['bar', v]);
                },
                baz(cls, v) {
                    log.push(['baz', v]);
                }
            };
        }

        class Bar extends Foo {
            static foo = 3;
            static bar = 2;
            static baz = 1;
        }

        Bar.initClass();

        expect(log).to.equal([
            ['baz', 1],
            ['bar', 2],
            ['foo', 3],
        ]);
    });

    describe('expando', () => {
        it('should throw when expando is disallowed', () => {
            let log = [];

            class Foo extends Configurable {
                static configurable = {
                    foo: null
                };
            }

            expect(() => {
                let foo = new Foo({
                    bar: 42
                });
            }).to.throw('No such property "bar" in class Foo');
        });

        it('should not throw when expando is allowed', () => {
            let log = [];

            class Foo extends Configurable {
                static configurable = {
                    foo: null
                };
            }

            class Bar extends Foo {
                static expando = true;
            }

            let bar = new Bar({
                bar: 42
            });

            expect(bar.bar).to.equal(42);
        });

        it('should handle explicit expandos', () => {
            let log = [];

            class Foo extends Configurable {
                static configurable = {
                    foo: null
                };
            }

            class Bar extends Foo {
                static expando = ['bar'];
            }

            let inst;

            inst = new Bar({
                foo: 427,
                bar: 42
            });

            expect(inst.foo).to.equal(427);
            expect(inst.bar).to.equal(42);

            expect(() => {
                inst = new Bar({
                    derp: 42
                });
            }).to.throw('No such property "derp" in class Bar');
        });
    });

    describe('configurable', () => {
        describe('basics', () => {
            const setup = () => {
                const log = [];

                class A extends Configurable {
                    static configurable = {
                        foo: class {
                            value = 123;

                            apply(instance, value, was, firstTime) {
                                log.push(['A.foo.apply', was, value, firstTime]);
                                instance.derp = value;
                                return value * 10;
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['A.foo.update', was, value, firstTime]);
                            }
                        },

                        bar: 321,

                        zip: class {
                            value = null;
                        }
                    };
                }

                class B extends A {
                    static configurable = {
                        foo: class {
                            apply(instance, value, was, firstTime) {
                                log.push(['> B.foo.apply', was, value, firstTime]);
                                let ret = super.apply(instance, value, was, firstTime);
                                log.push(['< B.foo.apply', was, value, ret, firstTime]);
                                return ret + 7;
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['> B.foo.update', was, value, firstTime]);
                                super.update(instance, value, was, firstTime);
                                log.push(['< B.foo.update', was, value, firstTime]);
                            }
                        },

                        bar: 123,
                        zap: 234
                    };
                }

                return [A, B, log];
            };

            it('should instantiate base', () => {
                const [A, B, log] = setup();

                let a = new A({
                    foo: 42
                });

                expect(a.foo).to.equal(420);
                expect(a.bar).to.equal(321);
                expect(a.derp).to.equal(42);
                expect(a.zip === null).to.be(true);

                expect(log).to.equal([
                    ['A.foo.apply', null, 42, true],
                    ['A.foo.update', null, 420, true]
                ]);
            });

            it('should instantiate derived', () => {
                const [A, B, log] = setup();

                let b = new B({
                    foo: 42
                });

                expect(log).to.equal([
                    ['> B.foo.apply', null, 42, true],
                    ['A.foo.apply', null, 42, true],
                    ['< B.foo.apply', null, 42, 420, true],

                    ['> B.foo.update', null, 427, true],
                    ['A.foo.update', null, 427, true],
                    ['< B.foo.update', null, 427, true]
                ]);

                expect(b.foo).to.equal(427);
                expect(b.bar).to.equal(123);
                expect(b.derp).to.equal(42);
                expect(b.zap).to.equal(234);
                expect(b.zip === null).to.be(true);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.derp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12, false],
                    ['A.foo.apply', 427, 12, false],
                    ['< B.foo.apply', 427, 12, 120, false],

                    ['> B.foo.update', 427, 127, false],
                    ['A.foo.update', 427, 127, false],
                    ['< B.foo.update', 427, 127, false]
                ]);
            });

            it('should instantiate derived then base', () => {
                const [A, B, log] = setup();

                let b = new B({
                    foo: 42
                });
                let a = new A({
                    foo: 32
                });

                expect(log).to.equal([
                    ['> B.foo.apply', null, 42, true],
                    ['A.foo.apply', null, 42, true],
                    ['< B.foo.apply', null, 42, 420, true],

                    ['> B.foo.update', null, 427, true],
                    ['A.foo.update', null, 427, true],
                    ['< B.foo.update', null, 427, true],

                    ['A.foo.apply', null, 32, true],
                    ['A.foo.update', null, 320, true]
                ]);

                expect(b.foo).to.equal(427);
                expect(b.bar).to.equal(123);
                expect(b.derp).to.equal(42);
                expect(b.zap).to.equal(234);
                expect(b.zip === null).to.be(true);

                expect(a.foo).to.equal(320);
                expect(a.bar).to.equal(321);
                expect(a.derp).to.equal(32);
                expect(a.zip === null).to.be(true);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.derp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12, false],
                    ['A.foo.apply', 427, 12, false],
                    ['< B.foo.apply', 427, 12, 120, false],

                    ['> B.foo.update', 427, 127, false],
                    ['A.foo.update', 427, 127, false],
                    ['< B.foo.update', 427, 127, false]
                ]);

                log.length = 0;
                a.foo = 21;

                expect(a.foo).to.equal(210);
                expect(a.derp).to.equal(21);

                expect(log).to.equal([
                    ['A.foo.apply', 320, 21, false],
                    ['A.foo.update', 320, 210, false]
                ]);
            });

            it('should instantiate base then derived', () => {
                const [A, B, log] = setup();

                let a = new A({
                    foo: 32
                });
                let b = new B({
                    foo: 42
                });

                expect(log).to.equal([
                    ['A.foo.apply', null, 32, true],
                    ['A.foo.update', null, 320, true],

                    ['> B.foo.apply', null, 42, true],
                    ['A.foo.apply', null, 42, true],
                    ['< B.foo.apply', null, 42, 420, true],

                    ['> B.foo.update', null, 427, true],
                    ['A.foo.update', null, 427, true],
                    ['< B.foo.update', null, 427, true]
                ]);

                expect(a.foo).to.equal(320);
                expect(a.bar).to.equal(321);
                expect(a.derp).to.equal(32);
                expect(a.zip === null).to.be(true);

                expect(b.foo).to.equal(427);
                expect(b.bar).to.equal(123);
                expect(b.derp).to.equal(42);
                expect(b.zap).to.equal(234);
                expect(b.zip === null).to.be(true);

                log.length = 0;
                a.foo = 21;

                expect(a.foo).to.equal(210);
                expect(a.derp).to.equal(21);

                expect(log).to.equal([
                    ['A.foo.apply', 320, 21, false],
                    ['A.foo.update', 320, 210, false],
                ]);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.derp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12, false],
                    ['A.foo.apply', 427, 12, false],
                    ['< B.foo.apply', 427, 12, 120, false],

                    ['> B.foo.update', 427, 127, false],
                    ['A.foo.update', 427, 127, false],
                    ['< B.foo.update', 427, 127, false]
                ]);
            });
        });

        describe('lazy', () => {
            const setup = () => {
                const log = [];

                class A extends Configurable {
                    static configurable = {
                        foo: class {
                            value = 123;
                            phase = 'get';

                            apply(instance, value, was, firstTime) {
                                log.push(['A.foo.apply', was, value, firstTime]);
                                instance.derp = value;
                                return value * 10;
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['A.foo.update', was, value, firstTime]);
                            }
                        },

                        bar: 321,

                        zip: class {
                            value = null;
                        }
                    };
                }

                class B extends A {
                    static configurable = {
                        foo: class {
                            apply(instance, value, was, firstTime) {
                                log.push(['> B.foo.apply', was, value, firstTime]);
                                let ret = super.apply(instance, value, was, firstTime);
                                log.push(['< B.foo.apply', was, value, ret, firstTime]);
                                return ret + 7;
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['> B.foo.update', was, value, firstTime]);
                                super.update(instance, value, was, firstTime);
                                log.push(['< B.foo.update', was, value, firstTime]);
                            }
                        },

                        bar: 123
                    };
                }

                return [A, B, log];
            };

            it('instantiate base class', () => {
                const [A, B, log] = setup();

                let a = new A({
                    foo: 314
                });

                expect(log).to.equal([]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(a.foo).to.equal(3140);

                expect(log).to.equal([
                    ['A.foo.apply', null, 314, true],
                    ['A.foo.update', null, 3140, true],
                ]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);
                expect(a.derp).to.equal(314);
            });

            it('instantiate derived class', () => {
                const [A, B, log] = setup();

                let b = new B({
                    foo: 42
                });

                expect(log).to.equal([]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(b.foo).to.equal(427);

                expect(log).to.equal([
                    ['> B.foo.apply', null, 42, true],
                    ['A.foo.apply', null, 42, true],
                    ['< B.foo.apply', null, 42, 420, true],

                    ['> B.foo.update', null, 427, true],
                    ['A.foo.update', null, 427, true],
                    ['< B.foo.update', null, 427, true]
                ]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);
                expect(b.derp).to.equal(42);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.derp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12, false],
                    ['A.foo.apply', 427, 12, false],
                    ['< B.foo.apply', 427, 12, 120, false],

                    ['> B.foo.update', 427, 127, false],
                    ['A.foo.update', 427, 127, false],
                    ['< B.foo.update', 427, 127, false]
                ]);
            });

            it('instantiate derived class then base', () => {
                const [A, B, log] = setup();

                let b = new B({
                    foo: 42
                });

                expect(log).to.equal([]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(b.foo).to.equal(427);

                expect(log).to.equal([
                    ['> B.foo.apply', null, 42, true],
                    ['A.foo.apply', null, 42, true],
                    ['< B.foo.apply', null, 42, 420, true],

                    ['> B.foo.update', null, 427, true],
                    ['A.foo.update', null, 427, true],
                    ['< B.foo.update', null, 427, true]
                ]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);
                expect(b.derp).to.equal(42);

                log.length = 0;

                let a = new A({
                    foo: 314
                });

                expect(log).to.equal([]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(a.foo).to.equal(3140);

                expect(log).to.equal([
                    ['A.foo.apply', null, 314, true],
                    ['A.foo.update', null, 3140, true],
                ]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);
                expect(a.derp).to.equal(314);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.derp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12, false],
                    ['A.foo.apply', 427, 12, false],
                    ['< B.foo.apply', 427, 12, 120, false],

                    ['> B.foo.update', 427, 127, false],
                    ['A.foo.update', 427, 127, false],
                    ['< B.foo.update', 427, 127, false]
                ]);

                log.length = 0;
                a.foo = 31;

                expect(a.foo).to.equal(310);
                expect(a.derp).to.equal(31);

                expect(log).to.equal([
                    ['A.foo.apply', 3140, 31, false],
                    ['A.foo.update', 3140, 310, false]
                ]);
            });

            it('instantiate base class then derived', () => {
                const [A, B, log] = setup();

                let a = new A({
                    foo: 314
                });

                expect(log).to.equal([]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(a.foo).to.equal(3140);

                expect(log).to.equal([
                    ['A.foo.apply', null, 314, true],
                    ['A.foo.update', null, 3140, true],
                ]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);
                expect(a.derp).to.equal(314);

                log.length = 0;

                let b = new B({
                    foo: 42
                });

                expect(log).to.equal([]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(b.foo).to.equal(427);

                expect(log).to.equal([
                    ['> B.foo.apply', null, 42, true],
                    ['A.foo.apply', null, 42, true],
                    ['< B.foo.apply', null, 42, 420, true],

                    ['> B.foo.update', null, 427, true],
                    ['A.foo.update', null, 427, true],
                    ['< B.foo.update', null, 427, true]
                ]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);
                expect(b.derp).to.equal(42);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.derp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12, false],
                    ['A.foo.apply', 427, 12, false],
                    ['< B.foo.apply', 427, 12, 120, false],

                    ['> B.foo.update', 427, 127, false],
                    ['A.foo.update', 427, 127, false],
                    ['< B.foo.update', 427, 127, false]
                ]);
            });
        });

        describe('nullify', () => {
            const setup = () => {
                const log = [];

                class A extends Configurable {
                    static configurable = {
                        foo: class {
                            value = 123;
                            nullify = true;
                            phase = 'get';

                            apply(instance, value, was, firstTime) {
                                log.push(['A.foo.apply', was, value, firstTime]);
                                instance.derp = value;
                                return (value == null) ? value : (value * 10);
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['A.foo.update', was, value, firstTime]);
                            }
                        },

                        bar: class {
                            value = 321;
                            nullify = true;

                            apply(instance, value, was, firstTime) {
                                log.push(['A.bar.apply', was, value, firstTime]);
                                instance.derp = value;
                                return (value == null) ? value : (value * 100);
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['A.bar.update', was, value, firstTime]);
                            }
                        },

                        zip: class {
                            value = null;
                        }
                    };

                    destruct() {
                        log.push('> A.destruct');
                        super.destruct();
                        log.push('< A.destruct');
                    }
                }

                class B extends A {
                    static configurable = {
                        foo: class {
                            apply(instance, value, was, firstTime) {
                                log.push(['> B.foo.apply', was, value, firstTime]);
                                let ret = super.apply(instance, value, was, firstTime);
                                log.push(['< B.foo.apply', was, value, ret, firstTime]);
                                return (value == null) ? value : (ret + 7);
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['> B.foo.update', was, value, firstTime]);
                                super.update(instance, value, was, firstTime);
                                log.push(['< B.foo.update', was, value, firstTime]);
                            }
                        },

                        bar: class {
                            value = 456;

                            apply(instance, value, was, firstTime) {
                                log.push(['> B.bar.apply', was, value, firstTime]);
                                let ret = super.apply(instance, value, was, firstTime);
                                log.push(['< B.bar.apply', was, value, ret, firstTime]);
                                return (value == null) ? value : (ret + 3);
                            }

                            update(instance, value, was, firstTime) {
                                log.push(['> B.bar.update', was, value, firstTime]);
                                super.update(instance, value, was, firstTime);
                                log.push(['< B.bar.update', was, value, firstTime]);
                            }
                        }
                    };

                    destruct() {
                        log.push('> B.destruct');
                        super.destruct();
                        log.push('< B.destruct');
                    }
                }

                return [A, B, log];
            };

            it('instantiate base class then derived', () => {
                const [A, B, log] = setup();

                let a = new A({
                    foo: 42,
                    bar: 427
                });

                expect(log).to.equal([
                    ['A.bar.apply', null, 427, true],
                    ['A.bar.update', null, 42700, true]
                ]);

                log.length = 0;

                expect(a.bar).to.equal(42700);
                expect(a.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(a.foo).to.equal(420);

                expect(log).to.equal([
                    ['A.foo.apply', null, 42, true],
                    ['A.foo.update', null, 420, true],
                ]);

                expect(a.bar).to.equal(42700);
                expect(a.zip == null).to.be(true);
                expect(a.derp).to.equal(42);

                log.length = 0;

                let b = new B({
                    foo: 427,
                    bar: 42
                });

                expect(log).to.equal([
                    ['> B.bar.apply', null, 42, true],
                    ['A.bar.apply', null, 42, true],
                    ['< B.bar.apply', null, 42, 4200, true],

                    ['> B.bar.update', null, 4203, true],
                    ['A.bar.update', null, 4203, true],
                    ['< B.bar.update', null, 4203, true]
                ]);

                log.length = 0;

                expect(b.bar).to.equal(4203);
                expect(b.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(b.foo).to.equal(4277);

                expect(log).to.equal([
                    ['> B.foo.apply', null, 427, true],
                    ['A.foo.apply', null, 427, true],
                    ['< B.foo.apply', null, 427, 4270, true],

                    ['> B.foo.update', null, 4277, true],
                    ['A.foo.update', null, 4277, true],
                    ['< B.foo.update', null, 4277, true]
                ]);

                expect(b.bar).to.equal(4203);
                expect(b.zip == null).to.be(true);
                expect(b.derp).to.equal(427);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.derp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 4277, 12, false],
                    ['A.foo.apply', 4277, 12, false],
                    ['< B.foo.apply', 4277, 12, 120, false],

                    ['> B.foo.update', 4277, 127, false],
                    ['A.foo.update', 4277, 127, false],
                    ['< B.foo.update', 4277, 127, false]
                ]);

                log.length = 0;
                a.destroy();

                expect(log).to.equal([
                    '> A.destruct',
                    ['A.foo.apply', 420, null, false],
                    ['A.foo.update', 420, null, false ],
                    ['A.bar.apply', 42700, null, false],
                    ['A.bar.update', 42700, null, false ],
                    '< A.destruct'
                ]);

                expect(applyTo({}, A.$meta.nullify)).to.equal({
                    foo: true,
                    bar: true
                });
            });

            it('should not nullify uninitialized prop', () => {
                const [A, B, log] = setup();

                let a = new A({
                    foo: 42,
                    bar: 427
                });

                expect(log).to.equal([
                    ['A.bar.apply', null, 427, true],
                    ['A.bar.update', null, 42700, true]
                ]);

                log.length = 0;
                a.destroy();

                expect(log).to.equal([
                    '> A.destruct',
                    ['A.bar.apply', 42700, null, false],
                    ['A.bar.update', 42700, null, false ],
                    '< A.destruct'
                ]);
            });
        });
    });

    it('mixin', () => {
        let log = [];

        const Mixin = Base => class Mixin extends Base {
            static declarable = {
                bar(cls, value) {
                    log.push([cls.className, 'bar', value]);
                }
            }
        };

        class Foo extends Configurable.mixin(Mixin) {
            static bar = 427;
        }

        new Foo();
        new Foo();

        expect(log).to.equal([
            ['Foo', 'bar', 427]
        ]);
    });

    it('mixin using mixin', () => {
        let log = [];

        const Mixin1 = Base => class Mixin1 extends Base {
        };

        const Mixin2 = Base => class Mixin2 extends Base.mixin(Mixin1) {
        };

        const Mixin3 = Base => class Mixin3 extends Base.mixin(Mixin1) {
        };

        class Foo extends Configurable.mixin(Mixin1, Mixin2, Mixin3) {
        }

        let inst = Foo.new();

        for (let meta = inst.$meta; meta; meta = meta.super) {
            log.push(meta.name);
        }

        expect(log.reverse()).to.equal([
            'Declarable',
            'Configurable',
            'Mixin1',
            'Mixin3',
            'Mixin2',
            'Foo'
        ]);
    });

    it('onConfigChange', () => {
        let log = [];

        class Foo extends Configurable {
            static configurable = {
                foo: null,
                bar: null
            }

            onConfigChange (name) {
                log.push([name, this[name]]);
            }
        }

        let inst = Foo.new({ foo: 42, bar: 427 });

        expect(log).to.equal([]);

        inst.foo = 1;

        expect(log).to.equal([
            ['foo', 1]
        ]);
        log.length = 0;

        inst.configure({ foo: 3, bar: 2 });
        log.sort((a, b) => a[0].localeCompare(b[0]));

        expect(log).to.equal([
            ['bar', 2],
            ['foo', 3]
        ]);
    });

    describe('Identifiable', () => {
        it('should work', () => {
            let log = [];

            class Foo extends Configurable.mixin(Identifiable) {
                static className = 'Foo';
            }

            let inst1 = new Foo();
            let inst2 = new Foo();

            expect(inst1.id).to.equal('foo-1');
            expect(inst2.id).to.equal('foo-2');
        });
    });
});
