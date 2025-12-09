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
                        docked: 'bottom',
                        html: 'Bottom Woot!!!',
                        element: {
                            style: { color: 'yellow' }
                        }
                    },

                    zap: {
                        tab: 'Zap',
                        html: 'Body zap',
                        element: {
                            style: { backgroundColor: '#111' }
                        }
                    },

                    zop: {
                        tab: 'Zop',
                        html: 'Body zop',
                        element: {
                            style: { backgroundColor: '#222' }
                        }
                    },

                    zip: {
                        bind: {
                            html: p => `Body Zip ${p.theme?.toUpperCase()}`
                        },
                        element: {
                            style: { backgroundColor: '#333' }
                        },
                        tab: {
                            renderTarget: 'navEnd',
                            html: 'Zip'
                        }
                    }
                }
            }
        }
    });
});
