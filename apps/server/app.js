import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';


const fastify = Fastify({
    logger: true
});

const isDir = f => fs.existsSync(f) && fs.lstatSync(f).isDirectory();
const isFile = f => fs.existsSync(f) && fs.lstatSync(f).isFile();

const Apis = {
    get (dir, sub) {
        const base = sub ? path.join(dir, sub) : dir;
        const mod = path.join(base, '$.js');
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
        const mod = path.join(dir, f, '$.js');

        fastify.log.info(`API found: ${mod}`);

        return [f, await import(mod)];
    },

    async loadAll (route, dir) {
        const apis = Apis.get(dir, '').sort();
        const mods = await Promise.all(apis.map(m => Apis.load(dir, m)));
        const handlers = mods.map(ent => [ent[0], ent[1].handlers]);

        for (const [prefix, handler] of handlers) {
            const rt = path.join(route, prefix);

            fastify.log.info(`Mounting API: ${rt}`);

            debugger;
            for (const method in handler) {
                fastify[method](rt, handler[method]);
            }
        }
    }
}

const www = path.join(import.meta.dirname, '../web/www');

fastify.log.info(`Web package: ${www}`);

fastify.register(FastifyStatic, {
    root: www
});

await Apis.loadAll('/~api', path.join(import.meta.dirname, 'api'));

fastify
    // .get('/~api', () => {
    //     return { woot: 'world!' };
    // })
    .listen({ port: 3000 }, (err, address) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }

        fastify.log.info(`server start [${address}]`);
    })
;
