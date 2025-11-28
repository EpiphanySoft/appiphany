import { Configurable } from '@appiphany/aptly';
import { Eventable } from '@appiphany/aptly/mixin';

import assertly from 'assertly';
import { logger } from './utils.js';

const { expect } = assertly;

describe('Eventable', () => {
    let log;

    beforeEach(() => {
        log = logger();
    })

    describe('class listeners', () => {
        it('should work with pure function', () => {
            class Foo extends Configurable.mixin(Eventable) {
                static configurable = {
                    on: {
                        click: ev => {
                            log(ev.type);
                            ev.woot = 123;
                        }
                    }
                };
            }

            let inst = Foo.new();

            let ev = inst.fire('click');

            expect(ev.woot).to.equal(123);
            expect(log.get()).to.equal(['click']);
        });

        it('should work with this=me', () => {
            class Foo extends Configurable.mixin(Eventable) {
                static configurable = {
                    on: {
                        this: 'me',
                        click: 'onClick'
                    }
                };

                onClick (ev) {
                    log(ev.type);
                    ev.woot = this.id;
                }
            }

            let inst = Foo.new();
            inst.id = 321;

            let ev = inst.fire('click');

            expect(ev.woot).to.equal(321);
            expect(log.get()).to.equal(['click']);
        });
    });
});
