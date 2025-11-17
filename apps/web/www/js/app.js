import { Dom, Widget, Viewport } from '@appiphany/webly';


window.Dom = Dom;
window.Widget = Widget;
window.Viewport = Viewport;

window.v = Widget.factory.create({
    type: 'viewport',
    items: {
        foo: {
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
                },
                btn: {
                    type: 'button',
                    text: 'Click me!'
                }
            }
        }
    }
});
