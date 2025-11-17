import { clone, chain, isClass, isObject, jsonify, map, merge, panik, SKIP, applyTo,
         Declarable }
    from '@appiphany/aptly';


const
    { hasOwn } = Object,
    { defineProperty } = Reflect,
    configDataSym = Symbol('configuring'),
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


export class Config {
    static cache = new Map();

    static create(name) {
        let cfg = new this();

        defineProperty(cfg, 'name', { value: name });
        defineProperty(cfg, 'prop', { value: '_' + name });

        return cfg;
    }

    static get(name) {
        let config = this.cache.get(name);

        if (!config) {
            this.cache.set(name, config = Config.create(name));
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

    equal(a, b) {
        return a === b;
    }

    extend(cls, val) {
        // template
    }

    get(instance) {
        return instance[this.prop];
    }

    set(instance, v) {
        let me = this,
            { prop } = me,
            was = instance[prop],
            firstTime = !hasOwn(instance, prop),
            handled, applied;

        if (me.apply) {
            applied = me.apply(instance, v, was, firstTime);

            if (!(handled = (applied === undefined))) {
                v = applied;
                was = instance[prop];  // in case _foo was changed by apply()
            }
        }

        if (!handled && !me.equal(v, was)) {
            instance[prop] = v;

            me.update?.(instance, v, was, firstTime);
        }
    }

    merge(oldValue, newValue) {
        if (oldValue && newValue && isObject(newValue)) {
            if (isObject(oldValue)) {
                newValue = merge(clone(oldValue), newValue);
            }
        }

        return newValue;
    }

    //-----------------------------------------------------------------------------------
    // Internals

    defineAccessor(target) {
        let me = this;

        if (me.default !== undefined) {
            defineProperty(target, me.prop, { value: me.default, writable: true });
        }

        defineProperty(target, me.name, me.getAccessor());
    }

    defineInitter(target) {
        defineProperty(target, this.name, this.getInitter());
    }

    getAccessor() {
        const config = this;

        return config._accessor || (config._accessor = {
            get() {
                return this.$meta.configs[config.name].get(this);
            },

            set(v) {
                this.$meta.configs[config.name].set(this, v);
            }
        });
    }

    getInitter() {
        const
            config = this,
            { name } = config;

        return config._initter || (config._initter = {
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
        });
    }

    removeInitter(target) {
        let { name } = this,
            configData = target[configDataSym];

        configData?.delete(name);

        if (!configData?.size) {
            target[configDataSym] = null;
        }

        delete target[name];
    }
}

applyTo(Config.prototype, {
    name: null,
    prop: null,

    default: null,
    nullable: true,
    nullify: false,
    phase: 'ctor',  // in {'ctor', 'get', 'init'}
    priority: 0,

    apply: null,
    update: null
});

//=======================================================================================

export class Configurable extends Declarable {
    static declarable = {
        configurable(cls, configs) {
            let meta = cls.$meta,
                classConfigs = meta.configs,
                configValues = meta.configValues,
                base, config, name, proto, val;

            for (name in configs) {
                val = configs[name];

                if (val && isClass(val)) {
                    base = classConfigs[name]?.constructor || Config.get(name).constructor;

                    Object.setPrototypeOf(val, base);
                    Object.setPrototypeOf(val.prototype, base.prototype);

                    classConfigs[name] = config = val.create(name);
                    proto = val.prototype;

                    if (hasOwn(config, 'value')) {
                        // value = 'derp' on class def
                        val = config.value;
                        delete config.value;
                    }
                    else {
                        val = null;
                    }

                    if (hasOwn(config, 'nullify')) {
                        meta.nullify[name] = config.nullify;
                        delete config.nullify;
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
                    config.defineAccessor(cls.prototype);
                }

                configValues[name] = val;
            }
        }
    };

    /**
     * Set to true on a class to allow instanceConfig to add properties that are not
     * declared as configurable.
     * @type {Object}
     */
    static expando = EXPANDO_NONE;

    static proto = {
        configuring: false,

        initialConfig: null,  // config object passed to constructor
        instanceConfig: null  // fully populated config object
    };

    static classInit(meta) {
        let cls = this,
            zuper = meta.super;

        meta.configs = chain(zuper?.configs || null);
        meta.configValues = chain(zuper?.configValues || null);
        meta.expando = makeExpando(hasOwn(cls, 'expando') ? cls.expando : EXPANDO_NONE, zuper?.expando);
        meta.nullify = chain(zuper?.nullify || null);

        super.classInit(meta);  // run declarables (like "configurable")

        meta.requiredConfigs = map(meta.configs, v => v.nullable ? SKIP : v.name, 'array');
    }

    static mergeConfigs(target, ...configs) {
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

    static squashConfigs(...configs) {
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

    construct(instanceConfig) {
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

    configure(config) {
        let me = this,
            meta = me.$meta,
            classConfigs = meta.configs,
            configData = me[configDataSym] ??= new Map(),
            { configuring } = me,
            firstTime = !me.instanceConfig,
            active, cfg, name, phase, val;

        if (firstTime) {
            me.instanceConfig = config;
        }

        try {
            if (!configuring) {
                me.configuring = configuring = {
                    depth: 0,
                    stack: []
                };
            }

            ++configuring.depth;

            for (name in config) {
                if (!firstTime || config[name] !== null) {
                    configData.set(name, config[name]);

                    cfg = classConfigs[name] || Config.get(name);
                    cfg.defineInitter(me);

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

                            configuring.stack.push(name);
                            me[name] = val;
                            configuring.stack.pop();
                        }
                    }
                }
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

    destruct() {
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

    toJSON() {
        return map(this.$meta.configs, (v, k) => {
            v = this[k];

            return (v == null || typeof v === 'function') ? SKIP : [k, jsonify(v)];
        });
    }
}

// Cannot use declarables because there are static getters for these:
applyTo(Configurable.$meta, { // this calls Configurable.initClass()
    name: 'Configurable',
    abstract: true
});
