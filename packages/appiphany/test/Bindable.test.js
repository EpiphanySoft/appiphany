import { Configurable, Scheduler } from '@appiphany/appiphany';
import { Bindable } from '@appiphany/appiphany/mixin';

import assertly from 'assertly';
import { logger, sleep, until } from './utils.js';

const { expect } = assertly;

const
    makeRoot = () => {
        class Root extends Configurable.mixin(Bindable) {
            //
        }

        const root = new Root();
        root.scheduler = new Scheduler();

        return root;
    }

describe('Bindable', () => {
    it('should basically work', () => {
        const log = logger();

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    foo: 21,

                    bar () {
                        log.out('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        let inst = new Foo();

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(log.get()).to.equal([
            'get bar'
        ]);

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(log.get()).to.equal([]);

        inst.props.foo = 42;
        expect(inst.props.foo).to.be(42);
        expect(inst.props.bar).to.be(420);
        expect(log.get()).to.equal([
            'get bar'
        ]);

        expect(() => {
            inst.props.derp = 0;
        }).to.throw();
    });

    it('should work in a class hierarchy', () => {
        const log = logger();

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    foo: 21
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                props: {
                    bar () {
                        log.out('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        let inst = new Bar();

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(log.get()).to.equal([
            'get bar'
        ]);

        expect(inst.props.foo).to.be(21);
        expect(inst.props.bar).to.be(210);
        expect(log.get()).to.equal([]);

        inst.props.foo = 42;
        expect(inst.props.foo).to.be(42);
        expect(inst.props.bar).to.be(420);
        expect(log.get()).to.equal([
            'get bar'
        ]);
    });

    it('should work in a deep class hierarchy', () => {
        const log = logger();

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    foo: 2
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                props: {
                    bar () {
                        log.out('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        class Derp extends Bar {
            static configurable = {
                props: {
                    derp () {
                        log.out('get derp');
                        return this.bar * 3;
                    }
                }
            }
        }

        class Woot extends Derp {
            static configurable = {
                props: {
                    woot () {
                        log.out('get woot');
                        return this.derp * 5;
                    }
                }
            }
        }

        let inst = new Woot();

        expect(inst.props.foo).to.be(2);
        expect(inst.props.bar).to.be(20);
        expect(log.get()).to.equal([
            'get bar'
        ]);
        expect(inst.props.woot).to.be(2 * 10 * 3 * 5);
        expect(log.get()).to.equal([
            'get woot',
            'get derp'
        ]);
        expect(inst.props.derp).to.be(2 * 10 * 3);
        expect(log.get()).to.equal([]);

    });

    it('should work in a class and object hierarchy', () => {
        const log = logger();

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    foo: 2
                }
            }
        }

        class Bar extends Foo {
            static configurable = {
                props: {
                    bar () {
                        log.out('get bar');
                        return this.foo * 10;
                    }
                }
            }
        }

        class Derp extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
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

                props: {
                    woot () {
                        log.out('get woot');
                        return this.bar * this.derp * 5;
                    }
                }
            }
        }

        let inst0 = new Bar();
        let inst = new Woot({ parent: inst0 });

        expect(inst.props.woot).to.be(2 * 10 * 3 * 5);
        expect(log.get()).to.equal([
            'get woot',
            'get bar'
        ]);
        expect(inst.props.derp).to.be(3);
        expect(inst.props.bar).to.be(20);
        expect(log.get()).to.equal([]);

        inst0 = new Bar();
        inst0.props.foo = 21;
        inst.parent = inst0;

        expect(inst.props.woot).to.be(21 * 10 * 3 * 5);
        expect(log.get()).to.equal([
            'get woot',
            'get bar'
        ]);
        expect(inst.props.derp).to.be(3);
        expect(inst.props.bar).to.be(210);
        expect(log.get()).to.equal([]);
    });

    it('should support binding', async() => {
        const log = logger();
        const root = makeRoot();

        class Parent extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    foo: 3,
                    wip: 42
                }
            }
        }

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                derp: class {
                    value = null;

                    update (me, value) {
                         log.out(`set derp ${value}`);
                     }
                },

                woot: class {
                    value = null;

                    update (me, value) {
                         log.out(`set woot ${value}`);
                     }
                },

                wop: class {
                    value = null;

                    update (me, value) {
                         log.out(`set wop ${value}`);
                     }
                },

                bind: {
                    derp: 'bar',    // formula bind, can only be one-way (read)
                    woot: '~foo',   // value bind, default is read ('~' makes it two-way)
                    wop: 'wip'      // value bind, default is read
                },

                props: {
                    bar () {
                        log.out('get bar');
                        return this.foo * 5;
                    }
                }
            }
        }

        let parent = new Parent({ parent: root });
        let inst = new Foo({ parent });

        expect(log.get()).to.equal([
            'get bar',
            'set derp 15',
            'set woot 3',
            'set wop 42'
        ]);

        expect(inst.props.foo).to.be(3);
        expect(inst.props.bar).to.be(3 * 5);
        expect(inst.props.wip).to.be(42);

        expect(inst.derp).to.be(3 * 5);
        expect(inst.woot).to.be(3);
        expect(inst.wop).to.be(42);

        parent.props.foo = 10;

        expect(inst.scheduler.pending).to.be(true);
        expect(log.get()).to.equal([
        ]);

        await until(() => log.length === 3);
        await sleep(20);

        expect(log.get()).to.equal([
            'get bar',
            'set derp 50',
            'set woot 10'
        ]);
        expect(inst.scheduler.pending).to.be(false);
        expect(inst.scheduler.cycles).to.be(1);

        expect(inst.derp).to.be(50);
        expect(inst.woot).to.be(10);
        expect(inst.wop).to.be(42);

        parent.props.wip = 427;
        expect(inst.scheduler.pending).to.be(true);

        expect(log.get()).to.equal([
        ]);

        await until(() => log.length === 1);
        await sleep(20);

        expect(log.get()).to.equal([
            'set wop 427'
        ]);
        expect(inst.scheduler.pending).to.be(false);
        expect(inst.scheduler.cycles).to.be(2);

        expect(inst.derp).to.be(50);
        expect(inst.woot).to.be(10);
        expect(inst.wop).to.be(427);
    });

    it('should support binding functions', async() => {
        const log = logger();
        const root = makeRoot();

        class Parent extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    foo: 3
                }
            }
        }

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                woot: class {
                    value = null;

                    update (me, value) {
                         log.out(`set woot ${value}`);
                     }
                },

                bind: {
                    woot () {
                        log.out('calc woot');
                        return this.foo * 5;
                    }
                }
            }
        }

        let parent = new Parent({ parent: root });
        let inst = new Foo({ parent });

        expect(log.get()).to.equal([
            'calc woot',
            'set woot 15'
        ]);

        expect(inst.props.foo).to.be(3);

        expect(inst.woot).to.be(15);

        inst.props.foo = 10;
        expect(parent.props.foo).to.be(10);

        expect(inst.scheduler.pending).to.be(true);
        expect(log.get()).to.equal([
        ]);

        await until(() => log.length === 2);
        await sleep(20);

        expect(log.get()).to.equal([
            'calc woot',
            'set woot 50'
        ]);

        expect(inst.scheduler.pending).to.be(false);
        expect(inst.scheduler.cycles).to.be(1);

        expect(inst.woot).to.be(50);
    });

    it('should handle shadowed and internal props correctly', async() => {
        const root = makeRoot();

        class Parent extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    $: {
                        dip: 3, // unique to this instance
                        dop: 2,

                        wop () {
                            return this.dop * 100;
                        }
                    },

                    foo () {
                        return this.wop * this.dip;
                    }
                }
            }
        }

        class Foo extends Configurable.mixin(Bindable) {
            static configurable = {
                props: {
                    $: {
                        dop: 9,
                        wip: 10,  // unique to this instance

                        wop () {
                            return this.dop * this.wip;
                        }
                    },

                    foo () {
                        return this.wop * 5;
                    }
                }
            }
        }

        let parent = new Parent({ parent: root });
        let inst = new Foo({ parent });
        let getProps = o => ['dip','dop','wip','wop','foo'].map(n => o.props[n]);

        expect(getProps(parent)).to.equal([3, 2, undefined, 200, 600]);
        expect(getProps(inst)).to.equal([undefined, 9, 10, 90, 450]);

        expect(() => {
            inst.props.dip = 0;  // parent internal prop (cannot set)
        }).to.throw();

        inst.props.dop = 7;

        expect(getProps(parent)).to.equal([3, 2, undefined, 200, 600]);
        expect(getProps(inst)).to.equal([undefined, 7, 10, 70, 350]);

        parent.props.dop = 5;

        expect(getProps(parent)).to.equal([3, 5, undefined, 500, 1500]);
        expect(getProps(inst)).to.equal([undefined, 7, 10, 70, 350]);
    });
});
