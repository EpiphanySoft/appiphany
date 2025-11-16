import { Dom, Widget, Viewport } from '@appiphany/appiphany/widget';


window.Dom = Dom;
window.Widget = Widget;
window.Viewport = Viewport;

debugger;
window.v = new Viewport();
window.v.initialize();

window.w = Widget.factory.create({
    renderTo: document.body,
    cls: 'woot',
    items: {
        foo: {
            type: 'widget',
            cls: 'derp',
            html: 'Woot!!!',
            style: { color: 'yellow' }
        },
        bar: {
            type: 'widget',
            cls: 'woot',
            html: 'derp!',
            style: 'color: lime; fontSize: 2em'
        }
    }
});
