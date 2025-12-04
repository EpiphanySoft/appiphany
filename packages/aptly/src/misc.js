const
    { defineProperty, freeze, getPrototypeOf } = Object,
    { toString } = Object.prototype,
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
    AsyncFunction = (async() => {}).constructor,
    plainObjectSym = Symbol('plainObject'),
    capsPrefixRe = /^([A-Z]+)([^A-Z])?/,
    camelWordBreakRe = /([a-z])([A-Z])/g,
    collectionWas = Symbol('was'),
    hyphenAlphaRe = /-([a-z])/g,
    hyphenateMatch = (_, m1, m2) => `${m1}-${m2.toLowerCase()}`, // 'xB' => 'x-b'
    intRe = /^\d+$/,
    lowerRe = /^[a-z]+$/,
    falsyRe = /^(no|off|false)$/i,
    truthyRe = /^(yes|true|on)$/i,
    upperMatch = (_, c) => c.toUpperCase(),
    xssMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    },
    xssRe = /[&<>"']/g,
    xssFn = m => xssMap[m];

export const
    EMPTY_ARRAY = freeze([]),
    EMPTY_OBJECT = freeze({}),

    decimalRe = /^-?((?:\d+(?:\.\d*)?)|(?:\.\d+))$/,

    // camelCase-to-hyphenated:
    c2h = name => c2h.cache[name] ??= name.replace(camelWordBreakRe, hyphenateMatch),
    // hyphenated-to-camelCase:
    h2c = name => h2c.cache[name] ??= name.replace(hyphenAlphaRe, upperMatch),

    xss = s => s?.replace(xssRe, xssFn),

    applyDefaults = (makeCopy, target, ...sources) => {
        if (typeof makeCopy !== 'boolean') {
            sources.unshift(target);
            target = makeCopy;
            makeCopy = false;
        }
        else if (makeCopy && !target) {
            target = {};
            makeCopy = false;
        }

        if (target) {
            let key, source;

            for (source of sources) {
                if (source) {
                    for (key in source) {
                        if (!(key in target)) {
                            if (makeCopy) {
                                makeCopy = false;
                                target = clone(target);
                            }

                            target[key] = source[key];
                        }
                    }
                }
            }
        }

        return target;
    },

    applyTo = (target, ...sources) => {
        if (target) {
            let key, source;

            for (source of sources) {
                if (source) {
                    for (key in source) {
                        target[key] = source[key];
                    }
                }
            }
        }

        return target;
    },

    assign = (target, ...sources) => {
        if (target) {
            let source;

            for (source of sources) {
                source && Object.assign(target, source);
            }
        }

        return target;
    },

    capitalize = s => s && (s[0].toUpperCase() + s.slice(1)),

    decapitalize = s => {
        let m = s && capsPrefixRe.exec(s),
            k = m?.[1].length;

        if (!m) {
            return s;
        }

        if (k > 1 && m[2] && lowerRe.test(m[2])) {
            // ABC => abc
            // HTMLEncode => htmlEncode
            // XY2000 => xy2000
            --k;
        }

        return s.slice(0, k).toLowerCase() + s.slice(k);
    },

    chain = object => {
        let ret = Object.create(object || null);

        if (!ret[plainObjectSym]) {
            defineProperty(ret, plainObjectSym, {
                value: true
            });
        }

        return ret;
    },

    className = object => object?.constructor?.name || '',

    clone = object => {
        if (object) {
            let t = typeOf(object),
                k, o;

            if (t === 'array') {
                object = object.map(clone);
            }
            else if (t === 'date') {
                object = new Date(+object);
            }
            else if (t === 'object') {
                o = {};

                for (k in object) {
                    o[k] = clone(object[k]);
                }

                object = o;
            }
        }

        return object;
    },

    defaultify = (target, ...sources) => {
        return applyDefaults(true, target, ...sources);
    },

    deferred = () => {
        let resolve, reject,
            promise = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            });

        return { promise, resolve, reject };
    },

    del = (object, ...keys) => {
        for (let k of keys) {
            delete object[k];
        }

        return object;
    },

    destringify = (value, reviver) => value && JSON.parse(value, reviver),

    destroy = (...stuff) => {
        for (let o of stuff) {
            if (o) {
                if (typeof o?.destroy === 'function') {
                    o.destroy();
                }
                else if (o[Symbol.iterator]) {
                    for (let i of o) {
                        destroy(i);
                    }
                }
            }
        }

        return null;
    },

    distinct = items => Array.from(new Set(items)),

    each = (input, fn, ...a) => {
        let iterable = isIterable(input),
            ret;

        if (isAsync(fn) || iterable === 'async') {
            ret = eachAsync(input, fn, ...a);
        }
        else if (input) {
            let key = 0,
                it;

            if (iterable) {
                for (it of input) {
                    ret = fn(it, key, ...a);

                    if (ret === false) {
                        break;
                    }

                    ++key;
                }
            }
            else {
                for (key in input) {
                    ret = fn(input[key], key, ...a);

                    if (ret === false) {
                        break;
                    }
                }
            }
        }

        return ret;
    },

    eachAsync = async(input, fn, ...a) => {
        if (input) {
            let iterable = isIterable(input),
                key = 0,
                it, ret;

            if (iterable === 'async') {
                for await (it of input) {
                    ret = await fn(it, key, ...a);

                    if (ret === false) {
                        break;
                    }

                    ++key;
                }
            }
            else if (iterable) {
                for (it of input) {
                    ret = await fn(it, key, ...a);

                    if (ret === false) {
                        break;
                    }

                    ++key;
                }
            }
            else {
                for (key in input) {
                    ret = await fn(input[key], key, ...a);

                    if (ret === false) {
                        break;
                    }
                }
            }
        }
    },

    Empty = function(copy) {  // constructor function
        let ret = new.target ? this : Object.create(Empty.prototype);

        copy && applyTo(ret, copy);
        return ret;
    },

    first = (iter, fn) => {
        let iterable = isIterable(iter),
            ret;

        if (isAsync(fn) || iterable === 'async') {
            ret = firstAsync(iter, fn);
        }
        else if (iter) {
            let key = 0,
                it;

            if (iterable) {
                for (it of iter) {
                    if (fn(it, key)) {
                        ret = it;
                        break;
                    }

                    ++key;
                }
            }
            else {
                for (key in iter) {
                    if (fn(it = iter[key], key)) {
                        ret = it;
                        break;
                    }
                }
            }
        }

        return ret;
    },

    firstAsync = async(iter, fn) => {
        if (iter) {
            let iterable = isIterable(iter),
                key = 0,
                it, ret;

            if (iterable === 'async') {
                for await (it of iter) {
                    ret = await fn(it, key);

                    if (ret) {
                        ret = it;
                        break;
                    }

                    ++key;
                }
            }
            else if (iterable) {
                for (it of iter) {
                    ret = await fn(it, key);

                    if (ret) {
                        ret = it;
                        break;
                    }

                    ++key;
                }
            }
            else {
                for (key in iter) {
                    ret = await fn(it = iter[key], key);

                    if (ret) {
                        ret = it;
                        break;
                    }
                }
            }
        }
    },

    generateAll = function(obj) {
        let it = isIterable(obj);

        if (it === 'async') {
            return (async() => {
                for await (let i of obj) {
                    // ignore
                }
            })();
        }
        else if (it) {
            for (let k of obj) {
                // ignore
            }
        }
    },

    getPropertyDescriptor = (obj, name) => {
        for (/* empty */; obj; obj = getPrototypeOf(obj)) {
            let descr = Object.getOwnPropertyDescriptor(obj, name);

            if (descr) {
                return descr;
            }
        }

        return null;
    },

    getPropertyValue = (obj, dotPath) => {
        if (typeof dotPath === 'string') {
            dotPath = dotPath.split('.');
        }

        let key, ret;

        for (key of dotPath) {
            ret = obj?.[key];
        }

        return ret;
    },

    getPropertyValues = (obj, keyPath) => {
        if (typeof keyPath === 'string') {
            keyPath = keyPath.split(',');
        }

        return keyPath.map(dotPath => getPropertyValue(obj, dotPath));
    },

    getType = v => {
        let o = Empty();
        o[typeOf(v)] = true;
        return o;
    },

    groupBy = (items, ...fields) => {
        let ret = [];

        for (let [_, group] of iterateGroups(items, ...fields)) {
            ret.push(Array.from(group()));
        }

        return ret;
    },

    Is = Object.freeze({
        browser: typeof window !== 'undefined' && window?.document != null,
        nodejs: typeof process !== 'undefined' && process.versions?.node != null
    }),

    isA = (o, ...types) => types.some(v => o instanceof v),

    isArray = Array.isArray,
    isAsync = fn => fn instanceof AsyncFunction,
    isClass = fn => typeof fn === 'function' &&
            Object.getOwnPropertyDescriptor(fn, 'prototype')?.writable === false,
    isDate = d => d?.constructor === Date || typeOf(d) === 'date',
    isFunction = v => typeof v === 'function',
    isIterable = it => it?.[Symbol.asyncIterator] ? 'async' : !!it[Symbol.iterator],
    isNumber = v => typeof v === 'number' && !isNaN(v),
    isRegExp = v => typeOf(v) === 'regexp',
    isString = v => typeof v === 'string',

    isEmpty = object => {
        if (isObject(object)) {
            // noinspection LoopStatementThatDoesntLoopJS
            for (let k in object) {
                return false;
            }

            return true;
        }

        return false;
    },

    isEqual = (a, b) => {
        let ret = a === b,
            is, i;

        if (!ret && a && b && (is = isArray(a)) === isArray(b)) {
            if (is) {
                if ((i = a.length) === b.length) {
                    for (ret = true; ret && i-- > 0; ) {
                        ret = isEqual(a[i], b[i]);
                    }
                }
            }
            else if ((is = isDate(a)) === isDate(b)) {
                if (is) {
                    ret = +a === +b;
                }
                else if ((ret = isObject(a) && isObject(b))) {
                    for (i in a) {
                        if (!(ret = i in b) || !(ret = isEqual(a[i], b[i]))) {
                            break;
                        }
                    }

                    if (ret) {
                        for (i in b) {
                            if (!(ret = i in a)) {
                                break;
                            }
                        }
                    }
                }
            }
        }

        return ret;
    },

    isObject = object => {
        if (!object) {
            return false;
        }

        let p;

        return (object.constructor === Object && !isIterable(object)) ||
            object[plainObjectSym] ||
            (p = getPrototypeOf(object)) === null ||   // Object.create(null)
            getPrototypeOf(p) === null;  // getPrototypeOf(Object.prototype) = null
    },

    iterate = function*(obj) {
        if (obj) {
            for (let k in obj) {
                yield [obj[k], k];
            }
        }
    },

    iterateGroups = function*(items, ...fields) {
        let i = 0,
            getKeys = r => fields.map(f => r[f]),
            k, keys, it;

        for (i = 0; i < items.length; ) {
            it = items[i++];

            yield [keys = getKeys(it), function*() {
                yield it;

                while (i < items.length) {
                    if (!isEqual(keys, getKeys(it = items[i]))) {
                        break;
                    }

                    ++i;
                    yield it;
                }
            }];
        }
    },

    jsonify = value => {
        if (value) {
            if (isArray(value)) {
                value = value.map(jsonify);
            }
            else if (isObject(value)) {
                value = map(value, jsonify);
            }
            else if (value.toJSON) {
                value = value.toJSON();
            }
        }

        return value;
    },

    SKIP = Symbol('skipItem'),

    filter = (input, fn) => {
        if (isArray(input)) {
            return input.filter(fn);
        }

        let ret = {},
            k;

        if (isRegExp(fn)) {
            for (k in input) {
                if (fn.exec(k)[0] === k) {
                    ret[k] = input[k];
                }
            }
        }
        else {
            for (k in input) {
                if (fn(input[k], k)) {
                    ret[k] = input[k];
                }
            }
        }

        return ret;
    },

    hasOwn = Object.hasOwn,

    isoNow = () => (new Date()).toISOString(),

    keys = obj => {
        let ret = [],
            k;

        if (obj) {
            for (k in obj) {
                ret.push(k);
            }
        }

        return ret;
    },

    values = obj => {
        let ret = [],
            k;

        if (obj) {
            for (k in obj) {
                ret.push(obj[k]);
            }
        }

        return ret;
    },

    map = (input, fn, as) => {
        if (!input) {
            return input;
        }

        if (typeof fn === 'string') {
            as = fn;
            fn = null;
        }

        let object = isObject(input),  // input type
            array, it, key, m, ret,
            mapIt = (it, k) => {
                if (fn) {
                    m = fn(it, key);

                    if (m === SKIP) {
                        return;
                    }

                    // The fn may not accept 2 args, and if so, it is assumed to only process
                    // values. If the fn takes 2+ args and returns a 2-element array, it is
                    // treated as the [key, value] pair.
                    [k, it] = (isArray(m) && m.length === 2 && (!array || fn.length > 1))
                        ? m : [k, m];
                }

                if (array) {
                    // map(object)->array w/o fn, returns [k,v] pairs akin to Object.entries
                    // but w/o hasOwn check
                    ret.push((object && !fn) ? [k, it] : it);
                }
                else {
                    ret[k] = it;
                }
            };

        if (object) {
            array = as === 'array'; // output type (default is object)
            ret = array ? [] : {};

            for (key in input) {
                mapIt(input[key], key);
            }
        }
        else {
            array = as !== 'object'; // output type (default is array)
            ret = array ? [] : {};
            key = 0;

            for (it of input) {
                mapIt(it, key++);
            }
        }

        return ret;
    },

    mutable = obj => obj ? clone(obj) : {},

    // TODO what was the issue w/sort()?
    naturalSortFn = (a, b) => (a < b) ? -1 : (b < a) ? 1 : 0,

    nop = () => {},
    nopify = (object, method, options) => defineProperty(object, method, {
        ...options,
        value: nop
    }),

    derp = msg => {
        console.warn(msg);
    },

    panik = (msg, opts) => {
        throw new Error(msg, opts);  // ex: opts = { cause: new Error('cause') }
    },

    primitivize = v => {
        if (typeof v === 'string') {
            if (intRe.test(v)) {
                v = +v;
            }
            else if (falsyRe.test(v)) {
                v = false;
            }
            else if (truthyRe.test(v)) {
                v = true;
            }
        }

        return v;
    },

    merge = (target, ...sources) => {
        let k, src, v;

        for (src of sources) {
            if (src == null) {
                continue;
            }

            if (isObject(src)) {
                if (!isObject(target)) {
                    target = {};
                }

                for (k in src) {
                    v = src[k];

                    if (isObject(target[k]) && isObject(v)) {
                        v = merge(target[k], v);
                    }

                    target[k] = v;
                }
            }
            else {
                target = src;
            }
        }

        return target;
    },

    midnight = (d = new Date(), days = 0) => {
        d.setMinutes(0, 0, 0);
        days && d.setDate(d.getDate() + days);
        return d;
    },

    pop = (object, key, defaultValue) => {
        let defArray, ret;

        if (isArray(key)) {
            defArray = isArray(defaultValue);

            ret = key.map(
                (k, i) => pop(object, k, defArray ? defaultValue[i] : defaultValue));
        }
        else {
            ret = object[key];

            if (key in object) {
                delete object[key];
            }
            else {
                ret = defaultValue;
            }
        }

        return ret;
    },

    post = async(url, data, options) => {
        let opts = {
            method: 'POST',
            body: stringify(data),
            // cache: 'no-cache',
            // credentials: 'same-origin',
            // mode: 'cors',
            // redirect: 'follow',
            // referrerPolicy: 'no-referrer',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        opts = merge(opts, isFunction(options) ? options(opts) : options);

        return await fetch(url, opts);
    },

    promote = (v, type, name) => type.includes(typeof v) ? { [name]: v } : v,

    quoteWrap = (s, c = '"') => s ? `${c.slice(0, 1)}${s}${c.slice(-1)}` : '',

    remove = (array, item) => {
        if (isArray(item)) {
            item.forEach(i => remove(array, i));
        }
        else if (array) {
            let i = array.indexOf(item);

            i > -1 && array.splice(i, 1);
        }

        return array;
    },

    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),

    splitObject = (object, ...keySets) => {
        let ret = [],
            allKeys = new Set(),
            k, keys, o;

        for (keys of keySets) {
            ret.push(o = {});

            if (object) {
                for (k of keys) {
                    allKeys.add(k);

                    if (k in object) {
                        o[k] = object[k];
                    }
                }
            }
        }

        ret.push(o = {});

        if (object) {
            for (k in object) {
                if (!allKeys.has(k)) {
                    o[k] = object[k];
                }
            }
        }

        return ret;
    },

    stringify = (value, replacer = null, space = null) => {
        let t = typeof replacer;

        if (t === 'string' || t === 'number') {
            space = replacer;
            replacer = null;
        }

        return JSON.stringify(value, replacer, space);
    },

    thenable = o => typeof o?.then === 'function',

    truthyKeys = obj => map(obj, (v, k) => v ? [k, k] : SKIP, 'array'),

    typeOf = val => {
        let t;

        if (val === null) {
            t = 'null';
        }
        else if (val === undefined) {
            t = 'undefined';
        }
        else if (isArray(val)) {
            t = 'array';
        }
        else if ((t = typeof val) === 'object') {
            t = toString.call(val);
            t = (t in typeOf.cache)
                ? typeOf.cache[t]
                : (typeOf.cache[t] = t.slice(8, -1).toLowerCase());  // '[object '.length = 8

            if (t === 'object') {
                if (!isObject(val)) {
                    t = 'instance';
                }
            }
        }
        else if (t === 'function') {
            if (isClass(val)) {
                t = 'class';
            }
        }

        return t;
    },

    wrapError = (cause, msg, extra) => {
        if (!cause.message.includes(msg)) {
            msg = `${msg}: ${cause}`;
        }

        return applyTo(new Error(msg, { cause }), extra);
    }
;

c2h.cache = chain();
h2c.cache = chain();
typeOf.cache = chain();

export class AutoMap extends Map {
    constructor(iterable, createFn) {
        if (isFunction(iterable)) {
            createFn = iterable;
            iterable = null;
        }

        super(iterable);
        this.createFn = createFn;
    }

    get(key) {
        if (!this.has(key)) {
            this.set(key, this.createFn(key));
        }

        return super.get(key);
    }
}

export class Base64 {
    static decode(b64) {
        return Uint8Array.from(atob(b64), c => c.charCodeAt(null));
    }

    static encode(binary) {
        return btoa(String.fromCharCode.apply(null, binary));
    }
}


export class Clock {
    static get ticks() {
        return performance.now();
    }

    static get today() {
        return this.midnight(new Date());
    }

    static get tomorrow() {
        return this.midnight(new Date(), 1);
    }

    static get yesterday() {
        return this.midnight(new Date(), -1);
    }

    static midnight(date, dayOffset = 0) {
        date.setMinutes(0, 0, 0);
        dayOffset && date.setDate(date.getDate() + dayOffset);
        return date;
    }
}


Object.defineProperties(Empty.prototype = Object.create(null), {
    [plainObjectSym]: {
        value: true
    },
    hasOwnProperty: {
        value: Object.prototype.hasOwnProperty
    }
});


/**
 * A simple extension to Array that can determine if an array has been modified.
 */
export class SmartArray extends Array {
    constructor(...items) {
        super(...items);
        this.dirty = false;
    }

    static get [Symbol.species]() {
        // methods like slice() will return a normal Array, not a SmartArray
        return Array;
    }

    get dirty() {
        let me = this,
            i = me.length,
            was = me[collectionWas],
            dirty;

        for (dirty = !(was && i === was.length); !dirty && i-- > 0; /* empty */) {
            dirty = was[i] !== me[i];
        }

        return dirty;
    }

    set dirty(v) {
        // When a SmartArray is declared !dirty, we shallow copy the array so that we
        // can compare w/this state in the getter. This avoids hooking all mutations to
        // track dirtiness.
        this[collectionWas] = v ? null : [...this];
    }

    clone() {
        return new SmartArray(...this);
    }
}
