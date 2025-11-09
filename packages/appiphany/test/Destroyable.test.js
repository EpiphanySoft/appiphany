import { Destroyable, panik, SKIP, sleep, thenable } from "@appiphany/appiphany";

import assertly from 'assertly';

const { expect } = assertly;

describe('Destroyable', () => {
    describe('Life-cycle', () => {
        it('should basically work', () => {
            let log = [];

            class Foo extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                initialize(...args) {
                    let s = args.length ? ': ' + args.join(', ') : '';
                    log.push([
                        `initialize ${this.x}${s}`,
                        this.initializing,
                        this.initialized
                    ]);

                    return {};  // Destroyable wraps initialize() and returns "this"
                }

                destruct() {
                    log.push([
                        `destruct ${this.x}`,
                        this.destructing,
                        this.destructed,
                        this.destroyed
                    ]);
                }
            }

            let foo = new Foo(1);

            expect(log).to.equal([]);
            expect(foo.initializing).to.be(false);
            expect(foo.initialized).to.be(false);
            expect(foo.destructing).to.be(false);
            expect(foo.destructed).to.be(false);
            expect(foo.destroyed).to.be(false);

            let ret = foo.initialize('a', 'b');

            expect(ret === foo).to.be(true);
            expect(foo.initializing).to.be(false);
            expect(foo.initialized).to.be(true);
            expect(log).to.equal([
                ['initialize 1: a, b', true, false]
            ]);

            ret = foo.initialize();
            expect(ret === foo).to.be(true);
            expect(foo.initializing).to.be(false);
            expect(foo.initialized).to.be(true);
            expect(log).to.equal([
                ['initialize 1: a, b', true, false]
            ]);

            foo.destroy();

            expect(foo.destructing).to.be(false);
            expect(foo.destructed).to.be(true);
            expect(foo.destroyed).to.be(true);
            expect(log).to.equal([
                ['initialize 1: a, b', true, false],
                ['destruct 1', true, false, true]
            ]);

            foo.destroy();

            expect(foo.destructing).to.be(false);
            expect(foo.destructed).to.be(true);
            expect(foo.destroyed).to.be(true);
            expect(log).to.equal([
                ['initialize 1: a, b', true, false],
                ['destruct 1', true, false, true]
            ]);
        });

        it('should basically work async', async() => {
            let log = [];

            class Foo extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                async initialize(...args) {
                    await sleep(1);

                    let s = args.length ? ': ' + args.join(', ') : '';
                    log.push([
                        `initialize ${this.x}${s}`,
                        this.initializing,
                        this.initialized
                    ]);

                    return {};  // Destroyable wraps initialize() and returns "this"
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }
            }

            let foo = new Foo(1);

            expect(log).to.equal([]);
            expect(foo.initializing).to.be(false);
            expect(foo.initialized).to.be(false);

            let ret = foo.initialize('a', 'b');

            expect(thenable(ret)).to.be(true);
            expect(foo.initializing).to.be(true);
            expect(foo.initialized).to.be(false);

            let inst = await ret;

            expect(inst === foo).to.be(true);
            expect(foo.initializing).to.be(false);
            expect(foo.initialized).to.be(true);
            expect(log).to.equal([
                ['initialize 1: a, b', true, false]
            ]);

            let ret2 = foo.initialize();

            expect(ret === ret2).to.be(true);  // same promise
            expect(foo.initializing).to.be(false);
            expect(foo.initialized).to.be(true);

            inst = await ret;

            expect(inst === foo).to.be(true);
            expect(foo.initializing).to.be(false);
            expect(foo.initialized).to.be(true);
            expect(log).to.equal([
                ['initialize 1: a, b', true, false]
            ]);
        });
    });

    describe('with', () => {
        it('basically works', () => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                withEnter() {
                    log.push(`>> enter ${this.x}`);
                }

                withExit() {
                    log.push(`<< exit ${this.x}`);
                }
            }

            let res = new Resource(42);

            res.with(r => {
                log.push(`woot ${r.x}`);
            },
            r => {
                log.push(`otherwise ${r.x}`);
            });

            expect(res.withEntered).to.be(true);
            expect(res.withError).to.be(null);
            expect(log).to.equal([
                '>> enter 42',
                'woot 42',
                '<< exit 42',
                'destruct 42'
            ]);
        });

        it('can be skipped', () => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                withEnter() {
                    log.push(`>> enter ${this.x}`);
                    return SKIP;
                }

                withExit() {
                    log.push(`<< exit ${this.x}`);
                }
            }

            let res = new Resource(42);

            res.with(r => {
                log.push(`woot ${r.x}`);
            },
            r => {
                log.push(`otherwise ${r.x}`);
            });

            expect(res.withEntered).to.be(false);
            expect(res.withError).to.be(null);
            expect(log).to.equal([
                '>> enter 42',
                'otherwise 42',
                'destruct 42'
            ]);
        });

        it('handles exceptions', () => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                withEnter() {
                    log.push(`>> enter ${this.x}`);
                }

                withExit(ex) {
                    log.push(`<< exit ${this.x}: ${ex.message}`);
                }
            }

            let res = new Resource(42);

            expect(() => {
                res.with(r => {
                    log.push(`woot ${ r.x }`);
                    panik('derp');
                },
                r => {
                    log.push(`otherwise ${r.x}`);
                });
            }).to.throw('derp');

            expect(res.withEntered).to.be(true);
            expect(res.withError.message).to.equal('derp');
            expect(log).to.equal([
                '>> enter 42',
                'woot 42',
                '<< exit 42: derp',
                'destruct 42'
            ]);
        });

        it('can swallow exceptions', () => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                withEnter() {
                    log.push(`>> enter ${this.x}`);
                }

                withExit(ex) {
                    log.push(`<< exit ${this.x}: ${ex.message}`);
                }
            }

            let res = new Resource(42);

            res.with({ throw: false }, r => {
                log.push(`woot ${ r.x }`);
                panik('derp');
            },
            r => {
                log.push(`otherwise ${r.x}`);
            });

            expect(res.withEntered).to.be(true);
            expect(res.withError.message).to.equal('derp');
            expect(log).to.equal([
                '>> enter 42',
                'woot 42',
                '<< exit 42: derp',
                'destruct 42'
            ]);
        });
    });

    describe('with async', () => {
        it('basically works', async() => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                async withEnter() {
                    log.push(`>> enter ${this.x}`);
                    await sleep(1);
                    log.push(`<< enter ${this.x}`);
                }

                async withExit() {
                    log.push(`>> exit ${this.x}`);
                    await sleep(1);
                    log.push(`<< exit ${this.x}`);
                }
            }

            let res = new Resource(42);

            await res.with(async r => {
                log.push(`>> woot ${r.x}`);
                await sleep(1);
                log.push(`<< woot ${r.x}`);
            },
            async r => {
                log.push(`>> otherwise ${r.x}`);
                await sleep(1);
                log.push(`<< otherwise ${r.x}`);
            });

            expect(res.withEntered).to.be(true);
            expect(log).to.equal([
                '>> enter 42',
                '<< enter 42',
                '>> woot 42',
                '<< woot 42',
                '>> exit 42',
                '<< exit 42',
                'destruct 42'
            ]);
        });

        it('can be skipped', async() => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                async withEnter() {
                    log.push(`>> enter ${this.x}`);
                    await sleep(1);
                    log.push(`<< enter ${this.x}`);
                    return SKIP;
                }

                async withExit() {
                    log.push(`>> exit ${this.x}`);
                    await sleep(1);
                    log.push(`<< exit ${this.x}`);
                }
            }

            let res = new Resource(42);

            await res.with(async r => {
                log.push(`>> woot ${r.x}`);
                await sleep(1);
                log.push(`<< woot ${r.x}`);
            },
            async r => {
                log.push(`>> otherwise ${r.x}`);
                await sleep(1);
                log.push(`<< otherwise ${r.x}`);
            });

            expect(res.withEntered).to.be(false);
            expect(res.withError).to.be(null);
            expect(log).to.equal([
                '>> enter 42',
                '<< enter 42',
                '>> otherwise 42',
                '<< otherwise 42',
                'destruct 42'
            ]);
        });

        it('handles exceptions', async() => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                async withEnter() {
                    log.push(`>> enter ${this.x}`);
                    await sleep(1);
                    log.push(`<< enter ${this.x}`);
                }

                async withExit(ex) {
                    log.push(`>> exit ${this.x}: ${ex.message}`);
                    await sleep(1);
                    log.push(`<< exit ${this.x}: ${ex.message}`);
                }
            }

            let res = new Resource(42);
            let ex;

            try {
                await res.with(async r => {
                    log.push(`>> woot ${r.x}`);
                    await sleep(1);
                    panik('derp');
                },
                async r => {
                    log.push(`>> otherwise ${r.x}`);
                    await sleep(1);
                    log.push(`<< otherwise ${r.x}`);
                });
            }
            catch (e) {
                ex = e;
            }

            expect(res.withEntered).to.be(true);
            expect(ex.message).to.equal('derp');
            expect(res.withError.message).to.equal('derp');
            expect(log).to.equal([
                '>> enter 42',
                '<< enter 42',
                '>> woot 42',
                '>> exit 42: derp',
                '<< exit 42: derp',
                'destruct 42'
            ]);
        });

        it('can swallow exceptions', async() => {
            let log = [];

            class Resource extends Destroyable {
                constructor(x) {
                    super();
                    this.x = x;
                }

                destruct() {
                    log.push(`destruct ${this.x}`);
                }

                async withEnter() {
                    log.push(`>> enter ${this.x}`);
                    await sleep(1);
                    log.push(`<< enter ${this.x}`);
                }

                async withExit(ex) {
                    log.push(`>> exit ${this.x}: ${ex.message}`);
                    await sleep(1);
                    log.push(`<< exit ${this.x}: ${ex.message}`);
                }
            }

            let res = new Resource(42);

            await res.with({ throw: false }, async r => {
                log.push(`>> woot ${r.x}`);
                await sleep(1);
                panik('derp');
            },
            async r => {
                log.push(`>> otherwise ${r.x}`);
                await sleep(1);
                log.push(`<< otherwise ${r.x}`);
            });

            expect(res.withEntered).to.be(true);
            expect(res.withError.message).to.equal('derp');
            expect(log).to.equal([
                '>> enter 42',
                '<< enter 42',
                '>> woot 42',
                '>> exit 42: derp',
                '<< exit 42: derp',
                'destruct 42'
            ]);
        });
    });
});
