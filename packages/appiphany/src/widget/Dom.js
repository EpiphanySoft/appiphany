import { chain, className, isEqual, pop, remove } from '@appiphany/appiphany';

const
    EMPTY_OBJECT = chain();

export class Event {
    static nextListenerId = 0;

    static optionProps = {
        capture : 1,
        once    : 1,
        passive : 1
    };

    static directiveProps = {
        ...Event.optionProps,
        id   : 1,
        this : 1
    };

    static canonicalizeListener (listener) {
        let add = [],
            defaults = {},
            key;

        for (key in Event.optionProps) {
            if (key in listener) {
                defaults[key] = listener[key];
            }
        }

        for (key in listener) {
            if (!(key in Event.directiveProps)) {
                let handler = listener[key],
                    options = defaults,
                    that = listener.this,
                    t = typeof handler;

                if (handler && t === 'object') {
                    options = { ...defaults, ...handler };
                    handler = options.handler;
                    that = pop(options, 'this', that);

                    delete options.handler;
                    t = typeof handler;
                }

                if (t === 'string') {
                    if (typeof that?.[handler] !== 'function') {
                        throw new Error(`No method '${handler}' on ${that?.constructor.name}`);
                    }

                    let name = handler;

                    handler = (...args) => that[name](...args);
                }

                add.push([key, handler, options]);
            }
            // else if (!(key in Event.optionProps)) {
            //     directives[key] = listener[key];
            // }
        }

        return { id: listener.id || `$${++this.nextListenerId}`, on: add };
    }
}

export class Dom {
    #listeners;
    static ELEMENT = 1;
    static TEXT = 3;

    // static key = Symbol('dom');
    static key = '$dom';

    static specialProps = {
        tag   : 1,  // the tagName
        html  : 1,
        owner : 1,
        text  : 1,
        ref   : 1,
        specs : 1,

        class : 1,
        data  : 1,
        style : 1,

        after : 1,
        before: 1,
        parent: 1
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

    //------------------------------------------------------------------------------------------

    constructor (el, owner) {
        owner = owner || null;

        this.el = el || null;
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

    on (listener) {
        listener = Event.canonicalizeListener(listener);

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
        //
    }

    /**
     * A DOM spec is an object with the following properties:
     *
     *  {
     *      html: '',
     *      text: '',
     *
     *      specs: []
     *
     *      // other
     *      href: '',
     *  }
     */
    update (spec, context) {
        context = context || {
            listeners: [],
            refs: {}
        };

        spec = spec || {};

        let { el, spec: was } = this,
            { after, before, parent, listeners, class: cls, tag, html, text, data, ref, specs, style }
                = spec;

        tag = tag || 'div';

        if (!was) {
            was = {};
        }
        else if (isEqual(spec, was)) {
            return;
        }

        if (!el) {
            this.el = el = Dom.getDoc().createElement(tag);
        }
        else if (el.tagName !== tag.toUpperCase()) {
            el.replaceWith(this.el = el = Dom.getDoc().createElement(tag));
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

        ref && context?.refs && (context.refs[ref] = this);

        this.#_updateAttrs(spec, was);
        this.#_updateCls(Dom.canonicalizeClasses(cls), Dom.canonicalizeClasses(was.class));
        this.#_updateData(data, was.data);
        this.#_updateStyle(style, was.style);

        if (text != null) {
            if (text !== was.text) {
                this.#_updateText(text);
            }
        }
        else if (html != null) {
            if (html !== was.html) {
                this.#_updateHtml(html);
            }
        }
        else if (specs != null) {
            this.#_updateSubTree(specs, context);
        }

        this.ref  = ref;
        this.spec = spec;
    }

    #_updateAttrs (attrs, was) {
        let { el } = this,
            name, val;

        for (name in attrs) {
            if (!Dom.specialProps[name]) {
                val = attrs[name];

                if (val !== was[name]) {
                    if (val == null) {
                       el.removeAttribute(name);
                    }
                    else {
                        el.setAttribute(name, val);
                    }
                }
            }
        }

        for (name in was) {
            if (!Dom.specialProps[name]) {
                if (!(name in attrs)) {
                    el.removeAttribute(name);
                }
            }
        }
    }

    #_updateCls (classes, was) {
        let classList = Array.from(this.el.classList),
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

        this.el.className = classList.join(' ');
    }

    #_updateHtml (html) {
        this.el.innerHTML = html;
    }

    #_updateText (text) {
        this.el.textContent = text;
    }

    #_updateData (data, was) {
        // TODO
    }

    #_updateStyle (style, was) {
        // TODO
    }

    #_updateSubTree (specs, context) {
        let doc = this.el.ownerDocument,
            parent = this.el.parentElement,
            children = [],
            { owner, root } = this,
            add, child, dom, isText, old, ref, spec;

        for (child of this.el.childNodes) {
            if ((dom = Dom.get(child))?.owner === owner) {
                children.push(dom);
            }
        }

        children.reverse();  // so pop goes left-to-right

        for (spec of specs) {
            dom = children.pop() || null;
            child = dom.el;
            isText = child?.nodeType === Dom.TEXT;

            if (typeof spec === 'string') {
                if (child && isText) {
                    if (dom.spec !== spec) {
                        child.nodeValue = dom.spec = spec;
                    }
                }
                else {
                    add = doc.createTextNode(spec);
                    dom = Dom.get(add);
                    dom.owner = owner;
                    dom.root = root;
                    dom.spec = spec;

                    parent.insertBefore(add, child);
                    child && children.push(child);
                }
            }
            else {
                if (isText) {
                    child && children.push(child);
                    child = dom = null;
                }
                // context.refs is the new refs, where owner.refs is the previous refs
                else if ((ref = spec.ref) && (old = owner?.refs?.[ref]) && old !== dom) {
                    child && children.push(child);

                    child = old.el;
                    dom = old;
                    remove(children, child);
                }

                if (dom) {
                    dom.update(spec, context);
                }
                else {
                    dom = new Dom();
                    dom.owner = owner;
                    dom.root = root;

                    dom.update(spec, context);

                    parent.insertBefore(dom.el, child);
                }
            }
        }

        while ((dom = children.pop())) {
            dom.el.remove();
        }
    }
}
