import { Dom, Component, Nav, Panel, Viewport, Card } from '@appiphany/webly';


window.xx = { Dom, Component, Viewport };

function onAdd (ev) {
    let p = ev.sender.parent,
        dialog;

    dialog = p.add({
        type: Card,
        ref: 'addDlg',
        title: 'Some Title',
        floating: true,
        modal: true,
        html:
            'Bacon ipsum dolor amet pancetta doner beef ribs rump tail strip steak boudin ' +
            'leberkas. Beef ribs frankfurter ham hock pork belly turducken sirloin meatball cow ' +
            'ball tip leberkas. Capicola kevin tenderloin beef ribs boudin ham hock. Rump ' +
            'biltong t-bone chuck doner porchetta andouille picanha prosciutto brisket beef ' +
            'flank short ribs cupim tri-tip. Tongue venison frankfurter, tail meatloaf pig ' +
            'leberkas ribeye ball tip sirloin kielbasa. Chuck beef ribs rump, short ribs jerky ' +
            'biltong corned beef meatloaf chicken strip steak salami ham tri-tip. Chicken ' +
            'prosciutto andouille hamburger short loin.',
        icon: 'fa-solid fa-close',
        // floating: true,
        // top: '50%',
        // left: '50%',
        centered: true,
        buttons: {
            cancel: 'Cancel',
            save: 'Save'
        },
        on: {
            button (ev) {
                debugger
            },
            icon (ev) {
                dialog.destroy();
            }
        }
    });
}

Dom.onReady(() => {
    window.v = Component.create({
        type: 'viewport',
        persistenceProvider: { type: 'storage', storage: localStorage },

        items: {
            foo: {
                type: Nav,
                cls: 'woot',
                flex: '1 1 auto',

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
                        type: 'container',
                        tab: 'Zap',
                        html: 'Body zap',
                        style: p => ({ backgroundColor: p.dark ? '#111' : '#eee' }),
                        // floatRoot: true,
                        items: {
                            // f1: {
                            //     html: 'Floaty',
                            //     floating: true,
                            //     top: '50%',
                            //     left: '50%',
                            //     style: { backgroundColor: 'red', color: 'white' }
                            // },
                            // f2: {
                            //     floating: true,
                            //     html: 'McFloatFace',
                            //     top: '51%',
                            //     left: '51%',
                            //     modal: true,
                            //     style: { backgroundColor: 'blue', color: 'white' }
                            // }
                            c1: {
                                type: 'button',
                                text: 'Add',
                                on: {
                                    click: onAdd
                                }
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
