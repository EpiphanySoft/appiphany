import { panik, pop } from '@appiphany/appiphany';


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

    static canonicalizeListener (listener, owner) {
        let canon = [],
            defaults = {},
            add = key => {
                // a new scope to ensure no stale closures
                let handler = listener[key],
                    options = defaults,
                    that = listener.this || owner,
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
                        panik(`No method '${handler}' on ${that?.constructor.name}`);
                    }

                    let name = handler;

                    handler = (...args) => that[name](...args);
                }

                canon.push([key, handler, options]);
            },
            key;

        for (key in Event.optionProps) {
            if (key in listener) {
                defaults[key] = listener[key];
            }
        }

        for (key in listener) {
            if (!(key in Event.directiveProps)) {
                add(key);
            }
            // else if (!(key in Event.optionProps)) {
            //     directives[key] = listener[key];
            // }
        }

        return { id: listener.id || `$${++this.nextListenerId}`, on: canon };
    }
}
