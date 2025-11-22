import { SchedulerTimer, Timer } from '@appiphany/aptly';

const { defineProperty: defineProp } = Object;

const decorate = (cls, prototype, name, options) => {
    let methodFn = prototype[name];

    defineProp(prototype, name, {
        get () {
            let invokeFn = (...args) => methodFn.apply(this, args), // _onTick needs return value
                wrapFn = (...args) => wrapFn.timer.start(...args),
                scheduler = (cls === SchedulerTimer) && this.scheduler;

            wrapFn.timer = new cls(invokeFn, options);

            if (scheduler) {
                wrapFn.timer.scheduler = scheduler;
            }

            defineProp(wrapFn, 'now', {
                value (...args) {
                    wrapFn(...args);

                    return wrapFn.timer.flush();
                }
            });

            // On first access of the delayable method, this getter is called. It
            // shadows the getter on the prototype with the wrapFn that is bound
            // this the instance. This means each instance will gets its own timer.
            defineProp(this, name, { value: wrapFn });

            // This is the only time this getter is called on this instance (due
            // to the above), but we still need to return the wrapFn for this call.
            return wrapFn;
        }
    });
}

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

                decorate(Timer.types[options.type || 'timeout'], cls.prototype, name, options);
            }
        }
    };
}
