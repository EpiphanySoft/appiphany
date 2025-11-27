import { clone, Configurable } from '@appiphany/aptly';
import { Hierarchical } from "@appiphany/aptly/mixin";

import assertly from 'assertly';

const { expect } = assertly;

const integrity = root => {
    let nextSib = null,
        prevSib = null,
        found = [],
        child, i, temp;

    for (child = root.firstChild; child; child = child.nextSibling) {
        expect(child.parent).to.be(root);
        expect(child.prevSibling).to.be(prevSib);
        prevSib = child;
        found.push(child);
    }

    expect(root.childCount).to.equal(found.length);
    i = 0;

    for (child of root.childrenReverse) {
        ++i;
        expect(found.at(-i)).to.be(child);
    }

    for (child = root.lastChild; child; child = child.prevSibling) {
        temp = found.pop();
        expect(temp).to.be(child);
        expect(child.parent).to.be(root);
        expect(child.nextSibling).to.be(nextSib);
        nextSib = child;
    }

    expect(found).to.equal([]);

    for (child of root.children) {
        integrity(child);
    }
}

describe('Hierarchical', () => {
    let nextId = 0,
        log;

    class A extends Configurable.mixin(Hierarchical) {
        id = ++nextId;

        static configurable = {
            name: null
        };

        destruct () {
            let { name, id } = this;

            log.push(`>> ~${name}${id}`);

            super.destruct();

            log.push(`<< ~${name}${id}`);
        }

        dump (log = [], level = 0) {
            log.push(`${'>'.repeat(level)}${level ? ' ' : ''}${this.name}${this.id}`);

            for (let child of this.children) {
                child.dump(log, level + 1);
            }

            return log;
        }
    }

    beforeEach(() => {
        nextId = 0;
        log = [];
    });

    it('should basically work', () => {
        let a = new A({ name: 'a', });
        let b = new A({ name: 'b', parent: a });
        let c = new A({ name: 'c', parent: b });
        let d = new A({ name: 'd', parent: c });
        let e = new A({ name: 'e', parent: a });

        integrity(a);

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3',
            '>>> d4',
            '> e5'
        ]);

        a.destroy();

        expect(log).to.equal([
            '>> ~a1',
                '>> ~b2',
                    '>> ~c3',
                        '>> ~d4',
                        '<< ~d4',
                    '<< ~c3',
                '<< ~b2',
                '>> ~e5',
                '<< ~e5',
            '<< ~a1',
        ])
    });

    it('should be able to move nodes', () => {
        let a = new A({ name: 'a', });
        let b = new A({ name: 'b', parent: a });
        let c = new A({ name: 'c', parent: b });
        let d = new A({ name: 'd', parent: a });
        let e = new A({ name: 'e', parent: a });

        integrity(a);

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3',
            '> d4',
            '> e5'
        ]);

        b.insertChild(e);
        integrity(a);

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3',
            '>> e5',
            '> d4'
        ]);

        e.insertChild(d);
        integrity(a);

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3',
            '>> e5',
            '>>> d4'
        ]);

        c.insertChild(d);
        integrity(a);
        d.insertChild(e);
        integrity(a);

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3',
            '>>> d4',
            '>>>> e5'
        ]);

        expect(() => {
            d.insertChild(a);
        }).to.throw('parent cannot be a child of itself');

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3',
            '>>> d4',
            '>>>> e5'
        ]);

        b.insertChild(e, c);
        integrity(a);

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> e5',
            '>> c3',
            '>>> d4'
        ]);
    });

    it('should support inherited data', () => {
        let a = new A({ name: 'a', });
        let b = new A({ name: 'b', parent: a });
        let c = new A({ name: 'c', parent: b });

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3'
        ]);

        a.inherited.foo = 42;
        expect(b.inherited.foo).to.equal(42);
        expect(c.inherited.foo).to.equal(42);

        b.inheritable.foo = 427;
        expect(b.inherited.foo).to.equal(42);
        expect(c.inherited.foo).to.equal(427);

        a.insertChild(c);
        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '> c3'
        ]);
        expect(b.inherited.foo).to.equal(42);
        expect(c.inherited.foo).to.equal(42);

        b.insertChild(c);
        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3'
        ]);
        expect(b.inherited.foo).to.equal(42);
        expect(c.inherited.foo).to.equal(427);
    });

    it('should support nexus and refs', () => {
        let a = new A({ name: 'a', nexus: true });
        let b = new A({ name: 'b', parent: a });
        let c = new A({ name: 'c', parent: b, ref: 'cc' });
        let d = new A({ name: 'd', parent: a, ref: 'dd' });
        let e = new A({ name: 'e', parent: a, ref: 'ee' });

        let x = new A({ name: 'x', parent: a, nexus: true, ref: 'xx' });
        let y = new A({ name: 'y', parent: x, ref: 'yy' });
        let z = new A({ name: 'z', parent: y, ref: 'zz' });

        integrity(a);

        expect(a.dump()).to.equal([
            'a1',
            '> b2',
            '>> c3',
            '> d4',
            '> e5',
            '> x6',
            '>> y7',
            '>>> z8'
        ]);

        expect(clone(a.refs.map)).to.equal({ cc: c, dd: d, ee: e, xx: x });
        expect(a.refs.rebuilds).to.equal(1);
        expect(b.inherited.nexus).to.be(a);
        expect(c.inherited.nexus).to.be(a);
        expect(d.inherited.nexus).to.be(a);
        expect(e.inherited.nexus).to.be(a);
        expect(x.inherited.nexus).to.be(a);

        expect(clone(x.refs.map)).to.equal({ yy: y, zz: z });
        expect(x.refs.rebuilds).to.equal(1);
        expect(y.inherited.nexus).to.be(x);
        expect(z.inherited.nexus).to.be(x);

        b.ref = 'bbb';
        c.ref = 'ccc';
        d.ref = 'ddd';
        e.ref = 'eee';
        x.ref = 'xxx';
        y.ref = 'yyy';
        z.ref = 'zzz';

        expect(clone(a.refs.map)).to.equal({ bbb: b, ccc: c, ddd: d, eee: e, xxx: x });
        expect(a.refs.rebuilds).to.equal(2);
        expect(b.inherited.nexus).to.be(a);
        expect(c.inherited.nexus).to.be(a);
        expect(d.inherited.nexus).to.be(a);
        expect(e.inherited.nexus).to.be(a);
        expect(x.inherited.nexus).to.be(a);

        expect(clone(x.refs.map)).to.equal({ yyy: y, zzz: z });
        expect(x.refs.rebuilds).to.equal(2);
        expect(y.inherited.nexus).to.be(x);
        expect(z.inherited.nexus).to.be(x);

        x.insertChild(b);

        expect(clone(a.refs.map)).to.equal({ ddd: d, eee: e, xxx: x });
        expect(a.refs.rebuilds).to.equal(3);
        expect(d.inherited.nexus).to.be(a);
        expect(e.inherited.nexus).to.be(a);
        expect(x.inherited.nexus).to.be(a);

        expect(clone(x.refs.map)).to.equal({ bbb: b, ccc: c, yyy: y, zzz: z });
        expect(x.refs.rebuilds).to.equal(3);
        expect(b.inherited.nexus).to.be(x);
        expect(c.inherited.nexus).to.be(x);
        expect(y.inherited.nexus).to.be(x);
        expect(z.inherited.nexus).to.be(x);

        y.ref = 'y!';
        z.ref = 'z!';

        expect(clone(a.refs.map)).to.equal({ ddd: d, eee: e, xxx: x });
        expect(a.refs.rebuilds).to.equal(3);
        expect(d.inherited.nexus).to.be(a);
        expect(e.inherited.nexus).to.be(a);
        expect(x.inherited.nexus).to.be(a);

        expect(clone(x.refs.map)).to.equal({ bbb: b, ccc: c, 'y!': y, 'z!': z });
        expect(x.refs.rebuilds).to.equal(4);
        expect(b.inherited.nexus).to.be(x);
        expect(c.inherited.nexus).to.be(x);
        expect(y.inherited.nexus).to.be(x);
        expect(z.inherited.nexus).to.be(x);

        d.ref = 'D';
        e.ref = 'E';
        x.ref = 'X';

        expect(clone(a.refs.map)).to.equal({ D: d, E: e, X: x });
        expect(a.refs.rebuilds).to.equal(4);
        expect(d.inherited.nexus).to.be(a);
        expect(e.inherited.nexus).to.be(a);
        expect(x.inherited.nexus).to.be(a);

        expect(clone(x.refs.map)).to.equal({ bbb: b, ccc: c, 'y!': y, 'z!': z });
        expect(x.refs.rebuilds).to.equal(4);
        expect(b.inherited.nexus).to.be(x);
        expect(c.inherited.nexus).to.be(x);
        expect(y.inherited.nexus).to.be(x);
        expect(z.inherited.nexus).to.be(x);

        e.parent = y;

        expect(clone(a.refs.map)).to.equal({ D: d, X: x });
        expect(a.refs.rebuilds).to.equal(5);
        expect(d.inherited.nexus).to.be(a);
        expect(x.inherited.nexus).to.be(a);

        expect(clone(x.refs.map)).to.equal({ bbb: b, ccc: c, E: e, 'y!': y, 'z!': z });
        expect(x.refs.rebuilds).to.equal(5);
        expect(b.inherited.nexus).to.be(x);
        expect(c.inherited.nexus).to.be(x);
        expect(e.inherited.nexus).to.be(x);
        expect(y.inherited.nexus).to.be(x);
        expect(z.inherited.nexus).to.be(x);

        expect(a.dump()).to.equal([
            'a1',
            '> d4',
            '> x6',
            '>> y7',
            '>>> z8',
            '>>> e5',
            '>> b2',
            '>>> c3',
        ]);
    });
});
