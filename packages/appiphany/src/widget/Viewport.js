import { Widget } from '@appiphany/appiphany/widget';


export class Viewport extends Widget {
    static type = 'viewport';

    static configurable = {
        renderTo: ['adopt', document.body]
    };
}

Viewport.initClass();
