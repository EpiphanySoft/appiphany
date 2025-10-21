import { Configurable } from '@appiphany/appiphany';
import { Signalable } from '@appiphany/appiphany/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Signalable', () => {
    it('should basically work', () => {
        let log = [];

        const logged = () => {
            let ret = log;
            log = [];
            return ret;
        };

        class Foo extends Configurable.mixin(Signalable) {
            static configurable = {
                signals: {
                    foo: null,

                    bar () {
                        return this.foo * 2;
                    }
                }
            }
        }

        let f = new Foo();

        expect(f.signals.bar).to.be(210);
    });
});
