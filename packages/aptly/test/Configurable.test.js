import { Configurable, Config, applyTo, clone, nop, Signal } from '@appiphany/aptly';
import { Identifiable } from '@appiphany/aptly/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Configurable', () => {
    it('basically works', () => {
        class Foo extends Configurable {
            static proto = {
                herp: 42
            };
        }

        let foo = new Foo();

        expect(foo.herp).to.equal(42);

        let foo2 = new Foo();

        expect(foo2.herp).to.equal(42);

        expect(foo.$meta).to.be(foo2.$meta);
    });

    it('handles arrays', () => {
        class Foo extends Configurable {
            static configurable = {
                herp: class {
                    array = true;
                }
            };
        }

        class Bar extends Foo {
            static configurable = {
                herp: class {
                    herp = true;
                }
            };
        }

        let a = [1, 2, 3];
        let inst = new Foo({ herp: a });
        let inst2 = new Bar({ herp: a });

        expect(inst.herp).to.equal(a);
        expect(inst2.herp).to.equal(a);

        inst.herp = a.slice();
        inst2.herp = a.slice();

        expect(inst.herp).to.be(a);
        expect(inst2.herp).to.be(a);

        expect(inst.$meta.configs.herp.array).to.be(true);
        expect(inst2.$meta.configs.herp.array).to.be(true);

        expect(inst.$meta.configs.herp.herp).to.be(undefined);
        expect(inst2.$meta.configs.herp.herp).to.be(true);
    });

    it('handles flags', () => {
        class Foo extends Configurable {
            static configurable = {
                herp: class extends Config.Flags {
                    //
                }
            };
        }

        let a = { a: true, b: true };
        let foo = new Foo({ herp: a });

        expect(foo.herp).to.equal(a);

        foo.herp = { b: true, a: true };

        expect(foo.herp).to.be(a);

        foo.herp = 'a,b';

        expect(foo.herp).to.be(a);

        foo.herp = ['a', 'b'];

        expect(foo.herp).to.be(a);

        foo.herp = 'a,b,-c';

        expect(foo.herp).to.equal({ a: true, b: true, c: false });

        foo.herp = ['x', 'y'];

        expect(foo.herp).to.equal({ x: true, y: true });
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
            configurable: true
        });

        expect(clone(Bar.is)).to.equal({
            configurable: true,
            bar: true
        });

        expect(Bar.isA('bar')).to.be(true);
        expect(Bar.isA('bar')).to.be(true);
        expect(Bar.isA('bar', 'herp')).to.be(true);

        expect(clone(Baz.is)).to.equal({
            configurable: true,
            bar: true
        });

        expect(Baz.isA('bar')).to.be(true);
        expect(Baz.isA('herp')).to.be(false);
    });

    it('declarable', () => {
        let log = [];

        class Foo extends Configurable {
            static declarable = {
                foo(cls, v) {
                    nop(cls.bar);
                    log.push(['foo', v]);
                },
                bar(cls, v) {
                    nop(cls.baz);
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
                    herp: 42
                });
            }).to.throw('No such property "herp" in class Bar');
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

                            apply(instance, value, was) {
                                log.push(['A.foo.apply', was, value]);
                                instance.herp = value;
                                return value * 10;
                            }

                            update(instance, value, was) {
                                log.push(['A.foo.update', was, value]);
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
                            apply(instance, value, was) {
                                log.push(['> B.foo.apply', was, value]);
                                let ret = super.apply(instance, value, was);
                                log.push(['< B.foo.apply', was, value, ret]);
                                return ret + 7;
                            }

                            update(instance, value, was) {
                                log.push(['> B.foo.update', was, value]);
                                super.update(instance, value, was);
                                log.push(['< B.foo.update', was, value]);
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
                expect(a.herp).to.equal(42);
                expect(a.zip === null).to.be(true);

                expect(log).to.equal([
                    ['A.foo.apply', null, 42],
                    ['A.foo.update', null, 420]
                ]);
            });

            it('should instantiate derived', () => {
                const [A, B, log] = setup();

                let b = new B({
                    foo: 42
                });

                expect(log).to.equal([
                    ['> B.foo.apply', null, 42],
                    ['A.foo.apply', null, 42],
                    ['< B.foo.apply', null, 42, 420],

                    ['> B.foo.update', null, 427],
                    ['A.foo.update', null, 427],
                    ['< B.foo.update', null, 427]
                ]);

                expect(b.foo).to.equal(427);
                expect(b.bar).to.equal(123);
                expect(b.herp).to.equal(42);
                expect(b.zap).to.equal(234);
                expect(b.zip === null).to.be(true);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.herp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12],
                    ['A.foo.apply', 427, 12],
                    ['< B.foo.apply', 427, 12, 120],

                    ['> B.foo.update', 427, 127],
                    ['A.foo.update', 427, 127],
                    ['< B.foo.update', 427, 127]
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
                    ['> B.foo.apply', null, 42],
                    ['A.foo.apply', null, 42],
                    ['< B.foo.apply', null, 42, 420],

                    ['> B.foo.update', null, 427],
                    ['A.foo.update', null, 427],
                    ['< B.foo.update', null, 427],

                    ['A.foo.apply', null, 32],
                    ['A.foo.update', null, 320]
                ]);

                expect(b.foo).to.equal(427);
                expect(b.bar).to.equal(123);
                expect(b.herp).to.equal(42);
                expect(b.zap).to.equal(234);
                expect(b.zip === null).to.be(true);

                expect(a.foo).to.equal(320);
                expect(a.bar).to.equal(321);
                expect(a.herp).to.equal(32);
                expect(a.zip === null).to.be(true);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.herp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12],
                    ['A.foo.apply', 427, 12],
                    ['< B.foo.apply', 427, 12, 120],

                    ['> B.foo.update', 427, 127],
                    ['A.foo.update', 427, 127],
                    ['< B.foo.update', 427, 127]
                ]);

                log.length = 0;
                a.foo = 21;

                expect(a.foo).to.equal(210);
                expect(a.herp).to.equal(21);

                expect(log).to.equal([
                    ['A.foo.apply', 320, 21],
                    ['A.foo.update', 320, 210]
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
                    ['A.foo.apply', null, 32],
                    ['A.foo.update', null, 320],

                    ['> B.foo.apply', null, 42],
                    ['A.foo.apply', null, 42],
                    ['< B.foo.apply', null, 42, 420],

                    ['> B.foo.update', null, 427],
                    ['A.foo.update', null, 427],
                    ['< B.foo.update', null, 427]
                ]);

                expect(a.foo).to.equal(320);
                expect(a.bar).to.equal(321);
                expect(a.herp).to.equal(32);
                expect(a.zip === null).to.be(true);

                expect(b.foo).to.equal(427);
                expect(b.bar).to.equal(123);
                expect(b.herp).to.equal(42);
                expect(b.zap).to.equal(234);
                expect(b.zip === null).to.be(true);

                log.length = 0;
                a.foo = 21;

                expect(a.foo).to.equal(210);
                expect(a.herp).to.equal(21);

                expect(log).to.equal([
                    ['A.foo.apply', 320, 21],
                    ['A.foo.update', 320, 210],
                ]);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.herp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12],
                    ['A.foo.apply', 427, 12],
                    ['< B.foo.apply', 427, 12, 120],

                    ['> B.foo.update', 427, 127],
                    ['A.foo.update', 427, 127],
                    ['< B.foo.update', 427, 127]
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

                            apply(instance, value, was) {
                                log.push(['A.foo.apply', was, value]);
                                instance.herp = value;
                                return value * 10;
                            }

                            update(instance, value, was) {
                                log.push(['A.foo.update', was, value]);
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
                            apply(instance, value, was) {
                                log.push(['> B.foo.apply', was, value]);
                                let ret = super.apply(instance, value, was);
                                log.push(['< B.foo.apply', was, value, ret]);
                                return ret + 7;
                            }

                            update(instance, value, was) {
                                log.push(['> B.foo.update', was, value]);
                                super.update(instance, value, was);
                                log.push(['< B.foo.update', was, value]);
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
                    ['A.foo.apply', null, 314],
                    ['A.foo.update', null, 3140],
                ]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);
                expect(a.herp).to.equal(314);
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
                    ['> B.foo.apply', null, 42],
                    ['A.foo.apply', null, 42],
                    ['< B.foo.apply', null, 42, 420],

                    ['> B.foo.update', null, 427],
                    ['A.foo.update', null, 427],
                    ['< B.foo.update', null, 427]
                ]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);
                expect(b.herp).to.equal(42);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.herp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12],
                    ['A.foo.apply', 427, 12],
                    ['< B.foo.apply', 427, 12, 120],

                    ['> B.foo.update', 427, 127],
                    ['A.foo.update', 427, 127],
                    ['< B.foo.update', 427, 127]
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
                    ['> B.foo.apply', null, 42],
                    ['A.foo.apply', null, 42],
                    ['< B.foo.apply', null, 42, 420],

                    ['> B.foo.update', null, 427],
                    ['A.foo.update', null, 427],
                    ['< B.foo.update', null, 427]
                ]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);
                expect(b.herp).to.equal(42);

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
                    ['A.foo.apply', null, 314],
                    ['A.foo.update', null, 3140],
                ]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);
                expect(a.herp).to.equal(314);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.herp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12],
                    ['A.foo.apply', 427, 12],
                    ['< B.foo.apply', 427, 12, 120],

                    ['> B.foo.update', 427, 127],
                    ['A.foo.update', 427, 127],
                    ['< B.foo.update', 427, 127]
                ]);

                log.length = 0;
                a.foo = 31;

                expect(a.foo).to.equal(310);
                expect(a.herp).to.equal(31);

                expect(log).to.equal([
                    ['A.foo.apply', 3140, 31],
                    ['A.foo.update', 3140, 310]
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
                    ['A.foo.apply', null, 314],
                    ['A.foo.update', null, 3140],
                ]);

                expect(a.bar).to.equal(321);
                expect(a.zip == null).to.be(true);
                expect(a.herp).to.equal(314);

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
                    ['> B.foo.apply', null, 42],
                    ['A.foo.apply', null, 42],
                    ['< B.foo.apply', null, 42, 420],

                    ['> B.foo.update', null, 427],
                    ['A.foo.update', null, 427],
                    ['< B.foo.update', null, 427]
                ]);

                expect(b.bar).to.equal(123);
                expect(b.zip == null).to.be(true);
                expect(b.herp).to.equal(42);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.herp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 427, 12],
                    ['A.foo.apply', 427, 12],
                    ['< B.foo.apply', 427, 12, 120],

                    ['> B.foo.update', 427, 127],
                    ['A.foo.update', 427, 127],
                    ['< B.foo.update', 427, 127]
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

                            apply(instance, value, was) {
                                log.push(['A.foo.apply', was, value]);
                                instance.herp = value;
                                return (value == null) ? value : (value * 10);
                            }

                            update(instance, value, was) {
                                log.push(['A.foo.update', was, value]);
                            }
                        },

                        bar: class {
                            value = 321;
                            nullify = true;

                            apply(instance, value, was) {
                                log.push(['A.bar.apply', was, value]);
                                instance.herp = value;
                                return (value == null) ? value : (value * 100);
                            }

                            update(instance, value, was) {
                                log.push(['A.bar.update', was, value]);
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
                            apply(instance, value, was) {
                                log.push(['> B.foo.apply', was, value]);
                                let ret = super.apply(instance, value, was);
                                log.push(['< B.foo.apply', was, value, ret]);
                                return (value == null) ? value : (ret + 7);
                            }

                            update(instance, value, was) {
                                log.push(['> B.foo.update', was, value]);
                                super.update(instance, value, was);
                                log.push(['< B.foo.update', was, value]);
                            }
                        },

                        bar: class {
                            value = 456;

                            apply(instance, value, was) {
                                log.push(['> B.bar.apply', was, value]);
                                let ret = super.apply(instance, value, was);
                                log.push(['< B.bar.apply', was, value, ret]);
                                return (value == null) ? value : (ret + 3);
                            }

                            update(instance, value, was) {
                                log.push(['> B.bar.update', was, value]);
                                super.update(instance, value, was);
                                log.push(['< B.bar.update', was, value]);
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
                    ['A.bar.apply', null, 427],
                    ['A.bar.update', null, 42700]
                ]);

                log.length = 0;

                expect(a.bar).to.equal(42700);
                expect(a.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(a.foo).to.equal(420);

                expect(log).to.equal([
                    ['A.foo.apply', null, 42],
                    ['A.foo.update', null, 420],
                ]);

                expect(a.bar).to.equal(42700);
                expect(a.zip == null).to.be(true);
                expect(a.herp).to.equal(42);

                log.length = 0;

                let b = new B({
                    foo: 427,
                    bar: 42
                });

                expect(log).to.equal([
                    ['> B.bar.apply', null, 42],
                    ['A.bar.apply', null, 42],
                    ['< B.bar.apply', null, 42, 4200],

                    ['> B.bar.update', null, 4203],
                    ['A.bar.update', null, 4203],
                    ['< B.bar.update', null, 4203]
                ]);

                log.length = 0;

                expect(b.bar).to.equal(4203);
                expect(b.zip == null).to.be(true);

                expect(log).to.equal([]);

                expect(b.foo).to.equal(4277);

                expect(log).to.equal([
                    ['> B.foo.apply', null, 427],
                    ['A.foo.apply', null, 427],
                    ['< B.foo.apply', null, 427, 4270],

                    ['> B.foo.update', null, 4277],
                    ['A.foo.update', null, 4277],
                    ['< B.foo.update', null, 4277]
                ]);

                expect(b.bar).to.equal(4203);
                expect(b.zip == null).to.be(true);
                expect(b.herp).to.equal(427);

                log.length = 0;
                b.foo = 12;

                expect(b.foo).to.equal(127);
                expect(b.herp).to.equal(12);

                expect(log).to.equal([
                    ['> B.foo.apply', 4277, 12],
                    ['A.foo.apply', 4277, 12],
                    ['< B.foo.apply', 4277, 12, 120],

                    ['> B.foo.update', 4277, 127],
                    ['A.foo.update', 4277, 127],
                    ['< B.foo.update', 4277, 127]
                ]);

                log.length = 0;
                a.destroy();

                expect(log).to.equal([
                    '> A.destruct',
                    ['A.foo.apply', 420, null],
                    ['A.foo.update', 420, null],
                    ['A.bar.apply', 42700, null],
                    ['A.bar.update', 42700, null],
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
                    ['A.bar.apply', null, 427],
                    ['A.bar.update', null, 42700]
                ]);

                log.length = 0;
                a.destroy();

                expect(log).to.equal([
                    '> A.destruct',
                    ['A.bar.apply', 42700, null],
                    ['A.bar.update', 42700, null],
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

    it('signalize', () => {
        let log = [];

        class Foo extends Configurable {
            static signalize = true;

            static configurable = {
                foo: null,
                bar: null
            }

            getBar () {
                return this.bar + this.foo?.getBar();
            }
        }

        let inst1 = Foo.new({ bar: 42 });
        let inst2 = Foo.new({ bar: 427, foo: inst1 });

        let o = inst2.$config;
        let o2 = inst2.$config;

        expect(o).to.be(o2);

        let b = inst2.$config.bar;
        expect(b).to.be(427);
    });
});
