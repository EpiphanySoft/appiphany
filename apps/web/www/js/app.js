import { Dom, Widget } from '@appiphany/appiphany/widget';


window.Dom = Dom;
window.Widget = Widget;

class Viewport extends Widget {
    static type = 'viewport';

    static configurable = {
        props: {
            $: {
                tag: 'body'
            }
        },

        renderTo: ['adopt', document.body]
    };
}

window.Viewport = Viewport;

debugger;
window.v = new Viewport();
window.v.initialize();

window.w = new Widget({
    renderTo: document.body,
    cls: 'woot'
});

window.w.initialize();
