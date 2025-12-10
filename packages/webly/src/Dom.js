import { c2h, chain, className, clone, decapitalize, decimalRe, h2c, isEqual,
         isObject, remove }
    from '@appiphany/aptly';

import { Event } from '@appiphany/webly';

const
    EMPTY_OBJECT = chain(),
    TRBL = ['Top', 'Right', 'Bottom', 'Left'],
    c2d = s => `data-${c2h(s)}`,
    cartesianJoin = (a, b) => a.map(x => b.map(y => decapitalize(`${x}${y}`))).flat(),
    colonRe = /\s*:\s*/g,
    semiRe = /\s*;\s*/g;

//================================================================================================

class StyleHandler {
    constructor (name, units) {
        this.name = name;
        this.units = units;
    }

    set (el, value) {
        if (value == null) {
            el.style.removeProperty(this.name);
        }
        else {
            el.style.setProperty(this.name, this.unitize(value));
        }
    }

    unitize (value) {
        if (value != null) {
            value = String(value);

            if (this.units && decimalRe.test(value)) {
                value += this.units;
            }
        }

        return value;
    }
}


//================================================================================================

export class Style {
    static #handlers = chain();  // [hyphenatedName] = StyleHandler

    static grok (name, units) {
        let hyphenatedName = c2h(name); // c2h caches the name to hyphenatedName mapping

        return this.#handlers[hyphenatedName] ??= new StyleHandler(hyphenatedName, units);
    }

    static parse (style) {
        return (typeof style === 'string')
            ? Object.fromEntries(style.split(semiRe).map(entry => entry.split(colonRe)))
            : (style || {});
    }

    static applyTo (el, styles) {
        if (el && styles) {
            for (let name in styles) {
                Style.grok(name).set(el, styles[name]);
            }
        }
    }
}

// Register standard CSS properties with px default units:
[   ...cartesianJoin(['margin', 'padding', ''], TRBL),
    ...cartesianJoin([...cartesianJoin(['border'], TRBL), 'max', 'min', 'outline', ''], ['Width']),
    ...cartesianJoin(['max', 'min', 'line', ''], ['Height'])
].forEach(name => Style.grok(name, 'px'));


//================================================================================================

export class Dom {
    static ELEMENT = 1;
    static TEXT = 3;

    // static key = Symbol('dom');
    static key = '$dom';

    static specialProps = {
        tag      : 1,  // the tagName
        html     : 1,
        aria     : 1,
        on       : 1,
        owner    : 1,
        text     : 1,
        ref      : 1,
        refs     : 1,
        children : 1,

        class    : 1,
        data     : 1,
        style    : 1,

        after    : 1,
        before   : 1,
        parent   : 1
    };

    static get body () {
        return Dom.get(Dom.getBody());
    }

    static get doc () {
        return Dom.get(Dom.getDoc());
    }

    static get docRoot () {
        return Dom.get(Dom.getDocRoot());
    }

    static get limbo () {
        return Dom.get(Dom.getLimbo());
    }

    static get win () {
        return Dom.get(Dom.getWin());
    }

    static canonicalizeClasses (classes) {
        let ret = classes;

        if (typeof classes === 'string') {
            classes = classes.split(' ');
        }

        if (Array.isArray(classes)) {
            ret = chain();

            classes.forEach(cls => {
                let s = cls.trim();

                if (s) {
                    ret[s] = true;
                }
            });
        }

        return ret || EMPTY_OBJECT;
    }

    static canonicalizeSpecs (specs) {
        if (isObject(specs)) {
            /*
             TODO
                specs: {
                    a: {
                        '>': 'foo'
                    },
                    b: {
                        '>': 'foo'
                    },
                    foo: { ... },
                    c: {
                        '<': 'foo'
                    },
                    d: {
                        '<': 'foo'
                    }
                }
             */
            let obj = specs,
                refs = {},
                anchors, key, to, val;

            specs = [];

            for (key in obj) {
                val = obj[key];

                if (val) {
                    refs[key] = val = clone(val);
                    val.ref = key;

                    if ((to = val['>'] || val['<'])) {
                        ((anchors ??= {})[to] ??= []).push(val);
                    }

                    specs.push(val);
                }
            }

            if (anchors) {
                for (key in anchors) {
                    to = refs[key];

                    for (val of anchors[key]) {
                        //
                    }
                }
            }
        }

        return specs;
    }

    static get (el) {
        if (el instanceof Dom) {
            return el;
        }

        if (typeof el === 'string') {
            let t = document.getElementById(el);

            if (t) {
                el = t;
            }
            else {
                try {
                    t = document.querySelectorAll(el);

                    if (t.length > 1) {
                        console.warn(`Multiple elements found for selector "${el}"`);
                    }

                    if (t.length) {
                        el = t[0];
                    }
                }
                catch (e) {
                    el = null;
                }
            }
        }

        if (!el) {
            return null;
        }

        return el[Dom.key] ??= new Dom(el);
    }

    static getBody (el) {
        return Dom.getDoc(el)?.body;
    }

    static getDoc (el) {
        if (Dom.isDoc(el)) {
            return el;
        }

        if (Dom.isWin(el)) {
            return el.document;
        }

        return el?.ownerDocument || document;
    }

    static getDocRoot (el) {
        return Dom.getDoc(el)?.body.parentElement;
    }

    static getEl (domOrEl) {
        return (domOrEl instanceof Dom) ? domOrEl.el : Dom.is(domOrEl) ? domOrEl : null;
    }

    static getLimbo (el) {
        let doc = Dom.getDoc(el),
            limbo = doc?.$limbo;

        if (doc && !limbo) {
            doc.$limbo = limbo = doc.createElement('div');
            limbo.id = 'limbo';
            limbo.className = 'x-limbo';
            doc.head.appendChild(limbo);
        }

        return limbo;
    }

    static getWin (el) {
        if (Dom.isWin(el)) {
            return el;
        }

        return Dom.getDoc(el)?.defaultView || window;
    }

    /**
     * EventTarget (base for all)
     * └── Node (base interface for DOM nodes)
     *     ├── Document (nodeType: 9)
     *     ├── DocumentFragment (nodeType: 11)
     *     ├── DocumentType (nodeType: 10)
     *     ├── CharacterData (abstract; nodeType: 3/4/8)
     *     │   ├── Text (nodeType: 3)
     *     │   ├── Comment (nodeType: 8)
     *     │   └── ProcessingInstruction (nodeType: 7)
     *     └── Element (nodeType: 1; inherits Node)
     *         ├── HTMLElement (HTML-specific elements)
     *         │   ├── HTMLBodyElement
     *         │   ├── HTMLDivElement
     *         │   ├── HTMLAnchorElement
     *         │   ├── HTMLImageElement
     *         │   └── ... (many more HTML*Element subclasses)
     *         ├── SVGElement (SVG-specific elements)
     *         │   ├── SVGCircleElement
     *         │   ├── SVGPathElement
     *         │   └── ... (SVG*Element subclasses)
     *         └── MathMLElement (MathML-specific)
     *             └── ... (MathML*Element subclasses)
     */
    static is (el) {
        let w = Dom.getWin(el);  // Window instanceof Node === false

        return el === w || (el instanceof w.Node);
    }

    static isDoc (el) {
        return className(el) === 'Document';
    }

    static isElement (el) {
        return el instanceof Dom.getWin(el).Element;
    }

    static isWin (el) {
        return className(el) === 'Window';
    }

    static onReady (fn) {
        Dom.getDoc().addEventListener('DOMContentLoaded', fn);
    }

    //------------------------------------------------------------------------------------------

    #listeners = null;
    #ownerListeners = null;

    constructor (el, owner) {
        owner = owner || null;

        this.el = el || null;
        this.adopted = !!(owner && el);
        this.owner = owner;
        this.refs = owner && chain();
        this.root = owner && this;
    }

    get id () {
        return this.el?.id;
    }

    get childCount () {
        return this.el?.childElementCount ?? 0;
    }

    destroy () {
        !this.adopted && this.el?.remove();
        this.el = null;

        this.#ownerListeners?.();
        this.#ownerListeners = null;
    }

    create (tag) {
        let el = Dom.getDoc().createElement(tag);

        el[Dom.key] = this;

        this.el = el;

        return el;
    }

    on (listener) {
        listener = Event.canonicalizeListener(listener, this.owner);

        let { id } = listener,
            ret = () => this.un(id),
            entry;

        ret.id = id;
        ret();  // in case id is reused

        (this.#listeners ??= new Map()).set(id, listener);

        for (entry of listener.on) {
            this.el.addEventListener(...entry);
        }

        return ret;
    }

    un (id) {
        let el = this.el,
            listener = el && this.#listeners?.get(id),
            entry;

        if (listener) {
            this.#listeners.delete(id);

            for (entry of listener.on) {
                this.el.removeEventListener(...entry);
            }
        }
    }

    setClasses (classes) {
        this._updateCls(classes, {});
    }

    setStyles (styles) {
        Style.applyTo(this.el, styles);
    }

    /**
     * A DOM spec is an object with the following properties:
     *
     *  {
     *      html: '',
     *      text: '',
     *
     *      children: []
     *
     *      // other
     *      href: '',
     *  }
     */
    update (spec, context) {
        let me = this,
            { el, spec: was } = me,
            { after, before, children, parent, tag, html, text, data, ref, style,
              on: listeners, class: cls } = (spec ??= {});

        // unwrap any Dom instances
        after = after?.el || after;
        before = before?.el || before;
        parent = parent?.el || parent;

        tag = tag || 'div';

        context = context || {
            owner: me.owner,
            refs: me.refs,
            parent: me,
            root: me
        };

        if (!was) {
            was = {};
        }
        else if (isEqual(spec, was)) {
            return;
        }

        if (!el) {
            me.create(tag);
        }
        else if (!me.adopted && el.tagName !== tag.toUpperCase()) {
            el.replaceWith(el = me.create(tag));
        }

        if (before) {
            if (el.nextElementSibling !== before) {
                before.parentElement.insertBefore(el, before);
            }
        }
        else if (after) {
            before = after.nextElementSibling;

            if (before !== el) {
                after.parentElement.insertBefore(el, before);
            }
        }
        else if (parent && parent !== el.parentElement) {
            parent.appendChild(el);
        }

        if (ref) {
            if (ref[0] === '_' && context.parent) {
                (context.parent.refs ??= chain())[ref] = me;
            }
            else {
                context?.refs && (context.refs[ref] = me);
            }
        }

        me._updateAttrs(spec, was);
        me._updateAttrs(spec.aria || EMPTY_OBJECT, was.aria || EMPTY_OBJECT, 'aria-');
        me._updateCls(Dom.canonicalizeClasses(cls), Dom.canonicalizeClasses(was.class));
        me._updateData(data, was.data);
        me._updateStyle(style, was.style);

        if (text != null) {
            if (text !== was.text) {
                me._updateText(text);
            }
        }
        else if (html != null) {
            if (html !== was.html) {
                me._updateHtml(html);
            }
        }
        else if (children) {
            if (spec.refs && context.refs !== me.refs) {
                context = {
                    ...context,
                    parent: me,
                    refs: me.refs ??= chain()
                };
            }
            else if (context.parent !== me) {
                context = { ...context, parent: me };
            }

            me._updateSubTree(Dom.canonicalizeSpecs(children), context);
        }

        if (!isEqual(listeners, was.on)) {
            me.#ownerListeners?.();
            me.#ownerListeners = listeners ? me.on(listeners) : null;
        }

        me.ref  = ref;
        me.spec = spec;
    }

    _updateAttrs (attrs, was, prefix = '') {
        let { el } = this,
            name, val;

        for (name in attrs) {
            if (prefix || !Dom.specialProps[name]) {
                val = attrs[name];

                if (val !== was[name]) {
                    if (val == null) {
                       el.removeAttribute(prefix + name);
                    }
                    else {
                        el.setAttribute(prefix + name, val);
                    }
                }
            }
        }

        for (name in was) {
            if (prefix || !Dom.specialProps[name]) {
                if (!(name in attrs)) {
                    el.removeAttribute(prefix + name);
                }
            }
        }
    }

    _updateCls (classes, was) {
        let { el } = this,
            classList = Array.from(el.classList),
            cls;

        for (cls in classes) {
            if (!classes[cls]) {
                remove(classList, cls);
            }
            else if (!classList.includes(cls)) {
                classList.push(cls);
            }
        }

        for (cls in was) {
            if (!(cls in classes)) {
                remove(classList, cls);
            }
        }

        cls = classList.join(' ').trim();

        !cls && el.removeAttribute('class');
        cls && el.setAttribute('class', cls);
    }

    _updateHtml (html) {
        this.el.innerHTML = html;
    }

    _updateText (text) {
        this.el.textContent = text;
    }

    _updateData (data, was) {
        let { el } = this,
            key, name, value;

        data ??= {};
        was ??= {};

        for (key in data) {
            if ((value = data[key]) !== was[key]) {
                name = c2d(key);

                if (value == null) {
                    el.removeAttribute(name);
                }
                else {
                    el.setAttribute(name, value);
                }
            }
        }

        for (key in was) {
            if (!(key in data)) {
                el.removeAttribute(c2d(key));
            }
        }
    }

    _updateStyle (style, was) {
        let delta, key;

        style = Style.parse(style);
        was = Style.parse(was);

        for (key in style) {
            if (style[key] !== was[key]) {
                (delta ??= {})[key] = style[key];
            }
        }

        for (key in was) {
            if (!(key in style)) {
                (delta ??= {})[key] = '';
            }
        }

        delta && Style.applyTo(this.el, delta);
    }

    _updateSubTree (specs, context) {
        let parent = this.el,
            doc = parent.ownerDocument,
            children = [],
            { owner, root } = context,
            add, childEl, dom, isText, nodeType, old, ref, spec, specEl;

        for (childEl of parent.childNodes) {
            nodeType = childEl.nodeType;

            if (nodeType === Dom.TEXT || nodeType === Dom.ELEMENT) {
                if ((dom = Dom.get(childEl))?.owner === owner) {
                    children.push(dom);
                }
            }
        }

        children.reverse();  // so pop goes left-to-right

        for (spec of specs) {
            dom = children.pop() || null;
            childEl = dom?.el;
            isText = childEl?.nodeType === Dom.TEXT;

            if (typeof spec === 'string') {
                if (childEl && isText) {
                    if (dom.spec !== spec) {
                        childEl.nodeValue = dom.spec = spec;
                    }
                }
                else {
                    add = doc.createTextNode(spec);
                    dom = Dom.get(add);
                    dom.owner = owner;
                    dom.root = root;
                    dom.spec = spec;

                    parent.insertBefore(add, childEl);
                    childEl && children.push(childEl);
                }
            }
            else {
                specEl = Dom.getEl(spec);

                if (specEl) {
                    remove(children, specEl);

                    if (childEl !== specEl) {
                        parent.insertBefore(specEl, childEl);
                        childEl && children.push(childEl);
                    }

                    continue;
                }

                if (isText) {
                    childEl && children.push(childEl);
                    childEl = dom = null;
                }
                // context.refs is the new refs, where owner.refs is the previous refs
                else if ((ref = spec.ref) && (old = owner?.refs?.[ref]) && old !== dom) {
                    childEl && children.push(childEl);

                    childEl = old.el;
                    dom = old;
                    remove(children, childEl);
                }

                if (dom) {
                    dom.update(spec, context);
                }
                else {
                    dom = new Dom();
                    dom.owner = owner;
                    dom.root = root;

                    dom.update(spec, context);

                    parent.insertBefore(dom.el, childEl);
                }
            }
        }

        while ((dom = children.pop())) {
            dom.destroy();
        }
    }
}

globalThis.Dom = Dom;
