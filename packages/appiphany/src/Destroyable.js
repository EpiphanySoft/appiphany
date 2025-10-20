import { applyTo, isAsync, isFunction, nop, SKIP, thenable } from "@appiphany/appiphany";

const
    cascadeDestroySym = Symbol('cascadeDestroy'),
    { defineProperty } = Object,
    initializer = (me, initialize, ...args) => {
        let async, ret,
            memo = () => ret;

        // Memoize the return value so that we always return the same promise (in case
        // the 2nd caller arrives before the first call has resolved)
        defineProperty(me, 'initialize', { get: () => memo });

        me.initializing = true;

        try {
            ret = initialize.apply(me, args);

            if (!(async = thenable(ret))) {
                me.initialized = true;
                ret = me;
            }
            else {
                // memoize the end of the promise chain (the same as what we return to
                // the first caller)
                ret = ret.then(_ => {
                    me.initialized = true;
                    return me;
                }).finally(_ => {
                    me.initializing = false;
                });
            }
        }
        finally {
            // async will still be falsy if initialize() throws an exception
            if (!async) {
                me.initializing = false;
            }
        }

        return ret;
    };

export class Destroyable {
    constructor() {
        // must come from class proto since we're in super constructor
        let me = this,
            { initialize } = me;

        if (initialize) {
            defineProperty(me, 'initialize', {
                configurable: true,

                value: initializer.bind(me, me, initialize)
            });
        }
    }

    cascadeDestroy(obj) {
        let ref = new WeakRef(obj),
            cascade = (this[cascadeDestroySym] || (this[cascadeDestroySym] = new Set()));

        cascade.add(ref);

        return () => cascade.delete(ref);
    }

    destroy() {
        let me = this,
            cascadeDestroy = me[cascadeDestroySym],
            obj;

        if (!me.destroyed) {
            nop(me, 'destroy');

            me.destroyed = me.destructing = true;
            me.destruct();
            me.destructed = !(me.destructing = false);

            if (cascadeDestroy) {
                for (obj of cascadeDestroy) {
                    obj = obj.deref();

                    obj?.destroy();
                }
            }
        }
    }

    destruct() {
        //
    }

    with(options, fn, otherwise) {
        let me = this,
            entered, ex, ret;

        if (isFunction(options)) {
            otherwise = fn;
            fn = options;
            options = null;
        }

        options = {
            throw: true,
            ...options
        };

        if (isAsync(fn)) {
            return me._withAsync(options, fn, otherwise);
        }

        try {
            if (isAsync(me.withEnter) || isAsync(me.withExit)) {
                throw new Error('Must use async fn (class has async withEnter/Exit)');
            }

            ret = me.withEnter();
            me.withEntered = entered = ret !== SKIP;

            if (entered) {
                try {
                    ret = fn(me);
                }
                catch (e) {
                    me.withError = ex = e;

                    if (options.throw) {
                        throw e;
                    }
                }
            }
        }
        finally {
            if (entered) {
                try {
                    me.withExit(ex || null);
                }
                catch (e) {
                    console.error('Failed in withExit', e);
                }
            }
            else {
                otherwise?.(me);
            }

            me.destroy();
        }

        return ret;
    }

    async _withAsync(options, fn, otherwise) {
        let me = this,
            entered, ex, ret;

        try {
            ret = await me.withEnter();
            me.withEntered = entered = ret !== SKIP;

            if (entered) {
                try {
                    ret = await fn(me);
                }
                catch (e) {
                    me.withError = ex = e;

                    if (options.throw) {
                        throw e;
                    }
                }
            }
        }
        finally {
            if (entered) {
                try {
                    await me.withExit(ex || null);
                }
                catch (e) {
                    console.error('Failed in withExit', e);
                }
            }
            else {
                await otherwise?.(me);
            }

            me.destroy();
        }

        return ret;
    }

    withEnter() {}
    withExit(e) {}
}

applyTo(Destroyable.prototype, {
    destroyed: false,
    destructing: false,
    destructed: false,

    initialized: false,
    initializing: false,

    withEntered: false,
    withError: null
});
