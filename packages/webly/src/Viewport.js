import { Widget } from '@appiphany/webly';


export class Viewport extends Widget {
    static type = 'viewport';

    static configurable = {
        renderTo: ['adopt', document.body],

        theme: class {
            value = '';

            update (me, theme) {
                theme ??= 'dark';

                let dark = theme !== 'light';

                Dom.docRoot.setClasses({
                    'theme-dark': dark,
                    'theme-light': !dark
                })
            }
        }
    };
}

Viewport.initClass();
