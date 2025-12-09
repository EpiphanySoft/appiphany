import { panik, chain, applyTo } from '@appiphany/aptly';
import { Delayable } from '@appiphany/aptly/mixin';

const
    insertingSym = Symbol('inserting'),
    { create: chainProto, getPrototypeOf: getProto, setPrototypeOf: setProto } = Object,
    root = applyTo(chainProto(null), {
        hierarchyGeneration: 0
    }),
    createInheritable = p => chainProto(chainProto(p?.inheritable || root)),
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
    #map = null;
    #owner;

    constructor (owner) {
        this.#owner = owner;
        this.rebuilds = 0;
    }

    get map () {
        let me = this;

        if (!me.#map) {
            me.#map = chain();
            ++me.rebuilds;
            me.rebuild(me.#owner);
        }

        return me.#map;
    }

    invalidate () {
        if (this.#map) {
            this.#map = null;
            ++root.hierarchyGeneration;
        }
    }

    lookup (ref) {
        return this.map[ref];
    }

    rebuild (node) {
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
                this.rebuild(child);
            }
        }
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
export const Hierarchical = Base => class Hierarchical extends Base.mixin(Delayable) {
    static configurable = {
        /**
         * @config {Boolean|String}
         * @default false
         * When set to a truthy value, this node will be published to the `inheritable`
         * information object using the name `'nexus'`. This allows other nodes below
         * this one to access the information using `inherited.nexus`.
         *
         * This node itself may be part of a nexus defined at higher levels, in which case
         * the nexus to which this node belongs is found as `inherited.nexus` (the inherited
         * info object for this node).
         */
        nexus: class {
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
            update (me) {
                me.inherited.nexus?.refs.invalidate();
            }
        }
    };

    static delayable = {
        _reindexChildren: 'sched'
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
            me._reindexChildren();
        }
        finally {
            child[insertingSym] = false;
        }
    }

    _reindexChildren () {
        // this has to be delayed because it will create an invalidation loop between the
        // parent/child compose methods
        let counter = 0,
            child, domain, domains, index;

        for (child = this._firstChild; child; child = child.nextSib) {
            if (child.$meta.configs.index) {
                domain = child.childDomain;

                if (!domain) {
                    index = counter++;
                }
                else {
                    index = (domains ??= {})[domain] || 0;
                    domains[domain] = index + 1;
                }

                // console.log(`reindexing ${this.id} child ${child.id}: ${index}`);
                child.index = index;
            }
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
        me._reindexChildren();
    }
}
