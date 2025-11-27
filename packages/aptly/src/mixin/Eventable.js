import { chain } from '@appiphany/aptly';

const
    SPECIALS = 'name,once,this'.split(','),
    canon = chain(),
    addCanon = s => canon[s] = s,
    canonicalize = name => canon[name] ??= addCanon(name.toLowerCase());


class Handlers {
    constructor (eventName) {
        this.name = eventName;
    }
}


export const Eventable = Base => class Eventable extends Base {
    static configurable = {
        on: class {
            value = null;
            phase = 'init';

            apply (me, on) {
                if (Array.isArray(on)) {
                    on.forEach(o => me.listen(o));
                }
                else if (on) {
                    me.listen(on);
                }
            }

            merge (was, value) {
                // was = { click: 'foo' }, value = { click: 'bar' }
                //  => [{ click: 'foo' }, { click: 'bar' }]
                if (value && was) {
                    value = Array.isArray(was) ? [...was, value] : [was, value];
                }

                return value || was;
            }
        }
    };

    #handlers = null;

    fire (ev) {
        //
    }

    listen (on) {
        let handlers = this.#handlers ??= chain(),
            { name, once, this: that } = on,
            eventName, fn;

        for (eventName in on) {
            eventName = canonicalize(eventName);

            if (!SPECIALS.includes(eventName)) {
                fn = on[eventName];
            }
        }
    }

    unlisten () {
        //
    }
}
