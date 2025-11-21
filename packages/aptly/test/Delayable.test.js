import { Configurable, thenable, Timer } from '@appiphany/aptly';
import { Delayable } from '@appiphany/aptly/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Delayable', () => {
    it('should basically work', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                foo: 42
            };

            foo (arg) {
                log.push(arg);
            }
        }

        let foo = Foo.new();

        expect(foo.foo.timer).to.be.a(Timer);
        expect(foo.foo.timer.pending).to.be(false);

        let promise = foo.foo(42);

        expect(thenable(promise)).to.be(true);
        expect(log).to.equal([]);

        expect(foo.foo.timer.pending).to.be(true);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });

    it('should support asap', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: true
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let foo = Foo.new();

        expect(foo.bar.timer).to.be.a(Timer.types.asap);
        expect(foo.bar.timer.pending).to.be(false);

        let promise = foo.bar(42);

        expect(thenable(promise)).to.be(true);
        expect(log).to.equal([]);

        expect(foo.bar.timer.pending).to.be(true);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });

    it('should support asap as string', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                derp: 'asap'
            };

            derp (arg) {
                log.push(arg);
            }
        }

        let foo = Foo.new();

        expect(foo.derp.timer).to.be.a(Timer.types.asap);
        expect(foo.derp.timer.pending).to.be(false);

        let promise = foo.derp(42);

        expect(thenable(promise)).to.be(true);
        expect(log).to.equal([]);

        expect(foo.derp.timer.pending).to.be(true);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });

    it('should support scheduler', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                woot: 'sched'
            };

            woot (arg) {
                log.push(arg);
            }
        }

        let foo = Foo.new();

        expect(foo.woot.timer).to.be.a(Timer.types.sched);
        expect(foo.woot.timer.pending).to.be(false);

        let promise = foo.woot(42);

        expect(thenable(promise)).to.be(true);
        expect(log).to.equal([]);

        expect(foo.woot.timer.pending).to.be(true);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });

    it('should support cancel', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: true
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar(42);

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);

        inst.bar.timer.cancel();

        expect(inst.bar.timer.pending).to.be(false);

        let ok = await promise;

        expect(ok).to.be(false);
        expect(log).to.equal([]);
    });

    it('should support disabled', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: {
                    type: 'asap',
                    disabled: true
                }
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar(42);

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(false);
        expect(promise === false).to.be(true);
    });

    it('should support immediate', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: {
                    type: 'asap',
                    immediate: true
                }
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar(42);

        expect(log).to.equal([42]);
        expect(inst.bar.timer.pending).to.be(false);
        expect(promise === true).to.be(true);

        // mimics non-immediate
        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });

    it('should support now()', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: 'asap'
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar.now(42);

        expect(log).to.equal([42]);
        expect(inst.bar.timer.pending).to.be(false);
        expect(promise === true).to.be(true);

        // mimics non-immediate
        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });

    it('should support now() when disabled', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: 'asap'
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);
        expect(inst.bar.timer.disabled).to.be(false);

        inst.bar.timer.disabled = true;

        let promise = inst.bar.now(42);

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(false);
        expect(promise === false).to.be(true);

        // mimics non-immediate
        let ok = await promise;

        expect(ok).to.be(false);
        expect(log).to.equal([]);
    });

    it('should support multiple calls', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: true
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar(42);
        let tid = inst.bar.timer.timerId;

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);

        let promise2 = inst.bar(427);

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);
        expect(promise2 === promise).to.be(true);
        expect(inst.bar.timer.timerId).to.equal(tid);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });

    it('should support restartable args w/multiple calls', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: {
                    type: 'asap',
                    restartable: 'a'
                }
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar(42);
        let tid = inst.bar.timer.timerId;

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);

        let promise2 = inst.bar(427);

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);
        expect(promise2 === promise).to.be(true);
        expect(inst.bar.timer.timerId).to.equal(tid);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([427]);
    });

    it('should support restartable timer w/multiple calls', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: {
                    type: 'asap',
                    restartable: 't'
                }
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar(427);
        let tid = inst.bar.timer.timerId;

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);

        inst.bar(42);

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);
        expect(inst.bar.timer.timerId).not.to.equal(tid);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([427]);
    });

    it('should support restartable args & timer w/multiple calls', async() => {
        let log = [];

        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                bar: {
                    type: 'asap',
                    restartable: 'at'
                }
            };

            bar (arg) {
                log.push(arg);
            }
        }

        let inst = Foo.new();

        expect(inst.bar.timer).to.be.a(Timer.types.asap);
        expect(inst.bar.timer.pending).to.be(false);

        let promise = inst.bar(427);
        let tid = inst.bar.timer.timerId;

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);

        inst.bar(42);

        expect(log).to.equal([]);
        expect(inst.bar.timer.pending).to.be(true);
        expect(inst.bar.timer.timerId).not.to.equal(tid);

        let ok = await promise;

        expect(ok).to.be(true);
        expect(log).to.equal([42]);
    });
});
