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

                // bar: {
                //     items: {
                //         btn: {
                //             type: 'button',
                //             text: 'Click me!',
                //             zone: 'end',
                //             on: {
                //                 click: 'viewport.toggleTheme'
                //                 // click: e => { debugger; }
                //             }
                //         }
                //     }
                // },

                items: {
                    zip: {
                        html: 'Body zip',
                    },

                    herp: {
                        cls: 'herp',
                        docked: 'top',
                        html: 'Top Woot!!!',
                        tab: 'Herp',
                        element: {
                            style: { color: 'yellow' }
                        }
                    },

                    woot: {
                        cls: 'woot',
                        docked: 'left',
                        html: 'Left herp!',
                        tab: 'Woot',
                        element: {
                            style: 'color: lime; fontSize: 2em',
                        },
                        bind: {
                            html: p => `Left ${p.theme?.toUpperCase()}`
                        }
                    }
                }
            }
        }
    });
});
