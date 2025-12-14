import { ChildPersistenceProvider, Configurable, merge, PersistenceProvider } from '@appiphany/aptly';
import { Persistable } from '@appiphany/aptly/mixin';

import assertly from 'assertly';
import { createStorage } from './utils.js';

const { expect } = assertly;

describe('Persistable', _ => {
    const creator = type => (config = {}, options = {}) => PersistenceProvider.factory.create(config, merge({
        defaults: {
            type
        }
    }, options));

    it('should support nested providers', async () => {
        let log = [];

        class Owner extends Configurable.mixin(Persistable) {
            static configurable = {
                childPersist: true,
                herp: null,
                persistable: 'herp'
            }
        }

        class Child extends Configurable.mixin(Persistable) {
            static configurable = {
                props: {
                    abc: 123
                },

                woot: class {
                    value = null;

                    update (instance, value) {
                        log.push(`woot=${value}`);
                    }
                },

                persistable: {
                    abc: true,
                    woot: true
                }
            }
        }

        let storage = createStorage({
            'woot-foo': JSON.stringify({
                herp: 'foobar',
                childPersist: {
                    kiddo: {
                        woot: 427
                    }
                }
            })
        });

        let provider = creator('storage')({ storage, scope: 'woot-' });
        let owner = Owner.new({
            persistId: 'foo',
            persistenceProvider: provider
        });

        expect(owner.herp).to.equal('foobar');

        let child = Child.new({
            parent: owner,
            persistId: 'kiddo',
            woot: 42
        });

        let provider2 = child.persistenceProvider;

        expect(provider2).to.be.a(ChildPersistenceProvider);

        expect(child.woot).to.equal(427);
        expect(log).to.equal([
            'woot=427'
        ]);

        expect(provider._flush.timer.pending).to.be(false);
        expect(provider2._flush.timer.pending).to.be(false);

        child.woot = 314;
        expect(provider._flush.timer.pending).to.be(false);
        expect(provider2._flush.timer.pending).to.be(true);

        owner.herp = 'barfoo';
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
                herp: 'barfoo',
                childPersist: {
                    kiddo: {
                        abc: 123,
                        woot: 314
                    }
                }
            })
        });
    });
});
