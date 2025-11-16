import {
    Base64,
    c2h,
    h2c,
    chain,
    clone,
    SmartArray,
    decapitalize,
    filter,
    groupBy,
    ignore,
    isObject,
    iterateGroups,
    keys,
    map,
    merge,
    SKIP,
    splitObject,
    stringify,
    typeOf, generateAll, sleep
} from '@appiphany/appiphany';

import assertly from 'assertly';

const { expect } = assertly;


const
    half = x => Math.floor(x / 2),
    flipFlop = s => {
        let i = half(s.length),
            k = half(i);

        return s.slice(k, i) + s.slice(0, k) + s.slice(i);
    };


describe('Misc', () => {
    it('c2h', () => {
        expect(c2h('fooBarZip')).to.equal('foo-bar-zip');
        expect(c2h('foo-bar-zip')).to.equal('foo-bar-zip');
        expect(c2h('--foo-bar-zip')).to.equal('--foo-bar-zip');
    });

    it('h2c', () => {
        expect(h2c('foo-bar-zip')).to.equal('fooBarZip');
        expect(h2c('fooBar-zip')).to.equal('fooBarZip');
    });

    it('chain', () => {
        let o1 = chain();
        let o2 = chain(o1);
        let o3 = chain(o2);

        expect(isObject(o1)).to.be(true);
        expect(isObject(o2)).to.be(true);
        expect(isObject(o3)).to.be(true);

        expect(o1.x == null).to.be(true);
        expect(o2.x == null).to.be(true);
        expect(o3.x == null).to.be(true);

        o1.x = 42;

        expect(o1.x).to.equal(42);
        expect(o2.x).to.equal(42);
        expect(o3.x).to.equal(42);

        expect(Object.keys(o1)).to.equal(['x']);
        expect(Object.keys(o2)).to.equal([]);
        expect(Object.keys(o3)).to.equal([]);

        expect(keys(o1)).to.equal(['x']);
        expect(keys(o2)).to.equal(['x']);
        expect(keys(o3)).to.equal(['x']);
    });

    it('generateAll', async() => {
        function* gen() {
            yield 1;
            yield 2;
        }

        expect(Array.from(gen())).to.equal([1, 2]);

        let g = gen();
        generateAll(g);
        expect(Array.from(g)).to.equal([]);

        async function* asyncGen() {
            await sleep(1);
            yield 1;
            await sleep(1);
            yield 2;
            await sleep(1);
            yield 3;
        }

        let all = async it => {
            let a = [];

            for await (let i of it) {
                a.push(i);
            }

            return a;
        };

        g = asyncGen();
        expect(await all(g)).to.equal([1, 2, 3]);

        g = asyncGen();
        await generateAll(g);
        expect(await all(g)).to.equal([]);
    });

    it('SmartArray', () => {
        let c = new SmartArray(10, 20, 30);

        expect(Array.isArray(c)).to.be(true);
        expect(c.length).to.be(3);
        expect(c.dirty).to.be(false);

        expect(c.slice()).to.equal([10, 20, 30]);

        c.splice(2, 0, 25);
        expect(c.dirty).to.be(true);

        let c2 = c.clone();

        expect(c2.dirty).to.be(false);
        expect(c2.length).to.be(4);
        expect(c2.slice()).to.equal([10, 20, 25, 30]);

        c.dirty = false;
        expect(c.dirty).to.be(false);

        expect(c.length).to.be(4);
        expect(c.slice()).to.equal([10, 20, 25, 30]);

        c.splice(1, 0, 15);
        expect(c.dirty).to.be(true);

        c.dirty = false;
        expect(c.dirty).to.be(false);

        expect(c.length).to.be(5);
        expect(c.slice()).to.equal([10, 15, 20, 25, 30]);

        expect(c2.dirty).to.be(false);
        expect(c2.length).to.be(4);
        expect(c2.slice()).to.equal([10, 20, 25, 30]);
    });

    it('decapitalize', () => {
        expect(decapitalize('hello')).to.equal('hello');
        expect(decapitalize('Hello')).to.equal('hello');
        expect(decapitalize('HELLO')).to.equal('hello');

        expect(decapitalize('2000')).to.equal('2000');
        expect(decapitalize('XY2000')).to.equal('xy2000');

        expect(decapitalize('HTMLEncode')).to.equal('htmlEncode');
    });

    it('filter(object)', () => {
        let o = { abc: 1, abc123: 2, def: 3 };

        expect(filter(o, /abc|def/)).to.equal({
            abc: 1,
            def: 3
        });
    });

    it('exception test', () => {
        const log = [];

        const foo = () => {
            throw new Error('A');
        };

        const bar = () => {
            throw new Error('B');
        };

        const derp = () => {
            try {
                foo();
            }
            finally {
                try {
                    bar();
                }
                catch (e) {
                    log.push(e.toString());
                }
            }
        };

        try {
            derp();
        }
        catch (e) {
            log.push(e.toString());
        }

        expect(log).to.equal(['Error: B', 'Error: A']);
    });

    it('groupBy', () => {
        let recs = [
            { a: 1, b: 1, c: 2 },
            { a: 1, b: 1, c: 3 },

            { a: 1, b: 2, c: 4 },
            { a: 1, b: 2, c: 5 },
            { a: 1, b: 2, c: 6 },

            { a: 2, b: 1, c: 7 },
            { a: 2, b: 1, c: 8 }
        ];

        let groups = [],
            batch;

        for (let [keys, iter] of iterateGroups(recs, 'a', 'b')) {
            groups.push([keys, batch = []]);

            for (let it of iter()) {
                batch.push(it);
            }
        }

        expect(groups).to.equal([
            [ [1, 1], [recs[0], recs[1]] ],
            [ [1, 2], [recs[2], recs[3], recs[4]] ],
            [ [2, 1], [recs[5], recs[6]] ]
        ]);

        groups = [];

        for (let [keys, iter] of iterateGroups(recs, 'a', 'b')) {
            groups.push([keys, batch = Array.from(iter())]);
        }

        expect(groups).to.equal([
            [ [1, 1], [recs[0], recs[1]] ],
            [ [1, 2], [recs[2], recs[3], recs[4]] ],
            [ [2, 1], [recs[5], recs[6]] ]
        ]);

        groups = groupBy(recs, 'a', 'b');

        expect(groups).to.equal([
            [recs[0], recs[1]],
            [recs[2], recs[3], recs[4]],
            [recs[5], recs[6]]
        ]);
    });

    it('map(array)', () => {
        let a = [42, { foo: 'woot' }];

        expect(map(a,
            (it, key) => isObject(it)
                ? ['woot', { ...it, key }]
                : { vv: it },
            'object'
        )).to.equal({
            0: {
                vv: 42
            },
            woot: {
                key: 1,
                foo: 'woot'
            }
        });
    });

    it('map(object)', () => {
        let o = { v: { derp: 42 }};

        // w/o a mapping fn, object->array acts like Object.entries() but w/o hasOwn
        expect(map(o, 'array')).to.equal([
            ['v', { derp: 42 }]
        ]);

        expect(map(o,
                (it, key) => merge(it, { foo: 'woot', key: `$${key}` })
        )).to.equal({
            v: { key: '$v', derp: 42, foo: 'woot' }
        });

        expect(map(o,
                (it, key) => [key.toUpperCase(), merge(it, { foo: 'woot', key })]
        )).to.equal({
            V: { key: 'v', derp: 42, foo: 'woot' }
        });

        expect(map(
            { a: { default: 42 }, b: { default: 427 }},
            it => it.default
        )).to.equal({
            a: 42,
            b: 427
        });

        expect(map(
            { a: { default: 42 }, b: { default: 427 }},
            (it, key) => (key === 'b') ? SKIP : it.default
        )).to.equal({
            a: 42
        });
    });

    it('map(map.keys())', () => {
        let m = new Map();

        m.set('a', 10);
        m.set('b', 20);
        m.set('c', 30);
        m.set('d', 40);

        expect(
            map(m.keys(), it => it.toUpperCase())
        ).to.equal(['A', 'B', 'C', 'D']);
    });

    it('map(map.values())', () => {
        let m = new Map();

        m.set('a', 10);
        m.set('b', 20);
        m.set('c', 30);
        m.set('d', 40);

        expect(
            map(m.values(), it => it * 10)
        ).to.equal([100, 200, 300, 400]);
    });

    it('map(set)', () => {
        let a = new Set(['a', 'b', 'c']);

        expect(
            map(a, it => it.toUpperCase())
        ).to.equal(['A', 'B', 'C']);
    });

    it('splitObject', () => {
        let [o1, o2, o3] = splitObject({ a: 1, b: 2, c: 3, d: 4}, ['a'], ['b', 'c', 'x']);

        expect(o1).to.equal({
            a: 1
        });

        expect(o2).to.equal({
            b: 2,
            c: 3
        });

        expect(o3).to.equal({
            d: 4
        });
    });

    it('typeOf', () => {
        class Abc {
            //
        }
        let abc = new Abc();

        expect(typeOf(Abc)).to.equal('class');
        expect(typeOf(abc)).to.equal('instance');

        expect(typeOf(null)).to.equal('null');
        expect(typeOf(undefined)).to.equal('undefined');
        expect(typeOf(void 0)).to.equal('undefined');

        expect(typeOf(true)).to.equal('boolean');
        expect(typeOf(false)).to.equal('boolean');

        expect(typeOf(0)).to.equal('number');
        expect(typeOf(Infinity)).to.equal('number');

        expect(typeOf(0n)).to.equal('bigint');

        expect(typeOf('')).to.equal('string');

        expect(typeOf([])).to.equal('array');
        expect(typeOf({})).to.equal('object');

        expect(typeOf(new Date())).to.equal('date');
        expect(typeOf(new String())).to.equal('string');
        expect(typeOf(new Boolean())).to.equal('boolean');
        expect(typeOf(new Number())).to.equal('number');
        expect(typeOf(/abc/)).to.equal('regexp');
    });
});
