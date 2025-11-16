import { Widget } from '@appiphany/appiphany/widget';


export class Viewport extends Widget {
    static type = 'viewport';

    static configurable = {
        renderTo: ['adopt', document.body],

        theme: class {
            value = '';

            update (me, theme) {
                theme ??= 'dark';

                let { classList } = Dom.docRoot.el,
                    dark = theme !== 'light';

                classList.toggle('theme-dark', dark);
                classList.toggle('theme-light', !dark);
            }
        }
    };
}

Viewport.initClass();
