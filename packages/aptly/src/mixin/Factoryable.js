import { Configurable, applyTo, isClass, isObject, panik } from "@appiphany/aptly";

const
    { defineProperty } = Reflect;

export class Factory extends Configurable {
    static configurable = {
        caseless: true,

        defaultType: null,

        owner: null,

        typeKey: 'type'
    };

    registry = new Map();

    create(config, options = null) {
        return this.reconfigure(null, config, options);
    }

    lookup(type, required = true) {
        let me = this,
            { registry } = me,
            ret;

        if (!type || isClass(type)) {
            return type;
        }

        ret = registry.get(type) || (me.caseless && registry.get(type.toLowerCase()));

        if (!ret && required) {
            panik(`No such type "${type}" registered in ${me.owner.className} factory`);
        }

        return ret;
    }

    reconfigure(instance, config, options = null) {
        let me = this,
            { typeKey } = me,
            defaults = options?.defaults,
            ret, type;

        if (typeof config === 'string') {
            type = config;
            config = {};
        }
        else if (config) {
            if (config === true) {
                config = {};
            }
            else if (!isObject(config)) {
                if (instance && instance !== config) {
                    instance.destroy();
                }

                return config;
            }
            else if (typeKey in config) {
                config = applyTo({}, config);
                type = config[typeKey];
                delete config[typeKey];
            }
        }

        type = type && me.lookup(type);

        if (instance) {
            if (config) {
                // If we have no explicit type or we do and it is the same type as the
                // current instance, just re-configure it. Otherwise, we must destroy
                // it and create a new instance of the correct type.
                if (!type || type === instance.constructor) {
                    instance.configure(config);
                    return instance;
                }
            }

            instance.destroy();
        }

        if (!config) {
            ret = null;
        }
        else {
            if (!type) {
                if (!(type = me.lookup(options?.type || defaults?.type || me.defaultType))) {
                    panik(`No default type for ${me.owner.className} factory`);
                }
            }

            if (defaults) {
                config = type.squashConfigs(defaults, config);
            }

            ret = new type(config);
            ret.initialize?.();
        }

        return ret;
    }

    register(cls, ...keys) {
        let { caseless, registry } = this,
            add = new Set(),
            key;

        if (!keys.length) {
            let { aliases, type } = cls;

            if (!type) {
                panik(`Must specify type class property`);
            }

            keys.push(type);

            if (typeof aliases === 'string') {
                keys.push(aliases);
            }
            else if (aliases) {
                keys.push(...aliases);
            }
        }

        for (key of keys) {
            add.add(key);
            caseless && add.add(key.toLowerCase());
        }

        for (key of add) {
            if (registry.has(key)) {
                panik(`Factory cannot have duplicate key: "${key}"`);
            }

            registry.set(key, cls);
        }
    }
}


export const Factoryable = Base => class Factoryable extends Base {
    static declarable = {
        factory(cls, value) {
            cls.factory = new Factory({
                owner: cls,
                ...value
            });
        },

        type(cls, value) {
            let { aliases, $meta } = cls;

            ($meta.types ??= $meta.super?.types?.slice() || []).push(value);

            cls.factory.register(cls);

            defineProperty(cls.prototype, 'type', { value });

            cls.addIs(value);

            if (typeof aliases === 'string') {
                cls.addIs(aliases);
            }
            else if (aliases) {
                aliases.forEach(alias => cls.addIs(alias));
            }
        }
    };

    static create(config, options = null) {
        return this.factory.create(config, options);
    }

    static reconfigure(instance, config, options = null) {
        return this.factory.reconfigure(instance, config, options);
    }
}
