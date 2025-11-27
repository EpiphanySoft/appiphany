import { applyTo, chain, remove, Destroyable } from '@appiphany/aptly';

const
    NOP = () => {},
    SPECIALS = 'id,once,this'.split(','),
    canon = chain(),
    addCanon = s => canon[s] = s,
    canonicalize = type => canon[type] ??= addCanon(type.toLowerCase()),
    { defineProperty } = Reflect,
    { now } = performance,
    removeEntry = ([h, entry]) => h.remove(entry),
    getOptions = (on, me) => {
        let options = {},
            key;

        for (key of SPECIALS) {
            if (on && key in on) {
                options[key] = on[key];
            }
        }

        if (options.this === 'me') {
            options.this = me;
        }

        return options;
    },
    unify = (id, entries, listeners) => () => {
        let ent = entries, lst = listeners;

        entries = listeners = null;

        ent?.forEach(removeEntry);
        lst?.set(id, null);
    };


class Event {
    constructor (sender, options) {
        let me = this;

        me.target = sender;

        if (typeof options === 'string') {
            me.type = options;
        }
        else {
            applyTo(me, options);
        }

        me.sender = sender;
        me.stopped = false;
        me.t0 = now();
        me.t1 = 0;
        me.type = canonicalize(me.type);
    }

    get done () {
        return !!this.t1;
    }

    get duration () {
        return (this.t1 || now()) - this.t0;
    }

    finish () {
        this.t1 = this.t1 || now();
    }

    stop () {
        this.finish();
        this.stopped = true;
    }
}

/**
 * This class tracks handlers for a particular event type.
 */
class Handlers {
    constructor (type) {
        // this.owner = owner;
        this.type = type;
        this.entries = [];
        this.firing = null;
    }

    add (descr, options) {
        let entries = this.mutate();

        // TODO
    }

    fire (ev) {
        let me = this,
            { entries } = me,
            recursed = me.firing === entries,
            entry;

        if (entries.length) {
            me.firing = entries;

            try {
                for (entry of entries) {
                    // TODO

                    if (ev.stopped) {
                        break;
                    }
                }
            }
            finally {
                if (me.firing === entries && !recursed) {
                    me.firing = null;
                }
            }
        }
    }

    mutate () {
        let me = this,
            { entries } = me;

        if (entries && me.firing === entries) {
            me.entries = entries = entries.slice();
            // since we are currently firing using the old entries, and we've cloned the
            // entries array, we need to clear the firing state so that a nested fire()
            // call will protect the cloned entries.
            me.firing = null;
        }

        return entries;
    }

    remove (entry) {
        let entries = this.mutate();

        remove(entries, entry);
    }
}

/**
 * This class is used to bolt on listener information to objects that listen for events
 * from other objects. For example:
 *
 *      let foo = new Foo(...);
 *
 *      let bar = new Bar(...);
 *
 *      bar.listen({
 *          this: foo
 *      })
 */
class Listeners extends Destroyable {
    static SYM = Symbol('listeners');

    static from (options, me) {
        let listeners = null;

        // don't create a Listeners object when listening to yourself
        if (options.this !== me) {
            listeners = Listeners.get(options.this);

            if (!options.id) {
                options.id = listeners.nextId();
            }
        }

        return listeners;
    }

    static get (owner) {
        return owner && (owner[Listeners.SYM] ??= new Listeners(owner));
    }

    constructor (owner) {
        super();

        let me = this;

        me.idSeed = 0;
        me.listeners = chain();

        owner[Listeners.SYM] = me;
        owner.cascadeDestroy(me);

        defineProperty(owner, 'unlisten', { value: id => me.un(id) });
    }

    destruct () {
        let { listeners } = this,
            id;

        this.listeners = null;

        if (listeners) {
            for (id in listeners) {
                listeners[id]();
            }
        }

        super.destruct();
    }

    nextId () {
        return `:${++this.idSeed}`;
    }

    set (id, un) {
        let { listeners } = this,
            was = listeners?.[id];

        if (listeners) {
            delete listeners[id];

            was?.();  // reentrancy occurs here, so call the un() after deleting the id

            if (un) {
                listeners[id] = un;
            }
        }

        return id;
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
        ev = new Event(this, ev);

        this.#handlers?.[ev.type]?.fire(ev);

        ev.finish();

        return ev;
    }

    listen (on) {
        let me = this,
            handlers = me.#handlers ??= chain(),
            options = getOptions(on, me),
            listeners = Listeners.from(options, me),  // listeners ==> options.id is set
            entries, entry, h, type, un;

        for (type in on) {
            if (!SPECIALS.includes(type)) {
                type = canonicalize(type);
                h = handlers[type] ??= new Handlers(type);

                entry = h.add(on[type], options);
                (entries ??= []).push([h, entry]);
            }
        }

        if (entries) {
            un = unify(options.id, entries, listeners);
            listeners?.set(options.id, un);
        }

        return un || NOP;
    }
}
