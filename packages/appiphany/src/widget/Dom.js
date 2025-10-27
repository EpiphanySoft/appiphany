import { pop } from '@appiphany/appiphany';


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

    // static key = Symbol('dom');
    static key = '$dom';

    static specialProps = {
        $: 1,  // the element type/tagName
        html  : 1,
        text  : 1,
        specs : 1
    };

    static get (el) {
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

        return el && (el[Dom.key] ??= new Dom(el));
    }

    static get doc () {
        return Dom.get(document);
    }

    static get body () {
        return Dom.get('body');
    }

    static get html () {
        return Dom.get('html');
    }

    constructor (el) {
        this.el = el;
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
    update (spec) {
        //
    }
}
