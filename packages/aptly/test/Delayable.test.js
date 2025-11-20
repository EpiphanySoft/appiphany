import { Configurable } from '@appiphany/aptly';
import { Delayable } from '@appiphany/aptly/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Delayable', () => {
    it('should basically work', () => {
        class Foo extends Configurable.mixin(Delayable) {
            static delayable = {
                foo: 42
            };

            foo () {
                //
            }
        }

        let foo = Foo.new();

    });
});
