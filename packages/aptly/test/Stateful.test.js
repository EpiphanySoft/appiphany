import { ChildStateProvider, Configurable, merge, StateProvider } from '@appiphany/aptly';
import { Stateful } from '@appiphany/aptly/mixin';

import assertly from 'assertly';
import { createStorage } from './utils.js';

const { expect } = assertly;

describe('Stateful', _ => {
    const creator = type => (config = {}, options = {}) => StateProvider.factory.create(config, merge({
        defaults: {
            type
        }
    }, options));

    it('should support nested providers', async () => {
        let log = [];

        class Owner extends Configurable.mixin(Stateful) {
            static configurable = {
                childState: true,
                derp: null,
                stateful: 'derp'
            }
        }

        class Child extends Configurable.mixin(Stateful) {
            static configurable = {
                woot: class {
                    value = null;

                    update (instance, value) {
                        log.push(`woot=${value}`);
                    }
                },

                stateful: 'woot'
            }
        }

        let storage = createStorage({
            'woot-foo': JSON.stringify({
                derp: 'foobar',
                childState: {
                    kiddo: {
                        woot: 427
                    }
                }
            })
        });

        let provider = creator('storage')({ storage, scope: 'woot-' });
        let owner = Owner.new({
            stateId: 'foo',
            stateProvider: provider
        });

        expect(owner.derp).to.equal('foobar');

        let child = Child.new({
            parent: owner,
            stateId: 'kiddo',
            woot: 42
        });

        let provider2 = child.stateProvider;

        expect(provider2).to.be.a(ChildStateProvider);

        expect(child.woot).to.equal(427);
        expect(log).to.equal([
            'woot=427'
        ]);

        expect(provider._flush.timer.pending).to.be(false);
        expect(provider2._flush.timer.pending).to.be(false);

        child.woot = 314;
        expect(provider._flush.timer.pending).to.be(false);
        expect(provider2._flush.timer.pending).to.be(true);

        owner.derp = 'barfoo';
        expect(provider._flush.timer.pending).to.be(true);
        expect(provider2._flush.timer.pending).to.be(true);

        await Promise.all([
            provider._flush.timer.flushed,
            provider2._flush.timer.flushed
        ]);

        expect(provider._flush.timer.pending).to.be(false);
        expect(provider2._flush.timer.pending).to.be(false);

        expect(storage.data).to.equal({
            'woot-foo': JSON.stringify({
                derp: 'barfoo',
                childState: {
                    kiddo: {
                        woot: 314
                    }
                }
            })
        });
    });
});
