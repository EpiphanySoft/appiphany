import { Configurable, clone } from '@appiphany/appiphany';
import { Factoryable } from '@appiphany/appiphany/mixin';

import assertly from 'assertly';

const { expect } = assertly;

describe('Factoryable', () => {
    const setup = () => {
        class Foo extends Configurable.mixin(Factoryable) {
            static type = 'auto';
            static aliases = 'derp';

            static factory = {
                defaultType: 'auto'
            };

            static configurable = {
                foo: null
            };
        }

        Foo.initClass();

        class Bar extends Foo {
            static type = 'bar';
            static aliases = 'woot';

            static configurable = {
                bar: null
            };
        }

        Bar.initClass();

        return [Foo, Bar];
    };

    it('should basically work', () => {
        const [Foo, Bar] = setup();

        let foo = Foo.factory.create('auto');

        expect(foo.constructor).to.be(Foo);

        let bar = Foo.factory.create('bar');

        expect(bar.constructor).to.be(Bar);

        let bar2 = Foo.factory.create('woot');

        expect(bar2.constructor).to.be(Bar);
    });

    it('is', () => {
        const [Foo, Bar] = setup();

        expect(clone(Foo.is)).to.equal({
            auto: true,
            derp: true
        });

        expect(clone(Bar.is)).to.equal({
            auto: true,
            derp: true,
            bar: true,
            woot: true
        });
    });

    it('should reconfigure correctly', () => {
        const [Foo, Bar] = setup();

        let inst1 = Foo.create({
            foo: 42
        });

        expect(inst1.constructor).to.be(Foo);
        expect(inst1.foo).to.equal(42);

        let inst2 = Foo.reconfigure(inst1, {
            foo: 427
        });

        expect(inst1).to.be(inst2);
        expect(inst1.foo).to.equal(427);

        let bar = Foo.reconfigure(inst1, {
            type: 'bar',
            foo: 123,
            bar: 321
        });

        expect(inst1.destroyed).to.be(true);
        expect(bar).not.to.be(inst2);
        expect(bar.constructor).to.be(Bar);
        expect(bar.foo).to.equal(123);
        expect(bar.bar).to.equal(321);
    });
});
