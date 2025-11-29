import { Dom, Component, Viewport } from '@appiphany/webly';


window.Dom = Dom;
window.Component = Component;
window.Viewport = Viewport;

window.v = Component.create({
    type: 'viewport',

    items: {
        foo: {
            cls: 'woot',
            items: {
                herp: {
                    cls: 'herp',
                    html: 'Woot!!!',
                    style: { color: 'yellow' }
                },
                woot: {
                    cls: 'woot',
                    html: 'herp!',
                    style: 'color: lime; fontSize: 2em',
                    bind: {
                        html: p => p.theme?.toUpperCase()
                    }
                },
                btn: {
                    type: 'button',
                    text: 'Click me!',
                    on: {
                        click: 'viewport.toggleTheme'
                        // click: e => { debugger; }
                    }
                }
            }
        }
    }
});
