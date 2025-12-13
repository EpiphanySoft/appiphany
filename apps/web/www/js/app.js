import { Dom, Component, Nav, Viewport, Card } from '@appiphany/webly';


window.xx = { Dom, Component, Viewport };

Dom.onReady(() => {
    window.v = Component.create({
        type: 'viewport',
        stateProvider: { type: 'storage', storage: localStorage },

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
                        icon: p => p.darkMode ? 'fa-solid fa-lightbulb' : 'fa-regular fa-moon',
                        floating: true,
                        top: 6,
                        right: 10,
                        on: {
                            click: ev => {
                                let p = ev.sender.props;

                                p.theme = p.darkMode ? 'light' : 'dark';
                            }
                        }
                    },

                    zap: {
                        tab: 'Zap',
                        html: 'Body zap',
                        style: p => ({ backgroundColor: p.darkMode ? '#111' : '#eee' })
                    },

                    zop: {
                        tab: 'Zop',
                        html: 'Body zop',
                        style: p => ({ backgroundColor: p.darkMode ? '#222' : '#ddd' })
                    },

                    zip: {
                        html: p => `Body Zip ${p.theme?.toUpperCase()}`,
                        style: p => ({ backgroundColor: p.darkMode ? '#333' : '#e8e8e8' }),
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
