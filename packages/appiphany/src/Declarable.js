import { decapitalize, ignore, chain, applyTo, quoteWrap } from '@appiphany/appiphany';
// import { Logger } from '@/util/Logger';
import { Destroyable } from '@appiphany/appiphany';

const
    { freeze, getOwnPropertyDescriptor, hasOwn } = Object,
    { defineProperty } = Reflect,
    EMPTY_OBJECT = freeze({}),
    metaSym = Symbol('metaClass'),
    mixinIdSym = Symbol('mixinId');

let nextMixinId = 0;


export class MetaClass {
    constructor(cls) {
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
                    prior = declarable[name]?.fn || ignore,
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

    getInherited(name, create = true) {
        let me = this,
            ret = me[name];

        if (!ret && create) {
            me[name] = ret = chain(me.super?.getInherited(name) || null);
        }

        return ret;
    }
}

//=======================================================================================

export class Declarable extends Destroyable {
    static is = {};  // this gets replaced by MetaClass but helps IDE

    static declarable = {
        abstract(cls, value) {
            cls.$meta.abstract = value;
            delete cls.abstract;
        },

        className(cls, value) {
            cls.$meta.name = value;
            cls.addIs(value);

            if (cls !== Declarable) {
                delete cls.className;
            }
        },

        proto(cls, properties) {
            applyTo(cls.prototype, properties);
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

    static get $meta() {
        return this.initClass()[metaSym];
    }

    static get abstract() {
        return this.$meta.abstract;
    }

    static get className() {
        return this.$meta.name || this.name;
    }

    static addIs(name) {
        this.is[decapitalize(name)] = true;
    }

    static afterClassInit() {
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

    static classInit(meta) {
        let cls = this,
            { declarable } = meta,
            declarables = [],
            decl;

        for (decl in declarable) {
            if (hasOwn(cls, decl) && !getOwnPropertyDescriptor(cls, decl).get) {
                declarables.push(decl);
                declarable[decl](cls, cls[decl]);  // lay down getters
            }
        }

        for (decl of declarables) {
            ignore(cls[decl]);  // trigger the getters
        }
    }

    static initClass() {
        let cls = this,
            meta;

        if (!hasOwn(cls, metaSym)) {  // once per class
            meta = new MetaClass(cls); // create MetaClass first

            cls.classInit(meta);
            cls.afterClassInit();
        }

        return cls;
    }

    static isA(...names) {
        for (let n of names) {
            if (this.is[n]) {
                return true;
            }
        }

        return false;
    }

    static mixin(...mixins) {
        let cls = this,
            mixin, mixinId;

        for (mixin of mixins.reverse()) {
            if (!(mixinId = mixin[mixinIdSym])) {
                mixin[mixinIdSym] = mixinId = Symbol(`mix-${mixin.name}-${++nextMixinId}`);
            }

            if (!cls[mixinId]) {
                cls = mixin(cls);
                cls[mixinId] = true;
            }
        }

        return cls;
    }

    constructor(...args) {
        super();

        let me = this,
            C = me.constructor;

        (me.$meta.class !== C) && C.initClass();

        if (me.$meta.abstract) {
            throw new Error(`Cannot create instance of abstract class ${C.className}`);
        }

        me.construct(...args);

        me.constructed = !(me.constructing = false);
    }

    get className() {
        return this.constructor.className;
    }

    // get logger() {
    //     return this._logger || (this._logger = Logger.get(String(this)));
    // }

    construct() {
        // template
    }

    toString() {
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
