import { panik, Config, chain } from '@appiphany/aptly';

const
    insertingSym = Symbol('inserting'),
    { create: chainProto, getPrototypeOf: getProto, setPrototypeOf: setProto } = Object,
    createInheritable = p => chainProto(chainProto(p?.inheritable || null)),
    typeMatcher = type => {
        type = type || '';

        let t = typeof type;

        if (t === 'string') {
            if (type === '*') {
                type = '';
            }

            // ex, search for 'component' or 'button' matches hierarchicalType='component:button'
            return item => item.hierarchicalType.includes(type)
        }

        if (t === 'function') {
            return type;
        }

        if (type instanceof RegExp) {
            return item => type.test(item.hierarchicalType);
        }

        return _ => true;
    };

class Refs {
    #owner;

    constructor (owner) {
        this.#owner = owner;
        this.map = null;
    }

    descend (node) {
        let { map } = this,
            child, ref;

        for (child of node.childrenByType('*')) {
            ref = child.ref;

            if (ref) {
                if (map[ref]) {
                    panik(`Duplicate ref '${ref}'`);
                }

                map[ref] = child;
            }

            if (!child.nexus) {
                this.descend(child);
            }
        }
    }

    invalidate () {
        this.map = null;
    }

    lookup (ref) {
        let me = this;

        if (!me.map) {
            me.map = chain();
            me.descend(me.#owner);
        }

        return me.map[ref];
    }
}

/**
 * Hierarchical objects are objects that can have parent/child relationships with other
 * hierarchical objects. Information is inheritable down this hierarchy using prototype
 * chains:
 *
 *        ╔══════════════╗
 *        ║              ║    inherited        ┌──────────────┐
 *        ║    parent    ╟─────────────────────▶ inherited to │
 *        ║              ╟─────────────────┐   │    parent    │
 *        ╚═════▲════▲═══╝   inheritable   │   └───────△──────┘
 *              │    │                     │           :
 *              │    │                     │           : __proto__
 *              │    │    parent           │   ┌───────┴──────┐
 *              │    └─────┐               └───▶ inherited to │
 *              │          │                   │   children   │
 *              │          │                   └───────△────△─┘
 *              │          │                           :    :
 *              │          │                     ┌ ─ ─ ┘    :
 *              │  ╔═══════╧══════╗    __proto__ :          :
 *              │  ║              ║              :          :
 *              │  ║    child1    ║      ┌───────┴──────┐   :
 *              │  ║              ╟──────▶ inherited to │   :
 *              │  ╚══════════════╝      │    child1    │   :
 *              │                        └───────△──────┘   :  __proto__
 *              │                                :          └ ─ ─ ─ ┐
 *              │                      __proto__ :                  :
 *              │ parent                 ┌───────┴──────┐           :
 *              │                        │ inherited to │           :
 *              │                        │   child1's   │           :
 *              │                        │   children   │           :
 *      ╔═══════╧══════╗                 └──────────────┘           :
 *      ║              ║                                            :
 *      ║    child2    ║   inherited                        ┌───────┴──────┐
 *      ║              ╟────────────────────────────────────▶ inherited to │
 *      ╚══════════════╝                                    │    child2    │
 *                                                          └───────△──────┘
 *                                                                  :
 *                                                                  : __proto__
 *                                                                  :
 *                                                          ┌───────┴──────┐
 *                                                          │ inherited to │
 *                                                          │   child2's   │
 *                                                          │   children   │
 *                                                          └──────────────┘
 *
 */
export const Hierarchical = Base => class Hierarchical extends Base {
    static configurable = {
        nexus: class extends Config.Bool {
            update (me, nexus) {
                let { inheritable } = me;

                if (nexus) {
                    me.refs = new Refs(me);
                    inheritable.nexus = me;
                }
                else {
                    delete inheritable.nexus;
                }

                // either way, we are changing visibility of refs below this node
                // to the upper nexus
                me.inherited.nexus?.refs.invalidate();
            }
        },

        parent: class {
            value = null;

            apply (me, parent) {
                for (let up = parent; up; up = up.parent) {
                    if (up === me) {
                        panik('parent cannot be a child of itself');
                    }
                }

                return parent;
            }

            update (me, parent, was) {
                was?._unlinkChild(me);

                let { inherited } = me,
                    inheritable = parent?.inheritable;

                if (getProto(inherited) !== inheritable) {
                    inherited.nexus?.refs.invalidate();  // invalid our old nexus
                    setProto(inherited, inheritable);
                    inherited.nexus?.refs.invalidate();  // invalid our new nexus
                }

                !me[insertingSym] && parent?.insertChild(me);
            }
        },

        ref: class {
            value = null;

            update (me) {
                me.inherited.nexus?.refs.invalidate();
            }
        }
    };

    static hierarchicalType = 'base';

    static proto = {
        [insertingSym]: false,
        _firstChild: null,
        _lastChild: null,
        _inheritable: null,
        _inherited: null,
        childCount: 0,
        nextSib: null,
        prevSib: null,
        refs: null
    };

    destruct () {
        let me = this,
            child;

        me.inherited.nexus?.refs.invalidate();
        me.parent?._unlinkChild(me);

        for (child of me.childrenByType('*')) {
            child.destroy();
        }

        super.destruct();
    }

    get hierarchicalType () {
        return this.constructor.hierarchicalType;
    }

    get inheritable () {
        return this._inheritable ??= createInheritable(this.parent);
    }

    get inherited () {
        return this._inherited ??= getProto(this.inheritable);
    }

    //------------------------------------------------------------------------------------------
    // Navigating the hierarchy

    get children () {
        return this.childrenByType();
    }

    get childrenReverse () {
        return this.childrenReverseByType();
    }

    get firstChild () {
        return this.firstChildByType();
    }

    get lastChild () {
        return this.lastChildByType();
    }

    get nextSibling () {
        let { hierarchicalType, nextSib } = this;

        for (; nextSib; nextSib = nextSib.nextSib) {
            if (hierarchicalType === nextSib.hierarchicalType) {
                break;
            }
        }

        return nextSib;
    }

    get prevSibling () {
        let { hierarchicalType, prevSib } = this;

        for (; prevSib; prevSib = prevSib.prevSib) {
            if (hierarchicalType === prevSib.hierarchicalType) {
                break;
            }
        }

        return prevSib;
    }

    * childrenByType (type = this.hierarchicalType) {
        let matcher = typeMatcher(type);

        for (let next, child = this._firstChild; child; child = next) {
            next = child.nextSib;  // incase the child is destroyed/removed

            if (matcher(child)) {
                yield child;
            }
        }
    }

    * childrenReverseByType (type = this.hierarchicalType) {
        let matcher = typeMatcher(type);

        for (let child = this._lastChild; child; child = child.prevSib) {
            if (matcher(child)) {
                yield child;
            }
        }
    }

    firstChildByType (type = this.hierarchicalType) {
        let matcher = typeMatcher(type);

        for (let child = this._firstChild; child; child = child.nextSib) {
            if (matcher(child)) {
                return child;
            }
        }

        return null;
    }

    lastChildByType (type = this.hierarchicalType) {
        let matcher = typeMatcher(type);

        for (let child = this._lastChild; child; child = child.prevSib) {
            if (matcher(child)) {
                return child;
            }
        }

        return null;
    }

    lookup (ref) {
        let refs = this.refs || this.inherited.nexus?.refs;

        return refs?.lookup(ref);
    }

    up (type) {
        let up = this,
            matcher, n;

        if (typeof type === 'number') {
            for (n = type; (up = up.parent); --n) {
                if (!n) {
                    return up;
                }
            }
        }
        else {
            matcher = typeMatcher(type);

            while ((up = up.parent)) {
                if (matcher(up)) {
                    return up;
                }
            }
        }

        return null;
    }

    //------------------------------------------------------------------------------------------
    // Manipulation

    insertChild (child, beforeChild = null) {
        let me = this,
            tail = me._lastChild,
            prevSib;

        if (beforeChild && beforeChild.parent !== me) {
            panik('beforeChild must be a child of this parent');
        }

        child[insertingSym] = true;

        try {
            child.parent = me;  // may unlink child from its previous parent
            child.nextSib = beforeChild;

            if (beforeChild) {
                child.prevSib = prevSib = beforeChild.prevSib;
                beforeChild.prevSib = child;

                if (prevSib) {
                    prevSib.nextSib = child;
                }
                else {
                    me._firstChild = child;
                }
            }
            else {
                if (tail) {
                    tail.nextSib = child;
                }
                else {
                    me._firstChild = child;
                }

                child.prevSib = tail;
                me._lastChild = child;
            }

            ++me.childCount;
        }
        finally {
            child[insertingSym] = false;
        }
    }

    _unlinkChild (child) {
        let me = this,
            { prevSib, nextSib } = child;

        if ((nextSib ? nextSib.parent !== me : (me._lastChild !== child) ) ||
            (prevSib ? prevSib.parent !== me : (me._firstChild !== child) ) ) {
            panik('child is not a child of me parent');
        }

        if (nextSib) {
            nextSib.prevSib = prevSib;
        }
        else {
            me._lastChild = prevSib;
        }

        if (prevSib) {
            prevSib.nextSib = nextSib;
        }
        else {
            me._firstChild = nextSib;
        }

        child.nextSib = child.prevSib = null;

        --me.childCount;
    }
}
