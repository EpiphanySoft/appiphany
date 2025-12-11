import { Dom } from '@appiphany/webly';

import assertly from 'assertly';

const { expect } = assertly;

describe('Dom', () => {
    describe('canonicalizeSpecs', () => {
        it('should basically work', () => {
            let specs = Dom.canonicalizeSpecs({
                c: {
                    '>': '^foo',
                    html: 'C'
                },
                d: {
                    '>': '^foo',
                    html: 'D'
                },
                foo: {
                    html: 'Foo'
                },
                a: {
                    '>': 'foo',
                    html: 'A'
                },
                b: {
                    '>': 'foo',
                    html: 'B'
                }
            });

            expect(specs).to.equal([
                { ref: 'a', html: 'A' },
                { ref: 'b', html: 'B' },
                { ref: 'foo', html: 'Foo' },
                { ref: 'c', html: 'C' },
                { ref: 'd', html: 'D' }
            ]);
        });

        it('should not infinitely recurse on circular dependency', () => {
            let specs = Dom.canonicalizeSpecs({
                a: {
                    '>': 'b',
                    html: 'A'
                },
                b: {
                    '>': 'a',
                    html: 'B'
                }
            });

            expect(specs).to.equal([
                { ref: 'b', html: 'B' },
                { ref: 'a', html: 'A' }
            ]);
        });
    });
});
