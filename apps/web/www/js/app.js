import { Dom, Component, Nav, Viewport, Card } from '@appiphany/webly';


window.xx = { Dom, Component, Viewport };

Dom.onReady(() => {
    window.v = Component.create({
        type: 'viewport',
        persistenceProvider: { type: 'storage', storage: localStorage },

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
                        style: { backgroundColor: '#111', color: 'yellow' }
                    },

                    floaty: {
                        type: 'button',
                        icon: p => p.dark ? 'fa-solid fa-lightbulb' : 'fa-regular fa-moon',
                        floating: true,
                        top: 6,
                        right: 10,
                        on: {
                            click: ev => {
                                let p = ev.sender.props;

                                p.theme = p.dark ? 'light' : 'dark';
                            }
                        }
                    },

                    zap: {
                        tab: 'Zap',
                        html: 'Body zap',
                        style: p => ({ backgroundColor: p.dark ? '#111' : '#eee' }),
                        floatRoot: true,
                        items: {
                            f1: {
                                floating: true,
                                html: 'Floaty',
                                top: '50%',
                                left: '50%',
                                style: { backgroundColor: 'red', color: 'white' }
                            },
                            f2: {
                                floating: true,
                                html: 'McFloatFace',
                                top: '51%',
                                left: '51%',
                                style: { backgroundColor: 'blue', color: 'white' }
                            }
                        }
                    },

                    zop: {
                        tab: 'Zop',
                        html: 'Body zop',
                        style: p => ({ backgroundColor: p.dark ? '#222' : '#ddd' })
                    },

                    zip: {
                        html: p => `Body Zip ${p.theme?.toUpperCase()}`,
                        style: p => ({ backgroundColor: p.dark ? '#333' : '#e8e8e8' }),
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
