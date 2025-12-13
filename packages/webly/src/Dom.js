import { c2h, chain, className, clone, decapitalize, decimalRe, h2c, isEqual,
         isObject, remove, EMPTY_OBJECT }
    from '@appiphany/aptly';

import { Event } from '@appiphany/webly';

const
    TRBL = ['Top', 'Right', 'Bottom', 'Left'],
    ELEMENT = 1,
    TEXT = 3,
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

class SyncContext {
    constructor (root) {
        let me = this;

        me.outer = me.reuse = me.tailEl = null;

        me.oldRefs = root.refs;
        me.parent = root;
        me.root = root;
        me.refs = root.refs = chain();
        me.local = { oldRefs: me.oldRefs, refs: me.refs };
    }

    before () {
        return this.reuse?.[0]?.el || this.tailEl;
    }

    cleanup () {
        let me = this,
            { oldRefs, reuse } = me,
            dom, ref;

        if (me.outer) {
            while ((dom = reuse?.pop())) {
                // if the dom has a ref attr, it will be cleaned up as part of oldRefs
                // at the end of the sync
                !dom.ref && dom.destroy();
            }
        }
        else if (oldRefs) {
            for (ref in oldRefs) {
                debugger;
            }
        }
    }

    placeElement (dom) {
        this.parent.el.insertBefore(dom.el, this.before());
    }

    pull (t) {
        let children = this.reuse,
            i = 0;

        if (!children) {
            for (let d of children) {
                if (d.el.nodeType === t) {
                    children.splice(i, 1);

                    return d;
                }

                ++i;
            }
        }
    }

    reused (dom) {
        for (let c = this; c; c = c.outer) {
            remove(c.reuse, dom);
        }
    }

    scan () {
        let me = this,
            { owner } = me.root,
            childEl, dom, nodeType;

        for (childEl of me.parent.el.childNodes) {
            nodeType = childEl.nodeType;

            if (nodeType === ELEMENT || nodeType === TEXT) {
                if ((dom = Dom.get(childEl))?.owner === owner) {
                    !dom.ref && (me.reuse ??= []).push(dom);
                    me.tailEl = childEl.nextSibling;
                }
            }
        }
    }

    spawn (dom) {
        let ret = chain(this),
            { refs } = dom;

        ret.outer = this;
        ret.parent = dom;
        ret.local = { oldRefs: refs || EMPTY_OBJECT, refs: dom.refs = null };

        return ret;
    }

    track (dom) {
        let me = this,
            { ref } = dom,
            local = ref[0] === '_',
            // when we track() a Dom object we have already spawn()ed a sub-context for it
            // to track its children, so we need to use the outer context to track the ref
            // of the parent Dom object
            parentContext = me.outer || me,
            old = local ? parentContext.local.oldRefs : me.oldRefs,
            refs = local ? parentContext.local.refs ??= parentContext.parent.refs = chain(): me.refs;

        if (old[ref] === dom) {
            delete old[ref];
        }

        refs[ref] = dom;
    }

    unchanged (dom) {
        let me = this,
            { oldRefs, refs } = me,
            { oldRefs: oldLocalRefs } = me.local,
            c, ref;

        dom.ref && dom !== me.root && me.track(dom);

        for (ref in oldRefs) {
            c = oldRefs[ref];

            if (c !== dom && dom.el.contains(c.el)) {
                delete oldRefs[ref];
                refs[ref] = c;
            }
        }

        if (oldLocalRefs && oldLocalRefs !== oldRefs) {
            me.parent.refs = oldLocalRefs;
            me.local.oldRefs = null;
        }
    }
}

//================================================================================================

export class Dom {
    static ELEMENT = ELEMENT;
    static TEXT = TEXT;

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

    static canonicalizeSpecs (specs, topoKey = '>') {
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
                        '>': '^foo'
                    },
                    d: {
                        '>': '^foo'
                    }
                }
             */
            let obj = specs,
                refs = {},
                key, to, topo, val;

            specs = [];

            for (key in obj) {
                val = obj[key];

                if (val) {
                    refs[key] = val = clone(val);
                    val.ref = key;
                    to = val[topoKey];

                    if (to) {
                        topo ??= {};
                        delete val[topoKey];

                        if (to[0] !== '^') {
                            (topo[to] ??= []).push(key);  // key is predecessor of foo
                        }
                        else {
                            (topo[key] ??= []).push(to.slice(1));  // foo is predecessor of key
                        }
                    }

                    specs.push(val);
                }
            }

            if (topo) {
                to = [];

                specs.forEach(function add (sp) {
                    if (sp && refs[sp.ref]) {
                        delete refs[sp.ref];  // break circular dependencies => infinite recursion
                        topo[sp.ref]?.forEach(ref => add(refs[ref]));
                        to.push(sp);
                    }
                });

                specs = to;
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

        return el.$dom || new Dom(el);
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
        let me = this;

        owner = owner || null;

        el && !el[Dom.key] && (el[Dom.key] = me);

        me.el = el || null;
        me.adopted = !!(owner && el);
        me.owner = owner;
        me.refs = owner && chain();
        me.root = owner && me;
    }

    get id () {
        return this.el?.id;
    }

    get childCount () {
        return this.el?.childElementCount ?? 0;
    }

    destroy () {
        let me = this;

        !me.adopted && me.el?.remove();
        me.el = null;

        me.#ownerListeners?.();
        me.#ownerListeners = null;
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
        this._syncCls(classes, {});
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
    sync (spec, context) {
        let me = this,
            { el, spec: was } = me;

        context = context ? context.spawn(me) : new SyncContext(me);

        if (!was) {
            was = {};
        }
        else if (isEqual(spec, was)) {
            context.unchanged(me);
            return;
        }

        let { after, before, children, parent, tag, html, text, data, ref, style,
              on: listeners, class: cls } = (spec ??= {});

        // unwrap any Dom instances
        after = after?.el || after;
        before = before?.el || before;
        parent = parent?.el || parent;

        tag = tag || 'div';

        me.ref  = ref;
        me.spec = spec;

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

        ref && context.track(me);

        me._syncAttrs(spec, was);
        me._syncAttrs(spec.aria || EMPTY_OBJECT, was.aria || EMPTY_OBJECT, 'aria-');
        me._syncCls(Dom.canonicalizeClasses(cls), Dom.canonicalizeClasses(was.class));
        me._syncData(data, was.data);
        me._syncStyle(style, was.style);

        if (text != null) {
            if (text !== was.text) {
                me._syncText(text);
            }
        }
        else if (html != null) {
            if (html !== was.html) {
                me._syncHtml(html);
            }
        }
        else if (children) {
            me._syncTree(Dom.canonicalizeSpecs(children), context);
        }

        if (!isEqual(listeners, was.on)) {
            me.#ownerListeners?.();
            me.#ownerListeners = listeners ? me.on(listeners) : null;
        }

        context.cleanup();
    }

    _syncAttrs (attrs, was, prefix = '') {
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

    _syncCls (classes, was) {
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

    _syncHtml (html) {
        this.el.innerHTML = html;
    }

    _syncText (text) {
        this.el.textContent = text;
    }

    _syncData (data, was) {
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

    _syncStyle (style, was) {
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

    _syncTree (specs, context) {
        let me = this,
            doc = me.el.ownerDocument,
            { root } = context,
            { owner } = root,
            add, dom, old, oldRefs, ref, spec, specEl;

        context.scan();

        for (spec of specs) {
            if (typeof spec === 'string') {
                dom = context.pull(TEXT);

                if (dom) {
                    if (dom.spec !== spec) {
                        dom.el.nodeValue = dom.spec = spec;
                    }
                }
                else {
                    add = doc.createTextNode(spec);
                    dom = Dom.get(add);
                    dom.owner = owner;
                    dom.root = root;
                    dom.spec = spec;

                    context.placeElement(add);
                }

                continue;
            }

            //-----------------------------------
            ref = spec.ref;
            oldRefs = ((ref?.[0] === '_') ? context.local : context).oldRefs;
            old = oldRefs[ref];
            specEl = Dom.getEl(spec);

            if (specEl) {
                dom = Dom.get(specEl);

                if (old === dom) {
                    delete oldRefs[ref];  // preserve the Dom instance
                }

                context.reused(dom);
                spec = null;
            }
            // spec is a child spec object (not an Element or Dom instance)
            else if ((dom = old)) {
                delete oldRefs[ref];  // preserve the Dom instance
                context.reused(dom);
            }
            // don't reuse elements to create a ref el:
            else if (ref || !(dom = context.pull(ELEMENT))) {
                dom = new Dom();
                dom.owner = owner;
                dom.root = root;
            }

            spec && dom.sync(spec, context);

            context.placeElement(dom);
        }
    }
}
