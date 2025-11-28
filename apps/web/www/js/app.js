import { Dom, Component, Viewport } from '@appiphany/webly';


window.Dom = Dom;
window.Component = Component;
window.Viewport = Viewport;

window.v = Component.create({
    type: 'viewport',
    props: {
        woot: null
    },
    bind: {
        theme: '>woot'
    },
    stateProvider: {
        type: 'storage',
        storage: localStorage
    },
    stateful: {
        // woot: true
        theme: true
    },
    items: {
        foo: {
            cls: 'woot',
            items: {
                foo: {
                    cls: 'herp',
                    html: 'Woot!!!',
                    style: { color: 'yellow' }
                },
                bar: {
                    cls: 'woot',
                    html: 'herp!',
                    style: 'color: lime; fontSize: 2em',
                    bind: {
                        html: p => p.woot?.toUpperCase()
                    }
                },
                btn: {
                    type: 'button',
                    text: 'Click me!',
                    on: {
                        click: 'viewport.toggleTheme'
                        // click: e => {
                        //     debugger;
                        // }
                    }
                }
            }
        }
    }
});
