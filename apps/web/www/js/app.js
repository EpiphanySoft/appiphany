import { Dom, Widget, Viewport } from '@appiphany/appiphany/widget';


window.Dom = Dom;
window.Widget = Widget;
window.Viewport = Viewport;

debugger;
window.v = new Viewport();
window.v.initialize();

window.w = new Widget({
    renderTo: document.body,
    cls: 'woot',
    items: {
        foo: {
            type: 'widget',
            cls: 'derp',
            html: 'Woot!!!'
        },
        bar: {
            type: 'widget',
            cls: 'woot',
            html: 'derp!'
        }
    }
});

window.w.initialize();
