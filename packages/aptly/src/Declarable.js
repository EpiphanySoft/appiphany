import { decapitalize, nop, chain, applyTo, panik, quoteWrap, Destroyable, isObject }
    from '@appiphany/aptly';
// import { Logger } from '@/util/Logger';

const
    { freeze, getOwnPropertyDescriptor, hasOwn } = Object,
    { defineProperty } = Reflect,
    EMPTY_ARRAY = freeze([]),
    EMPTY_OBJECT = freeze({}),
    extendersSym = Symbol('extenders'),
    metaSym = Symbol('metaClass'),
    mixinIdSym = Symbol('mixinId'),
    decodeShard = (name, shard) => {
        let t = typeof shard;

        if (t === 'function') {
            shard = {
                reducer: shard
            };
        }
        else if (!(shard && t === 'object')) {
            shard = {};
        }
        // else {
        //     shard = {
        //         reducer: (a, b) => ...,
        //         reverse: false
        //     }
        // }

        shard.name = name;

        return shard;
    };

let nextMixinId = 0;


export class MetaClass {
    constructor (cls) {
        let me = this,
            isRoot = cls === Declarable,
            is, zuper;

        me.abstract = false;
        me.class = cls;
        me.name = cls.name;
        me.superclass = isRoot ? null : Object.getPrototypeOf(cls);

        // This use of superclass.$meta ensures superclass.initClass() gets called. Any
        // use of cls properties prior to this point is likely wrong.
        me.super = zuper = me.superclass?.$meta || null;
        me.contract = chain(zuper?.contract || null);
        me.extenders = zuper?.extenders || EMPTY_ARRAY;

        cls[metaSym] = me;

        defineProperty(cls.prototype, '$meta', {
            value: me
        });

        is = { value: chain(isRoot ? null : cls.is) };
        defineProperty(cls, 'is', is);
        defineProperty(cls.prototype, 'is', is);

        let declarable = zuper?.declarable || EMPTY_OBJECT;

        if (hasOwn(cls, 'declarable')) {
            declarable = {...declarable};

            Object.entries(cls.declarable).forEach(([name, fn]) => {
                const
                    prior = declarable[name]?.fn || nop,
                    declFn = (cls, value) => fn(cls, value, prior);

                // declarables are processed as getters that replace the value and call
                // the associated declarable fn when first accessed. This allows one
                // declarable to use the result of another simply by accessing the class
                // static property and ensure the declarable fn processing is done.
                declarable[name] = target => {
                    let value = target[name];

                    defineProperty(target, name, {
                        configurable: true,

                        get() {
                            delete target[name];  // delete the getter

                            // Put back the original property. Cannot use = since some
                            // declarable properties have only getters (eg, className)
                            defineProperty(target, name, {
                                configurable: true,
                                writable: true,
                                value
                            });

                            declFn(this, value);
                            return target[name];
                        }
                    });
                };

                declarable[name].fn = declFn;
            });

            freeze(declarable);
        }

        me.declarable = declarable;
    }

    getInherited (name, create = true) {
        let me = this,
            ret = me[name];

        if (!ret && create) {
            me[name] = ret = chain(me.super?.getInherited(name) || null);
            ret[metaSym] = me;
        }

        return ret;
    }

    getShards (name) {
        let me = this,
            shards = me.shards?.[name],
            proto;

        if (!shards) {
            proto = me.class.prototype;
            shards = me.super?.getShards(name) || EMPTY_ARRAY;

            if (hasOwn(proto, name)) {
                shards = shards.concat(proto[name]);
            }

            (me.shards ??= chain())[name] = shards;
        }

        return shards;
    }

    onExtend (fn) {
        let me = this,
            { extenders } = me;

        if (extenders[extendersSym] !== me) {
            me.extenders = extenders = extenders.slice();
            extenders[extendersSym] = me;
        }

        extenders.push(fn);
    }
}

//=======================================================================================

export class Declarable extends Destroyable {
    static is = {};  // this gets replaced by MetaClass but helps IDE

    static declarable = {
        abstract (cls, value) {
            if (isObject(value)) {
                let { contract } = cls.$meta,
                    method;

                for (method in value) {
                    contract[method] = [value[method], cls.name];
                }

                value = true;
            }

            cls.$meta.abstract = value;
            delete cls.abstract;
        },

        className (cls, value) {
            cls.$meta.name = value;
            cls.addIs(value);

            if (cls !== Declarable) {
                delete cls.className;
            }
        },

        proto (cls, properties) {
            applyTo(cls.prototype, properties);
        },

        shardable (cls, shardable) {
            let meta = cls.$meta,
                proto = cls.prototype,
                shards = meta.getInherited('shards');

            if (Array.isArray(shardable)) {
                shardable = Object.fromEntries(shardable.map(s => [s, {}]));
            }

            Object.entries(shardable).forEach(([name, shard]) => {
                if (shards[name]) {
                    panik(`Shard already declared in class ${meta.name}: ${name}`);
                }

                shard = decodeShard(name, shard);

                let reducer = shard.reducer,
                    descriptor = {
                        value (...args) {
                            let shards = this.$meta.getInherited('shards')[name],
                                fn, r, ret;

                            for (fn of shards) {
                                r = fn.apply(this, args);
                                ret = (!reducer || fn === shards[0]) ? r : reducer(ret, r);
                            }

                            return ret;
                        }
                    };

                descriptor.value.shard = shard;

                shards[name] = [];

                if (hasOwn(proto, name)) {
                    shards[name].push(proto[name]);
                }

                // Put the shard method on the prototype (replacing the original method)
                defineProperty(proto, name, descriptor);
            });

            // Watch all derived classes for overrides of the shardable methods. If they exist,
            // they need to be gathered in the "shards" object and removed from the prototype to
            // expose the original shard fn from the base class (added above).
            cls.$meta.onExtend(derived => {
                if (derived !== cls) {
                    let shards = derived.$meta.getInherited('shards'),
                        proto = derived.prototype,
                        fn, s;

                    for (s in shardable) {
                        if (hasOwn(proto, s)) {
                            fn = proto[s];    // get the new method
                            delete proto[s];  // expose the shard method

                            shards[s] = shards[s].slice();
                            shards[s][proto[s].shard.reverse ? 'shift' : 'push'](fn);
                        }
                    }
                }
            });
        }
    };

    static proto = {
        // technically this is supposed to mean "running construct() method", but since
        // that is called by constructor() and this pointer is unusable until the super
        // constructor has been called, the only time this isn't as advertised here is
        // the first few lines of Declarable.constructor.
        constructing: true,

        constructed: false
    };

    static stringifyFields = ['id', 'name'];

    static get $meta () {
        return this.initClass()[metaSym];
    }

    static get abstract () {
        return this.$meta.abstract;
    }

    static get className () {
        return this.$meta.name || this.name;
    }

    static addIs (name) {
        this.is[decapitalize(name)] = true;
    }

    static afterClassInit () {
        let cls = this,
            { singleton } = cls,
            inst;

        if (singleton) {
            defineProperty(globalThis, `the${cls.className}`, {
                get: () => inst || (inst = new cls())
            });

            if (singleton !== 'lazy') {
                inst = new cls();
            }
        }
    }

    static classInit (meta) {
        let cls = this,
            { contract, declarable } = meta,
            declarables = [],
            decl, extender, fn, fnI, intfName, method, missing;

        for (decl in declarable) {
            if (hasOwn(cls, decl) && !getOwnPropertyDescriptor(cls, decl).get) {
                declarables.push(decl);
                declarable[decl](cls, cls[decl]);  // lay down getters
            }
        }

        for (decl of declarables) {
            nop(cls[decl]);  // trigger the getters
        }

        for (method in contract) {
            fn = cls.prototype[method];
            [fnI, intfName] = contract[method];

            if (!fn) {
                (missing ??= []).push(`${intfName}.${method}`);
            }
            else if (fn.length !== fnI.length) {
                console.warn(
                    `Class method ${cls.name}.${method} has ${fn.length} arg${fn.length-1 ? 's':''}, ` +
                    `but interface ${intfName}.${method} has ${fnI.length}`);
            }
        }

        if (missing) {
            meta.abstract = `Cannot instantiate class with abstract methods (${missing.join(', ')})`;
        }

        for (extender of meta.extenders) {
            extender(cls);
        }
    }

    static initClass () {
        let cls = this,
            meta;

        if (!hasOwn(cls, metaSym)) {  // once per class
            meta = new MetaClass(cls); // create MetaClass first

            cls.classInit(meta);
            cls.afterClassInit();
        }

        return cls;
    }

    static isA (...names) {
        for (let n of names) {
            if (this.is[n]) {
                return true;
            }
        }

        return false;
    }

    static implements (...interfaces) {
        let cls = class Impl extends this {},
            { contract } = cls.$meta,
            descr, fn, intf, method;

        for (intf of interfaces) {
            descr = Object.getOwnPropertyDescriptors(intf.prototype);

            for (method in descr) {
                fn = descr[method].value;

                if (method !== 'constructor' && typeof fn === 'function') {
                    contract[method] = [fn, intf.name];
                }
            }
        }

        return cls;
    }

    static mixin (...mixins) {
        let cls = this,
            mixin, mixinId;

        for (mixin of mixins.reverse()) {
            if (!(mixinId = mixin[mixinIdSym])) {
                mixin[mixinIdSym] = mixinId = Symbol(`mixin-${mixin.name}-${++nextMixinId}`);
            }

            if (!cls[mixinId]) {
                cls = mixin(cls);
                cls[mixinId] = true;
            }
        }

        return cls;
    }

    constructor (...args) {
        super();

        let me = this,
            C = me.constructor,
            abstract;

        (me.$meta.class !== C) && C.initClass();

        if ((abstract = me.$meta.abstract)) {
            if (abstract === true) {
                abstract = `Cannot create instance of abstract class ${C.className}`;
            }

            panik(abstract);
        }

        me.construct(...args);

        me.constructed = !(me.constructing = false);
    }

    get className () {
        return this.constructor.className;
    }

    // get logger() {
    //     return this._logger || (this._logger = Logger.get(String(this)));
    // }

    construct () {
        // template
    }

    toString () {
        let me = this,
            { className, stringifyFields } = me.constructor,
            suffix = stringifyFields.map(
                f => f === 'id' ? me[f] : quoteWrap(me[f])).filter(p => p).join(', ');

        return `${className}${quoteWrap(suffix, '()')}`;
    }

    isA(...names) {
        return this.constructor.isA(...names);
    }
}

// Cannot use declarables because there are static getters for these:
applyTo(Declarable.$meta, { // this calls Declarable.initClass()
    name: 'Declarable',
    abstract: true
});
