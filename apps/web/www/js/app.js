import { Dom, Component, Nav, Viewport, Card } from '@appiphany/webly';


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
                flex: '1 1 auto',
                layout: Card,

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
                    herp: {
                        cls: 'herp',
                        docked: 'top',
                        html: 'Top Woot!!!',
                        element: {
                            style: { color: 'yellow' }
                        }
                    },

                    woot: {
                        cls: 'woot',
                        docked: 'left',
                        html: 'Left herp!',
                        element: {
                            style: 'color: lime; fontSize: 2em',
                        },
                        bind: {
                            html: p => `Left ${p.theme?.toUpperCase()}`
                        }
                    },

                    zap: {
                        tab: 'Zap',
                        html: 'Body zap',
                    },

                    zop: {
                        tab: 'Zop',
                        html: 'Body zop',
                    },

                    zip: {
                        html: 'Body zip',
                        tab: {
                            html: 'Zip',
                            renderTarget: 'navEnd'
                        }
                    }
                }
            }
        }
    });
});
