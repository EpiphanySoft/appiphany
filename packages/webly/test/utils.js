
export const
    logger = () => {
        const log = s => {
            log.items.push(s);
        };

        log.items = [];

        Reflect.defineProperty(log, 'size', { get: () => log.items.length });

        log.get = () => {
            let ret = log.items;
            log.items = [];
            return ret;
        };

        return log;
    },
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
