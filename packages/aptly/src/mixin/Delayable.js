import { Timer } from '@appiphany/aptly';


export const Delayable = Base => class Delayable extends Base {
    static declarable = {
        delayable (cls, config) {
            let name, options, type;

            for (name in config) {
                options = config[name];

                if (options === true) {
                    options = {
                        type: 'asap'
                    };
                }
                else if ((type = typeof options) === 'number') {
                    options = {
                        delay: options
                    };
                }
                else if (type === 'string') {
                    options = {
                        type: options
                    };
                }

                type = Timer.types[options.type || 'timeout'];
                type.decorate(cls.prototype, name, options);
            }
        }
    };
}
