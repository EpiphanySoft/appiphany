
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
