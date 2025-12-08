import {
    clone, chain, isClass, isObject, jsonify, map, merge, panik, SKIP, applyTo, nop,
    Declarable, remove, Signal
}
    from '@appiphany/aptly';


const
    { hasOwn } = Object,
    { defineProperty } = Reflect,
    configDataSym = Symbol('configuring'),
    configWatchersSym = Symbol('configWatchers'),
    storageOwnerSym = Symbol('storageOwner'),
    EXPANDO_ANY = applyTo(chain(), { '*': true }),
    EXPANDO_NONE = chain(),
    makeExpando = (expando, parentExpando) => {
        let ret;

        if (expando === true) {
            ret = chain(EXPANDO_ANY);
        }
        else if (expando === false) {
            ret = chain(EXPANDO_NONE);
        }
        else {
            ret = chain(parentExpando);

            if (expando) {
                if (Array.isArray(expando)) {
                    expando.forEach(k => ret[k] = true);
                }
                else {
                    applyTo(ret, expando);
                }
            }
        }

        return ret;
    };

/**
 * A helper class that defines property accessors for configurable properties. Since these
 * only depend on the property name, they can be cached.
 */
class Accessor {
    static #cache = chain();

    static get (name) {
        return Accessor.#cache[name] ??= new Accessor(name);
    }

    constructor (name) {
        this.name = name;
        this.prop = `_${name}`;
    }

    config () {
        const { name } = this;

        return this._config ??= {
            get() {
                return this.$meta.configs[name].get(this);
            },

            set(v) {
                this.$meta.configs[name].set(this, v);
            }
        };
    }

    initter () {
        const
            config = this,
            { name } = config;

        return config._initter ??= {
            configurable: true,

            get() {
                let me = this,
                    val = me[configDataSym].get(name);

                config.removeInitter(me);

                me[name] = val;

                return me[name];
            },

            set(v) {
                config.removeInitter(this);

                this[name] = v;
            }
        };
    }

    removeInitter (target) {
        let { name } = this,
            configData = target[configDataSym];

        configData?.delete(name);

        if (!configData?.size) {
            target[configDataSym] = null;
        }

        delete target[name];
    }

    signal () {
        const { name, prop } = this;

        return this._signal ??= {
            configurable: true,

            get() {
                let cfg = this[storageOwnerSym].$meta.configs[name],
                    value = Signal.value(cfg.default);

                defineProperty(this, prop, { value });

                return value;
            }
        };
    }

    storage () {
        const { prop } = this;

        return this._storage ??= {
            get() {
                return this[prop].get();
            },

            set(v) {
                this[prop].set(v);
            }
        };
    }

    defineConfig (target) {
        defineProperty(target, this.name, this.config());
    }

    defineInitter (target) {
        defineProperty(target, this.name, this.initter());
    }

    defineStorage (target, value, signalize) {
        let me = this,
            { name, prop } = me;

        if (signalize) {
            defineProperty(target, prop, me.signal());
            defineProperty(target, name, me.storage());
        }
        else {
            target[name] = value;
        }
    }
}

/**
 * The base class for all configurable properties.
 */
export class Config {
    static cache = new Map();

    static create (name) {
        let cfg = new this();  // this likely won't call Config.constructor()

        cfg.accessor = Accessor.get(name);
        cfg.name = name;

        return cfg;
    }

    static get (name) {
        let { cache} = Config,
            config = cache.get(name);

        if (!config) {
            cache.set(name, config = Config.create(name));
        }

        return config;
    }

    static sorter (a, b) {
        let v = a.priority - b.priority;

        if (!v) {
            v = a.name.localeCompare(b.name);
        }

        return v;
    }

    equal (a, b) {
        let ret = a === b,
            i, n;

        if (!ret && a && b && this.array && Array.isArray(a) && Array.isArray(b)) {
            ret = (n = a.length) === b.length;

            if (ret) {
                for (i = 0; i < n && (ret = a[i] === b[i]); ++i) {
                    // just loop
                }
            }
            // else fall below and return false
        }

        return ret;
    }

    extend (cls, val) {
        // template
    }

    get (instance) {
        return instance.$config[this.name];
    }

    apply (instance, v) { return v; }  // in case of super.apply()
    update () {}

    set (instance, v) {
        let me = this,
            { $config: storage } = instance,
            { name } = me,
            was = storage[name],
            handled, applied;

        if (!me.apply.$nop) {
            applied = me.apply(instance, v, was);

            if (!(handled = (applied === undefined))) {
                v = applied;
                was = storage[name];  // in case value was changed by apply()
            }
        }

        if (!handled && !me.equal(v, was)) {
            storage[name] = v;

            !me.update.$nop && me.update(instance, v, was);
            handled = true;
        }

        if (handled && !instance.configuring?.firstTime) {
            instance.onConfigChange(name, v, was);
        }
    }

    merge (oldValue, newValue) {
        if (oldValue && newValue && isObject(newValue)) {
            if (isObject(oldValue)) {
                newValue = merge(clone(oldValue), newValue);
            }
        }

        return newValue;
    }
}

(proto => {
    applyTo(proto, {
        array: false,
        default: null,
        nullable: true,
        nullify: false,
        phase: 'ctor',  // in {'ctor', 'get', 'init'}
        priority: 0,
        signalize: null
    });

    proto.apply.$nop = true;
    proto.update.$nop = true;

})(Config.prototype);


class Bool extends Config {
    value = null;
    default = false;

    apply (instance, v) {
        return !!v;
    }
}

class Flags extends Config {
    static wordRe = /,|\s+/;

    delimiter = null;

    apply (instance, v, was) {
        if (typeof v === 'string') {
            v = v.split(this.delimiter || Flags.wordRe).filter(s => s);
        }

        if (Array.isArray(v)) {
            v = Object.fromEntries(v.map(s => s.startsWith('-') ? [s.slice(1), false] : [s, true]));
        }

        if (v && was) {
            let same = true,
                k;

            for (k in v) {
                same = v[k] === was[k];

                if (!same) {
                    break;
                }
            }

            if (same) {
                for (k in was) {
                    same = v[k] === was[k];

                    if (!same) {
                        break;
                    }
                }
            }

            if (same) {
                v = was;
            }
        }

        return v;
    }
}

Config.Bool = Bool;
Config.Flags = Flags;

//=======================================================================================

export class Configurable extends Declarable {
    static abstract = true;
    static className = 'Configurable';

    /**
     * Set to true on a class to allow instanceConfig to add properties that are not
     * declared as configurable.
     * @type {Object}
     */
    static expando = EXPANDO_NONE;

    static signalize = false;

    static proto = {
        configuring: null,
        initialConfig: null,  // config object passed to constructor
        instanceConfig: null  // fully populated config object
    };

    static declarable = {
        configurable (cls, configs) {
            let meta = cls.$meta,
                classConfigs = meta.configs,
                configValues = meta.configValues,
                base, config, name, proto, val;

            for (name in configs) {
                val = configs[name];

                if (val && isClass(val)) {
                    if (!(val.prototype instanceof Config)) {
                        base = classConfigs[name]?.constructor || Config.get(name).constructor;

                        Object.setPrototypeOf(val, base);
                        Object.setPrototypeOf(val.prototype, base.prototype);
                    }

                    // Due to above prototype changes, this won't call the Config constructor:
                    //  config = new val(name);
                    classConfigs[name] = config = val.create(name);
                    proto = val.prototype;

                    if (hasOwn(config, 'value')) {
                        // value = 'herp' on class def
                        val = config.value;
                        delete config.value;
                    }
                    else {
                        val = null;
                    }

                    if (hasOwn(config, 'nullify')) {
                        meta.nullify[name] = config.nullify;
                    }

                    applyTo(proto, config);
                }
                else if (!(config = classConfigs[name])) {
                    classConfigs[name] = config = Config.get(name);
                }
                else {
                    config.extend(cls, val);
                }

                if (name in configValues) {
                    val = config.merge(configValues[name], val);
                }
                else {
                    config.accessor.defineConfig(cls.prototype);
                }

                configValues[name] = val;
            }
        }
    };

    static classInit (meta) {
        let cls = this,
            zuper = meta.super;

        meta.configs = chain(zuper?.configs || null);
        meta.configValues = chain(zuper?.configValues || null);
        meta.expando = makeExpando(hasOwn(cls, 'expando') ? cls.expando : EXPANDO_NONE, zuper?.expando);
        meta.nullify = chain(zuper?.nullify || null);

        super.classInit(meta);  // run declarables (like "configurable")

        meta.requiredConfigs = map(meta.configs, v => v.nullable ? SKIP : v.name, 'array');
    }

    static mergeConfigs (target, ...configs) {
        let meta = this.$meta,
            cfgs = meta.configs,
            { expando } = meta,
            mergeCfg = Config.prototype.merge,
            config, k, v;

        target = target || {};
        expando = expando || EXPANDO_NONE;

        for (config of configs) {
            if (config) {
                for (k in config) {
                    v = config[k];

                    if (cfgs[k]) {
                        target[k] = cfgs[k].merge(target[k], v);
                    }
                    else if (expando[k] || expando['*']) {
                        target[k] = (v && target[k]) ? mergeCfg(target[k], v) : v;
                    }
                    else {
                        panik(`No such property "${k}" in class ${meta.name}`);
                    }
                }
            }
        }

        return target;
    }

    static squashConfigs (...configs) {
        let config;

        while (configs.length) {
            config = configs.shift();

            if (config) {
                return this.mergeConfigs(clone(config), ...configs);
            }
        }

        return {};
    }

    // helps IDE signature inference
    constructor(instanceConfig = null, ...extra) {
        super(instanceConfig, ...extra);
    }

    get $config () {
        let { $meta: meta } = this,
            configStorage = meta.configStorage,
            cfg, classConfigs, ret;

        if (!configStorage) {
            // Once per class, create a "class" that defines storage for all configs
            meta.configStorage = configStorage = Object.create(null);
            classConfigs = meta.configs;

            for (cfg in classConfigs) {
                cfg = classConfigs[cfg];
                cfg.accessor.defineStorage(configStorage, cfg.default, cfg.signalize ?? meta.class.signalize);
            }
        }

        // Once per instance, create the object to hold the config values
        ret = Object.create(configStorage);
        ret[storageOwnerSym] = this;

        // hide this getter from the prototype by defining it on the instance (only get here
        // once per instance)
        defineProperty(this, '$config', { value: ret });

        return ret;
    }

    construct (instanceConfig) {
        let me = this,
            meta = me.$meta,
            config = meta.configValues,
            missing;

        instanceConfig = (instanceConfig === true) ? {} : instanceConfig;

        if (instanceConfig) {
            config = meta.class.mergeConfigs(chain(config), instanceConfig);
            me.initialConfig = instanceConfig;
        }

        me.configure(config);

        missing = meta.requiredConfigs.filter(c => me[c] == null);

        if (missing.length) {
            panik(`Missing required configs for ${me}: ${missing.join(', ')}`);
        }
    }

    configure (config) {
        let me = this,
            meta = me.$meta,
            classConfigs = meta.configs,
            configData = me[configDataSym] ??= new Map(),
            { configuring } = me,
            firstTime = !me.instanceConfig,
            ignoreNull = firstTime,
            active, cfg, modified, name, phase, val;

        if (firstTime) {
            me.instanceConfig = config;
        }

        try {
            if (!configuring) {
                me.configuring = configuring = {
                    firstTime,
                    data: configData,
                    depth: 0,
                    modified: null
                };
            }

            ++configuring.depth;

            main: for (;;) {
                for (name in config) {
                    if (!(ignoreNull && config[name] === null)) {
                        configData.set(name, config[name]);

                        cfg = classConfigs[name] || Config.get(name);
                        cfg.accessor.defineInitter(me);

                        (active ??= []).push(cfg);
                    }
                }

                if (active) {
                    active.sort(Config.sorter);

                    for (cfg of active) {
                        name = cfg.name;

                        if (configData.has(name)) {
                            // firstTime: skip over 'get' and 'init' phase configs
                            // otherwise: process all configs
                            phase = firstTime && cfg.phase;

                            if (!(phase === 'get' || phase === 'init')) {
                                val = configData.get(name);
                                configData.delete(name);

                                me[name] = val;

                                modified = configuring.modified;

                                if (modified) {
                                    configuring.modified = null;
                                    config = modified;
                                    ignoreNull = false;

                                    // stop activating configs and inject the changes into the
                                    // configuration process
                                    continue main;
                                }
                            }
                        }
                    }
                }

                break;
            }

            if (!configData.size) {
                me[configDataSym] = null;
            }
        }
        finally {
            if (! --configuring.depth) {
                me.configuring = null;
            }
        }
    }

    destruct () {
        let me = this,
            { nullify } = me.$meta,
            configData = me[configDataSym],
            name;

        for (name in nullify) {
            if (nullify[name] && !configData?.has(name)) {
                me[name] = null;
            }
        }
    }

    initialize () {
        let me = this,
            configData = me[configDataSym],  // left over from configure()
            configs, classConfigs, name;

        if (configData) {
            classConfigs = me.$meta.configs;

            for (name of configData.keys()) {
                if (classConfigs[name]?.phase === 'init') {
                    (configs ??= []).push(name);
                }
            }

            if (configs) {
                for (name of configs) {
                    me.getConfig(name);
                }
            }
        }
    }

    getConfig (name) {
        return this[name];
    }

    onConfigChange (name, value, was) {
        let watchers = this[configWatchersSym]?.[name],
            fn;

        if (watchers) {
            for (fn of watchers) {
                fn(name, value, was);
            }
        }
    }

    peekConfig (name) {
        let data = this.configuring?.data;

        return data?.has(name) ? data.get(name) : this.$config[name];
    }

    toJSON () {
        return map(this.$meta.configs, (v, k) => {
            v = this[k];

            return (v == null || typeof v === 'function') ? SKIP : [k, jsonify(v)];
        });
    }

    /**
     * Returns a function that can be called to watch for changes to the given configs.
     * THe `configs` can be passed in this call or to the returned function at any time.
     * Calling the returned function adds or removes configs from the watch list.
     * @param {Function} fn The function to call when a watched config changes
     * @param {Object} [configs] The configs to watch for changes. The keys of the object
     * with truthy values are the names of the configs to watch.
     * @returns {Function}
     */
    watchConfigs (fn, configs) {
        let watching,
            watcher = configs => {
                let was = watching,
                    configName;

                watching = configs;

                if (watching) {
                    // let w = Object.keys(watching).filter(k => !was?.[k]);
                    // w.length && console.log(`${this.id} watching configs: ${w.join(',')}`)

                    for (configName in watching) {
                        if (!was?.[configName]) {
                            ((this[configWatchersSym] ??= chain())[configName] ??= []).push(fn);
                        }
                    }
                }

                if (was) {
                    // let u = Object.keys(was).filter(k => !watching?.[k]);
                    // u.length && console.log(`${this.id} unwatching configs: ${u.join(',')}`);

                    for (configName in was) {
                        if (!watching?.[configName]) {
                            remove(this[configWatchersSym][configName], fn);
                        }
                    }
                }
            };

        configs && watcher(configs);

        return watcher;
    }
}

Configurable.initClass();
