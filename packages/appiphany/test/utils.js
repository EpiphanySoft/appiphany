
export const
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
