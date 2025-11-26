import { clone } from '@appiphany/aptly';

export const
    logger = () => {
        let log = [];

        return {
            get length () {
                return log.length;
            },
            get () {
                let ret = log;
                log = [];
                return ret;
            },
            out (s) {
                log.push(s);
            }
        };
    },
    mockery = (obj, fn) => {
        let callThru,
            returns = [],
            mocker = (...args) => {
                mocker.calls?.push(clone(args));

                let r = callThru?.(...args);

                return returns.length ? returns.pop() : r;
            };

        mocker.callThru = (on = true) => {
            callThru = !on ? null :
                (...args) => {
                    let r = fn(...args);

                    mocker.results?.push(r);

                    return r;
                };

            return mocker;
        };

        mocker.clear = () => {
            mocker.calls = [];
            mocker.results = [];

            return mocker;
        };

        mocker.returns = (...args) => {
            while (args.length) {
                returns.push(args.pop());
            }

            return mocker;
        };

        if (typeof obj === 'function') {
            fn = obj;
        }
        else if (typeof fn === 'string') {
            let name = fn,
                own = Object.hasOwn(obj, name),
                originalFn = obj[name];

            fn = (...a) => originalFn.apply(obj, a);

            mocker.attach = () => {
                obj[name] = mocker;
                return mocker;
            };

            mocker.detach = () => {
               if (own) {
                   obj[name] = originalFn;
               }
               else {
                   delete obj[name];
               }

               return mocker;
            };

            mocker.attach();
        }

        return mocker.clear();
    },
    createStorage = (data = {}) => ({
        data,

        get length () { return Object.keys(this.data).length; },
        key (i) { return Object.keys(this.data)[i]; },
        getItem (key) { return this.data[key]; },
        setItem (key, value) { this.data[key] = value; },
        removeItem (key) { delete this.data[key]; }
    }),
    sleep = ms => new Promise(resolve => setTimeout(() => resolve(), ms)),
    stall = () => Promise.resolve(),
    until = async fn => {
        let limit = 100;
        let i = 0;

        while (!fn()) {
            ++i;

            if (i < limit) {
                await stall();
            }
            else {
                await sleep(0);
                i = 0;
            }
        }
    }
