import { Component } from '@appiphany/webly';


export class Viewport extends Component {
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
