import fs from 'node:fs';
import path from 'node:path';

const HANDLER_FILE = 'handlers.js';

export const isDir = f => fs.existsSync(f) && fs.lstatSync(f).isDirectory();
export const isFile = f => fs.existsSync(f) && fs.lstatSync(f).isFile();

export const Apis = {
    fastify: null,

    get (dir, sub) {
        const base = sub ? path.join(dir, sub) : dir;
        const mod = path.join(base, HANDLER_FILE);
        const ret = [];

        if (isFile(mod)) {
            ret.push(sub);
        }

        let subs = fs.readdirSync(base).filter(f => isDir(path.join(base, f)));

        subs = subs.map(s => Apis.get(dir, sub ? path.join(sub, s) : s));
        subs = subs.flat(9e9);
        subs = subs.filter(v => v);

        return [...ret, ...subs];
    },

    async load (dir, f) {
        const mod = path.join(dir, f, HANDLER_FILE);

        Apis.fastify.log.info(`API found: ${mod}`);

        return [f, await import(mod)];
    },

    async mount (route, dir) {
        const apis = Apis.get(dir, '').sort();
        const mods = await Promise.all(apis.map(m => Apis.load(dir, m)));
        const handlers = mods.map(ent => [ent[0], ent[1].handlers]);

        for (const [prefix, handler] of handlers) {
            const rt = path.join(route, prefix);

            for (const method in handler) {
                Apis.fastify.log.info(`Mounting API: ${method} ${rt}`);
                Apis.fastify[method](rt, handler[method]);
            }
        }
    }
};
