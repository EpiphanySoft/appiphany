import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import path from 'node:path';
import { Apis } from './Apis.js';

const fastify = Fastify({
    logger: true
});

const www = path.join(import.meta.dirname, '../web/www');

fastify.log.info(`Web package: ${www}`);

fastify.register(FastifyStatic, {
    root: www
});

Apis.fastify = fastify;
await Apis.loadAll('/~api', path.join(import.meta.dirname, 'api'));

fastify.listen({ port: 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }

    fastify.log.info(`server start [${address}]`);
});
