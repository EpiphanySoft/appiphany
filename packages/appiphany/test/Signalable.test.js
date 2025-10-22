import { Configurable } from '@appiphany/appiphany';
import { Signalable } from '@appiphany/appiphany/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Signalable', () => {
    it('should basically work', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Foo extends Configurable.mixin(Signalable) {
            static configurable = {
                signals: {
                    foo: 21,

                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        let inst = new Foo();

        expect(inst.signals.foo).to.be(21);
        expect(inst.signals.bar).to.be(210);
        expect(logged()).to.equal([
            'get bar'
        ]);

        expect(inst.signals.foo).to.be(21);
        expect(inst.signals.bar).to.be(210);
        expect(logged()).to.equal([]);

        inst.signals.foo = 42;
        expect(inst.signals.foo).to.be(42);
        expect(inst.signals.bar).to.be(420);
        expect(logged()).to.equal([
            'get bar'
        ]);
    });

    it('should work in a class hierarchy', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Foo extends Configurable.mixin(Signalable) {
            static configurable = {
                signals: {
                    foo: 21
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                signals: {
                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        let inst = new Bar();

        expect(inst.signals.foo).to.be(21);
        expect(inst.signals.bar).to.be(210);
        expect(logged()).to.equal([
            'get bar'
        ]);

        expect(inst.signals.foo).to.be(21);
        expect(inst.signals.bar).to.be(210);
        expect(logged()).to.equal([]);

        inst.signals.foo = 42;
        expect(inst.signals.foo).to.be(42);
        expect(inst.signals.bar).to.be(420);
        expect(logged()).to.equal([
            'get bar'
        ]);
    });

    it('should work in a deep class hierarchy', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Foo extends Configurable.mixin(Signalable) {
            static configurable = {
                signals: {
                    foo: 2
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                signals: {
                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        class Derp extends Bar {
            static configurable = {
                signals: {
                    derp () {
                        log.push('get derp');
                        return this.bar * 3;
                    }
                }
            }
        }

        class Woot extends Derp {
            static configurable = {
                signals: {
                    woot () {
                        log.push('get woot');
                        return this.derp * 5;
                    }
                }
            }
        }

        let inst = new Woot();

        expect(inst.signals.foo).to.be(2);
        expect(inst.signals.bar).to.be(20);
        expect(logged()).to.equal([
            'get bar'
        ]);
        expect(inst.signals.woot).to.be(2 * 10 * 3 * 5);
        expect(logged()).to.equal([
            'get woot',
            'get derp'
        ]);
        expect(inst.signals.derp).to.be(2 * 10 * 3);
        expect(logged()).to.equal([]);

    });

    it('should work in a class and object hierarchy', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Foo extends Configurable.mixin(Signalable) {
            static configurable = {
                signals: {
                    foo: 2
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                signals: {
                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        class Derp extends Configurable.mixin(Signalable) {
            static configurable = {
                signals: {
                    derp: 3
                }
            }
        }

        class Woot extends Derp {
            static configurable = {
                signals: {
                    woot () {
                        log.push('get woot');
                        return this.bar * this.derp * 5;
                    }
                }
            }
        }

        let inst0 = new Bar();
        let inst = new Woot({ parent: inst0 });

        expect(inst.signals.woot).to.be(2 * 10 * 3 * 5);
        expect(logged()).to.equal([
            'get woot',
            'get bar'
        ]);
        expect(inst.signals.derp).to.be(3);
        expect(inst.signals.bar).to.be(20);
        expect(logged()).to.equal([]);
    });
});
