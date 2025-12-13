import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import path from 'node:path';
import { Apis, isDir } from './Apis.js';

const fastify = Apis.fastify = Fastify({
    logger: true
});

const mount = paths => {
    let decorateReply = false;

    for (const [prefix, relPath] of Object.entries(paths)) {
        const fp = path.join(import.meta.dirname, relPath);

        if (!isDir(fp)) {
            throw new Error(`Invalid resource dir: ${fp}`);
        }

        fastify.log.info(`Mount resource dir: ${fp}`);

        const config = {
            decorateReply,
            root: fp
        };

        if (prefix) {
            config.prefix = prefix;
        }

        fastify.register(FastifyStatic, config);

        decorateReply = false;
    }
};

mount({
    '/': '../web/www',
    '/fa/css': '../../node_modules/@fortawesome/fontawesome-free/css',
    '/fa/webfonts': '../../node_modules/@fortawesome/fontawesome-free/webfonts',
    '/aptly/import': '../../packages/aptly/import',
    '/aptly/src': '../../packages/aptly/src',
    '/webly/import': '../../packages/webly/import',
    '/webly/src': '../../packages/webly/src'
});

await Apis.mount('/~api', path.join(import.meta.dirname, 'api'));

fastify.listen({ port: 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }

    fastify.log.info(`server start [${address}]`);
});
