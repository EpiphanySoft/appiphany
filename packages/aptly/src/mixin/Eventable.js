import { Destroyable, Event, applyTo, chain, hasOwn, nop, remove, destroy, panik, derp } from '@appiphany/aptly';

const
    { defineProperty } = Reflect,
    now = () => performance.now(),
    FIRING_SYM = Symbol('firing'),
    SORTED_SYM = Symbol('sorted'),
    defaultHandlerOptions = applyTo(chain(), {
        delay: null,
        once: false,
        priority: 0,
        ttl: null
    }),
    defaultListenOptions = applyTo(chain(defaultHandlerOptions), {
        id: null,
        this: null
    }),
    getOptions = (defaults, on, me) => {
        let options = chain(defaults),
            key;

        if (on) {
            for (key in defaults) {
                if (key in on) {
                    options[key] = on[key];
                }
            }
        }

        if (options.this === 'me') {
            options.this = me;
        }

        return options;
    },
    prioritySort = (a, b) => b.priority - a.priority, // => [..., -1, 0, 1, 2, 3, ...]
    unify = (id, handlers, listener) => () => {
        let hnd = handlers, lst = listener;

        handlers = listener = null;  // nerf future calls

        destroy(hnd);
        lst?.set(id, null);
    };

/**
 *
 */
export const Eventable = Base => class Eventable extends Base {
    static configurable = {
        on: class {
            phase = 'init';

            apply (instance, on) {
                if (Array.isArray(on)) {
                    on.forEach(o => instance.listen(o));
                }
                else {
                    on && instance.listen(on);
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

    #dispatchers = null;

    fire (ev, extra) {
        ev = new Event(this, ev, extra);

        this.#dispatchers?.[ev.type]?.fire(ev);

        ev.finish();

        return ev;
    }

    listen (on) {
        let me = this,
            dispatchers = me.#dispatchers ??= chain(),
            listenOptions = getOptions(defaultListenOptions, on, me),
            listener = Listener.from(listenOptions, me),  // listeners ==> listenOptions.id is set
            dispatcher, handler, handlers, type, un;

        for (type in on) {
            handler = on[type];
            type = Event.canonicalize(type);

            if (!(type in defaultListenOptions)) {
                dispatcher = dispatchers[type] ??= new Dispatcher(me, type);
                (handlers ??= []).push(dispatcher.add(handler, listenOptions));
            }
        }

        if (handlers) {
            un = unify(listenOptions.id, handlers, listener);
            listener?.set(listenOptions.id, un);
        }

        return un || nop;
    }

    findController (that, method) {
        for (let s, nexus = this; (nexus = nexus.inherited?.nexus); ) {
            if (!that || nexus.nexus === that) {
                if (typeof nexus[method] !== 'function') {
                    s = that ? `${that}.${method}` : method;

                    derp(`Controller method not found "${s}" on ${nexus.id}`);
                }

                return nexus;
            }
        }
    }
}

/**
 * This class tracks handlers for a particular event type and dispatches events to them.
 */
class Dispatcher {
    constructor (owner, type) {
        let me = this,
            handlers = [];

        // stash these on the array itself so they are automatically swapped with new
        // values whenever we need to clone the array for mutation during fire().
        handlers[FIRING_SYM] = 0;
        handlers[SORTED_SYM] = true;

        me.handlers = handlers;
        me.owner = owner;
        me.type = type;
    }

    add (handlerOptions, listenOptions) {
        let handlers = this.mutate(),
            fn = handlerOptions,
            t = typeof fn,
            key, handler;

        if (t === 'function' || t === 'string') {
            handlerOptions = null;
        }
        else {
            fn = handlerOptions.fn;
        }

        handlerOptions = getOptions(defaultHandlerOptions, handlerOptions);

        for (key in listenOptions) {
            // if (explicit listen-level option
            //  AND not explicit handler-level
            //  AND it's a handler-level option)
            if (hasOwn(listenOptions, key) && !hasOwn(handlerOptions, key) && key in handlerOptions) {
                handlerOptions[key] = listenOptions[key];
            }
        }

        handler = new Handler(this, fn, handlerOptions, listenOptions);
        handlers.push(handler);

        if (handlers.length > 1 && prioritySort(handlers.at(-2), handlers.at(-1)) > 0) {
            // just added an entry not in sorted order
            handlers[SORTED_SYM] = false;
        }

        return handler;
    }

    fire (ev) {
        let me = this,
            { handlers } = me,
            handler;

        if (handlers.length) {
            if (!handlers[SORTED_SYM]) {
                handlers.sort(prioritySort);
                handlers[SORTED_SYM] = true;
            }

            ++handlers[FIRING_SYM];

            try {
                for (handler of handlers) {
                    handler.fire(ev);

                    if (ev.stopped) {
                        break;
                    }
                }
            }
            finally {
                --handlers[FIRING_SYM];
            }
        }
    }

    mutate () {
        let me = this,
            { handlers } = me,
            was = handlers;

        if (handlers?.[FIRING_SYM]) {
            me.handlers = handlers = handlers.slice();
            handlers[FIRING_SYM] = 0;
            handlers[SORTED_SYM] = was[SORTED_SYM];  // copy current sorted state
        }

        return handlers;
    }

    remove (handler) {
        let handlers = this.mutate();

        remove(handlers, handler);
    }
}

/**
 * This class represents a handler to call when an event is fired/dispatched. It is responsible for
 * invoking the handler function and optionally delaying its invocation.
 */
class Handler {
    constructor (dispatcher, fn, options, listenOptions) {
        let me = this,
            { this: that } = listenOptions,
            fire;

        applyTo(me, options);

        me.dispatcher = dispatcher;

        fire = me.wrap(that, fn);

        if (me.once) {
            fire = me.wrapOnce(fire);
        }

        // TODO delay via Timer

        if (me.ttl) {
            me.expires = now() + me.ttl;
            fire = me.wrapExpiration(fire);
        }

        me.fire = fire;
    }

    destroy () {
        let { dispatcher } = this;

        if (dispatcher) {
            this.dispatcher = null;

            dispatcher.remove(this);
        }
    }

    wrap (that, fn) {
        let fire;

        if (typeof fn === 'function') {
            fire = (...args) => fn.apply(that, args);
        }
        else if (that && typeof that === 'object') {
            if (!that[fn]) {
                panik(`No such method "${fn}" on ${that.constructor.name}`);
            }

            fire = (...args) => !that.destroyed && that[fn](...args);
        }
        else {
            fire = this.wrapDynamic(that, fn);
        }

        return fire;
    }

    wrapDynamic (that, fn) {
        let { owner } = this.dispatcher,
            { inherited } = owner,
            gen, target;

        if (fn.includes('.')) {
            [that, fn] = fn.split('.', 2);
        }

        return (...args) => {
            if (!owner.destroyed) {
                if (target?.destroyed || gen !== inherited?.hierarchyGeneration) {
                    target = owner.findController(that, fn);
                    gen = inherited?.hierarchyGeneration;
                }

                // be tolerant - warnings were handled in findController()
                if (target && !target.destroyed) {
                     target[fn]?.(...args);
                }
            }
        };
    }

    wrapExpiration (fn) {
        return (...args) => {
            if (now() < this.expires) {
                fn(...args);
            }
            else {
                this.destroy();
            }
        };
    }

    wrapOnce (fn) {
        let called;

        return (...args) => {
            if (!called) {
                called = true;  // protect against reentrancy

                fn(...args);

                this.destroy();
            }
        };
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
 *
 *      // since foo (the listener) is !== bar:
 *      // - foo gains an unlisten() method
 *      // - foo gets an expando Listener object
 *      // - foo's listen() activity is tracked using this Listener object
 *      // - the Listener is destroyed when foo is destroyed via foo.cascadeDestroy()
 */
class Listener extends Destroyable {
    static SYM = Symbol('listeners');

    static from (listenOptions, me) {
        let listeners = null;

        // don't create a Listener object when listening to yourself
        if (listenOptions.this !== me) {
            listeners = Listener.get(listenOptions.this);

            if (listeners && !listenOptions.id) {
                listenOptions.id = listeners.nextId();
            }
        }

        return listeners;
    }

    static get (owner) {
        return owner && (owner[Listener.SYM] ??= new Listener(owner));
    }

    constructor (owner) {
        super();

        let me = this;

        me.idSeed = 0;
        me.listeners = chain();

        owner[Listener.SYM] = me;
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
