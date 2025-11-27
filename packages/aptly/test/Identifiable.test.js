import { Configurable } from '@appiphany/aptly';
import { Identifiable } from '@appiphany/aptly/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Identifiable', () => {
    it('should work', () => {
        let log = [];

        class Foo extends Configurable.mixin(Identifiable) {
            static className = 'Foo';
        }

        let inst1 = new Foo();
        let inst2 = new Foo();

        expect(inst1.id).to.equal('foo-1');
        expect(inst2.id).to.equal('foo-2');
    });
});
