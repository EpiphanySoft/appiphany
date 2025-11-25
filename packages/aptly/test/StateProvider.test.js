import { merge, StateProvider } from '@appiphany/aptly';

import assertly from 'assertly';

const { expect } = assertly;

describe('StateProvider', () => {
    const creator = type => (config = {}, options = {}) => StateProvider.factory.create(config, merge({
        defaults: {
            type
        }
    }, options));

    describe('MemoryStateProvider', () => {
        const create = creator('memory');

        it('should work', () => {
            let provider = create();

            expect(provider.dirty).to.be(false);

            provider.set('foo', 42);
            expect(provider.dirty).to.be(true);
        });
    });

    //----------------------------------------------------------------------------------------

    describe('ChildStateProvider', () => {
        const create = creator('child');

        it('should work', () => {
            let log = [];

            //

            expect(inst1.id).to.equal('foo-1');
            expect(inst2.id).to.equal('foo-2');
        });
    });

    //----------------------------------------------------------------------------------------

    describe('StorageStateProvider', () => {
        const create = creator('storage');

        it('should work', () => {
            let log = [];

            //

            expect(inst1.id).to.equal('foo-1');
            expect(inst2.id).to.equal('foo-2');
        });
    });
});
