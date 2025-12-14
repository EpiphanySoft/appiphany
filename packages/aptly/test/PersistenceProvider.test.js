import { ChildPersistenceProvider, clone, merge, PersistenceProvider } from '@appiphany/aptly';

import assertly from 'assertly';
import { createStorage, mockery } from './utils.js';

const { expect } = assertly;

describe('PersistenceProvider', _ => {
    const creator = type => (config = {}, options = {}) => PersistenceProvider.factory.create(config, merge({
        defaults: {
            type
        }
    }, options));

    describe('MemoryPersistenceProvider', () => {
        const create = creator('memory');

        it('should work', async () => {
            let provider = create();
            let mock = mockery(provider, '_saveData').callThru();

            expect(provider.dirty).to.be(false);

            provider.set('foo', 42);
            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);

            expect(provider.get('foo')).to.equal(42);

            await provider._flush.timer.flushed;

            expect(provider.dirty).to.be(false);
            expect(provider._flush.timer.pending).to.be(false);

            expect(provider.get('foo')).to.equal(42);
            expect(mock.calls).to.equal([
                [{ foo: 42 }]
            ]);

            mock.clear();

            provider.set('bar', 427);
            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);

            expect(provider.get('foo')).to.equal(42);
            expect(provider.get('bar')).to.equal(427);

            await provider._flush.timer.flushed;

            expect(provider.dirty).to.be(false);
            expect(provider._flush.timer.pending).to.be(false);

            expect(provider.get('foo')).to.equal(42);
            expect(provider.get('bar')).to.equal(427);
            expect(mock.calls).to.equal([
                [{ bar: 427 }]
            ]);
        });
    });

    //----------------------------------------------------------------------------------------

    describe('ChildPersistenceProvider', () => {
        const create = creator('child');

        it('should basically work', async () => {
            let owner = {};
            let provider = create({ owner });

            expect(provider.get('foo')).to.equal(undefined);
            provider.set('foo', 42);

            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);
            await provider._flush.timer.flushed;

            expect(clone(owner)).to.equal({
                childPersist: { foo: 42 }
            });

            provider = create({ owner });

            expect(provider.get('foo')).to.equal(42);
            provider.set('foo', 427);

            expect(clone(owner)).to.equal({
                childPersist: { foo: 42 }
            });

            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);
            await provider._flush.timer.flushed;

            expect(clone(owner)).to.equal({
                childPersist: { foo: 427 }
            });
        });
    });

    //----------------------------------------------------------------------------------------

    describe('StoragePersistenceProvider', () => {
        const create = creator('storage');

        it('should basically work', async () => {
            let storage = createStorage({
                'herp-bar': '{"urp":427}',
                'woot-foo': '{"bar":[42]}'
            });

            let provider = create({ storage, scope: 'woot-' });

            expect(provider.get('foo')).to.equal({ bar: [42] });

            provider.set('foo', { woot: 'xyz' });

            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);
            await provider._flush.timer.flushed;

            expect(storage.data).to.equal({
                'herp-bar': '{"urp":427}',
                'woot-foo': '{"woot":"xyz"}'
            });

            provider.set('foo', undefined);

            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);
            await provider._flush.timer.flushed;

            expect(storage.data).to.equal({
                'herp-bar': '{"urp":427}'
            });
        });
    });
});
