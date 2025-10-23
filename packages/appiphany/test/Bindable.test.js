import { Configurable } from '@appiphany/appiphany';
import { Bindable } from '@appiphany/appiphany/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Bindable', () => {
    it('should basically work', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                publish: {
                    foo: 21,

                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        let inst = new Foo();

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(logged()).to.equal([
            'get bar'
        ]);

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(logged()).to.equal([]);

        inst.props.foo = 42;
        expect(inst.props.foo).to.be(42);
        expect(inst.props.bar).to.be(420);
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

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                publish: {
                    foo: 21
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                publish: {
                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        let inst = new Bar();

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(logged()).to.equal([
            'get bar'
        ]);

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(logged()).to.equal([]);

        inst.props.foo = 42;
        expect(inst.props.foo).to.be(42);
        expect(inst.props.bar).to.be(420);
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

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                publish: {
                    foo: 2
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                publish: {
                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        class Derp extends Bar {
            static configurable = {
                publish: {
                    derp () {
                        log.push('get derp');
                        return this.bar * 3;
                    }
                }
            }
        }

        class Woot extends Derp {
            static configurable = {
                publish: {
                    woot () {
                        log.push('get woot');
                        return this.derp * 5;
                    }
                }
            }
        }

        let inst = new Woot();

        expect(inst.props.foo).to.be(2);
        expect(inst.props.bar).to.be(20);
        expect(logged()).to.equal([
            'get bar'
        ]);
        expect(inst.props.woot).to.be(2 * 10 * 3 * 5);
        expect(logged()).to.equal([
            'get woot',
            'get derp'
        ]);
        expect(inst.props.derp).to.be(2 * 10 * 3);
        expect(logged()).to.equal([]);

    });

    it('should work in a class and object hierarchy', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                publish: {
                    foo: 2
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                publish: {
                    bar () {
                        log.push('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        class Derp extends Configurable.mixin(Bindable) {
            static configurable = {
                publish: {
                    derp: 3
                }
            }
        }

        class Woot extends Derp {
            static configurable = {
                bind: {
                    'foo<': 'woot',
                    'foo>': 'derp'
                },

                publish: {
                    woot () {
                        log.push('get woot');
                        return this.bar * this.derp * 5;
                    }
                }
            }
        }

        let inst0 = new Bar();
        let inst = new Woot({ parent: inst0 });

        expect(inst.props.woot).to.be(2 * 10 * 3 * 5);
        expect(logged()).to.equal([
            'get woot',
            'get bar'
        ]);
        expect(inst.props.derp).to.be(3);
        expect(inst.props.bar).to.be(20);
        expect(logged()).to.equal([]);

        inst0 = new Bar();
        inst0.props.foo = 21;
        inst.parent = inst0;

        expect(inst.props.woot).to.be(21 * 10 * 3 * 5);
        expect(logged()).to.equal([
            'get woot',
            'get bar'
        ]);
        expect(inst.props.derp).to.be(3);
        expect(inst.props.bar).to.be(210);
        expect(logged()).to.equal([]);
    });

    it('should support binding', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Parent extends Configurable.mixin(Bindable) {
            static configurable = {
                publish: {
                    foo: 3
                }
            }
        }

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                derp: class {
                    value = null;

                    update (value) {
                         log.push(`set derp ${value}`);
                     }
                },

                woot: class {
                    value = null;

                    update (value) {
                         log.push(`set woot ${value}`);
                     }
                },

                bind: {
                    derp: 'bar',    // formula bind, can only be one-way (read)
                    woot: '~foo'    // value bind, default is read ('~' makes it two-way)
                },

                publish: {
                    bar () {
                        log.push('get bar');
                        return this.foo * 5;
                    }
                }
            }
        }

        let parent = new Parent();
        let inst = new Foo({ parent });

        expect(inst.props.woot).to.be(2 * 10 * 3 * 5);
        expect(logged()).to.equal([
            'get woot',
            'get bar'
        ]);
    });
});
