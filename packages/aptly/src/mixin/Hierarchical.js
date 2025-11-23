import { panik } from '../misc.js';

const
    insertingSym = Symbol('inserting');

/**
 *
 */
export const Hierarchical = Base => class Hierarchical extends Base {
    static configurable = {
        parent: class {
            value = null;

            update(me, v, was) {
                debugger;
                was?._unlinkChild(me);

                !me[insertingSym] && v?.insertChild(me);
            }
        }
    };

    static hierarchicalType = 'base';

    static proto = {
        [insertingSym]: false,
        nextSib: null,
        prevSib: null
    };

    #firstChild = null;
    #lastChild = null;

    get hierarchicalType () {
        return this.constructor.hierarchicalType;
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

    * children (type = this.hierarchicalType) {
        for (let child = this.#firstChild; child; child = child.nextSib) {
            if (type === '*' || type === child.hierarchicalType) {
                yield child;
            }
        }
    }

    firstChild (type = this.hierarchicalType) {
        for (let child = this.#firstChild; child; child = child.nextSib) {
            if (type === '*' || type === child.hierarchicalType) {
                return child;
            }
        }

        return null;
    }

    lastChild (type = this.hierarchicalType) {
        for (let child = this.#lastChild; child; child = child.prevSib) {
            if (type === '*' || type === child.hierarchicalType) {
                return child;
            }
        }

        return null;
    }

    insertChild (child, refChild = null) {
        let me = this,
            tail = me.#lastChild,
            prevSib;

        if (refChild && refChild.parent !== me) {
            panik('refChild must be a child of this parent');
        }

        child[insertingSym] = true;

        try {
            child.parent = me;
            child.nextSib = refChild;

            if (!refChild) {
                if (tail) {
                    tail.nextSib = child;
                }
                else {
                    me.#firstChild = child;
                }

                child.prevSib = tail;

                me.#lastChild = child;
            }
            else {
                child.prevSib = prevSib = refChild.prevSib;

                refChild.prevSib = child;

                if (prevSib) {
                    prevSib.nextSib = child;
                }
                else {
                    me.#firstChild = child;
                }
            }
        }
        finally {
            child[insertingSym] = false;
        }
    }

    _unlinkChild (child) {
        let { prevSib, nextSib } = child;

        if ((nextSib ? nextSib.parent : this.#lastChild) !== this ||
            (prevSib ? prevSib.parent : this.#firstChild) !== this ) {
            panik('child is not a child of this parent');
        }

        if (nextSib) {
            nextSib.prevSib = prevSib;
        }
        else {
            this.#lastChild = prevSib;
        }

        if (prevSib) {
            prevSib.nextSib = nextSib;
        }
        else {
            this.#firstChild = nextSib;
        }

        child.nextSib = child.prevSib = null;
    }
}
