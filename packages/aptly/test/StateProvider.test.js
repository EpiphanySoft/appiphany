import { clone, merge, StateProvider } from '@appiphany/aptly';

import assertly from 'assertly';
import { mockery } from './utils.js';

const { expect } = assertly;

describe('StateProvider', _ => {
    const creator = type => (config = {}, options = {}) => StateProvider.factory.create(config, merge({
        defaults: {
            type
        }
    }, options));

    describe('MemoryStateProvider', () => {
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

    describe('ChildStateProvider', () => {
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
                childState: { foo: 42 }
            });

            provider = create({ owner });

            expect(provider.get('foo')).to.equal(42);
            provider.set('foo', 427);

            expect(clone(owner)).to.equal({
                childState: { foo: 42 }
            });

            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);
            await provider._flush.timer.flushed;

            expect(clone(owner)).to.equal({
                childState: { foo: 427 }
            });
        });
    });

    //----------------------------------------------------------------------------------------

    describe('StorageStateProvider', () => {
        const create = creator('storage');
        const createStorage = (data = {}) => ({
            data,

            get length () { return Object.keys(this.data).length; },
            key (i) { return Object.keys(this.data)[i]; },
            getItem (key) { return this.data[key]; },
            setItem (key, value) { this.data[key] = value; },
            removeItem (key) { delete this.data[key]; }
        });

        it('should basically work', async () => {
            let storage = createStorage({
                'derp-bar': '{"urp":427}',
                'woot-foo': '{"bar":[42]}'
            });

            let provider = create({ storage, scope: 'woot-' });

            expect(provider.get('foo')).to.equal({ bar: [42] });

            provider.set('foo', { woot: 'xyz' });

            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);
            await provider._flush.timer.flushed;

            expect(storage.data).to.equal({
                'derp-bar': '{"urp":427}',
                'woot-foo': '{"woot":"xyz"}'
            });

            provider.set('foo', undefined);

            expect(provider.dirty).to.be(true);
            expect(provider._flush.timer.pending).to.be(true);
            await provider._flush.timer.flushed;

            expect(storage.data).to.equal({
                'derp-bar': '{"urp":427}'
            });
        });
    });
});
