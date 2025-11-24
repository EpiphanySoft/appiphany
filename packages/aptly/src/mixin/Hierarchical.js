import { panik } from '../misc.js';

const
    insertingSym = Symbol('inserting'),
    { create: chainProto, defineProperty, getPrototypeOf: getProto, setPrototypeOf: setProto } = Object,
    createInheritable = p => chainProto(chainProto(p?.inheritable || null)),
    typeMatcher = type => {
        type = type || '';

        let t = typeof type;

        if (t === 'string') {
            if (type === '*') {
                type = '';
            }

            // ex, search for 'widget' or 'button' matches hierarchicalType='widget:button'
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
        parent: class {
            value = null;

            apply(me, parent) {
                for (let up = parent; up; up = up.parent) {
                    if (up === me) {
                        panik('parent cannot be a child of itself');
                    }
                }

                return parent;
            }

            update(me, parent, was) {
                was?._unlinkChild(me);

                let inherited = me.inherited,
                    inheritable = parent?.inheritable;

                if (getProto(inherited) !== inheritable) {
                    setProto(inherited, inheritable);
                }

                !me[insertingSym] && parent?.insertChild(me);
            }
        }
    };

    static hierarchicalType = 'base';

    static proto = {
        [insertingSym]: false,
        childCount: 0,
        nextSib: null,
        prevSib: null
    };

    #firstChild = null;
    #lastChild = null;

    get hierarchicalType () {
        return this.constructor.hierarchicalType;
    }

    get inheritable () {
        let inheritable = createInheritable(this.parent);

        defineProperty(this, 'inheritable', { value: inheritable });  // don't call here again

        return inheritable;
    }

    get inherited () {
        let inherited = getProto(this.inheritable);

        defineProperty(this, 'inherited', { value: inherited });  // don't call here again

        return inherited;
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

        for (let child = this.#firstChild; child; child = child.nextSib) {
            if (matcher(child)) {
                yield child;
            }
        }
    }

    * childrenReverseByType (type = this.hierarchicalType) {
        let matcher = typeMatcher(type);

        for (let child = this.#lastChild; child; child = child.prevSib) {
            if (matcher(child)) {
                yield child;
            }
        }
    }

    firstChildByType (type = this.hierarchicalType) {
        let matcher = typeMatcher(type);

        for (let child = this.#firstChild; child; child = child.nextSib) {
            if (matcher(child)) {
                return child;
            }
        }

        return null;
    }

    lastChildByType (type = this.hierarchicalType) {
        let matcher = typeMatcher(type);

        for (let child = this.#lastChild; child; child = child.prevSib) {
            if (matcher(child)) {
                return child;
            }
        }

        return null;
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
            tail = me.#lastChild,
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
                    me.#firstChild = child;
                }
            }
            else {
                if (tail) {
                    tail.nextSib = child;
                }
                else {
                    me.#firstChild = child;
                }

                child.prevSib = tail;
                me.#lastChild = child;
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

        if ((nextSib ? nextSib.parent !== me : (me.#lastChild !== child) ) ||
            (prevSib ? prevSib.parent !== me : (me.#firstChild !== child) ) ) {
            panik('child is not a child of me parent');
        }

        if (nextSib) {
            nextSib.prevSib = prevSib;
        }
        else {
            me.#lastChild = prevSib;
        }

        if (prevSib) {
            prevSib.nextSib = nextSib;
        }
        else {
            me.#firstChild = nextSib;
        }

        child.nextSib = child.prevSib = null;

        --me.childCount;
    }
}
