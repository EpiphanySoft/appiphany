import { Dom, Component, Viewport } from '@appiphany/webly';


window.Dom = Dom;
window.Component = Component;
window.Viewport = Viewport;

window.v = Component.factory.create({
    type: 'viewport',
    items: {
        foo: {
            cls: 'woot',
            items: {
                foo: {
                    cls: 'derp',
                    html: 'Woot!!!',
                    style: { color: 'yellow' }
                },
                bar: {
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
