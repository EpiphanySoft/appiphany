import { Dom, Component, Nav, Viewport } from '@appiphany/webly';


window.Dom = Dom;
window.Component = Component;
window.Viewport = Viewport;

Dom.onReady(() => {
    window.v = Component.create({
        type: 'viewport',

        items: {
            foo: {
                type: Nav,
                cls: 'woot',

                bar: {
                    items: {
                        btn: {
                            type: 'button',
                            text: 'Click me!',
                            zone: 'end',
                            on: {
                                click: 'viewport.toggleTheme'
                                // click: e => { debugger; }
                            }
                        }
                    }
                },

                items: {
                    herp: {
                        cls: 'herp',
                        html: 'Woot!!!',
                        tab: 'Herp',
                        style: { color: 'yellow' }
                    },

                    woot: {
                        cls: 'woot',
                        html: 'herp!',
                        tab: 'Woot',
                        style: 'color: lime; fontSize: 2em',
                        bind: {
                            html: p => p.theme?.toUpperCase()
                        }
                    }
                }
            }
        }
    });
});
