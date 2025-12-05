import { values } from '@appiphany/aptly';
import { Component, Container, ItemsConfig } from '@appiphany/webly';


export class NavbarTab extends Component {
    static type = 'navbar-tab';

    static configurable = {
        cls: {
            'navbar-item': 1
        },

        element: {
            tag: 'a'
        }
    }
}


/**
 * A navigation bar component.
 *
 * See https://bulma.io/documentation/components/navbar/
 */
export class Navbar extends Component {
    static type = 'navbar';

    static configurable = {
        itemRenderTarget: 'navStart',

        cls: {
            navbar: 1
        },

        element: {
            tag: 'nav',
            role: 'navigation'
        },

        burger: class {
            value = null;
            default = true;
        },

        menu: null
    };

    getItems (docked) {
        let items = super.getItems(docked),
            tabs;

        if (!docked) {
            tabs = this.props.tabs;

            if (tabs) {
                items = Component.sortItems([...tabs, ...items]);
            }
        }

        return items;
    }

    // onClick (e) {
    //     this.fire('click', e);
    // }
    render () {
        let { id, burger, menu } = this,
            bodyId = `${id}-body`;

        return {
            children: {
                brand: {
                    class: {
                        'navbar-brand': 1
                    },
                    children: {
                        // TODO brand icon
                        burger: burger && {
                            tag:  'a',
                            role: 'button',
                            aria:  { label: 'menu', expanded: false },
                            class: { 'navbar-burger': 1 },
                            data:  { target: bodyId },
                            children: {
                                s1: { tag: 'span', aria: { hidden: true } },
                                s2: { tag: 'span', aria: { hidden: true } },
                                s3: { tag: 'span', aria: { hidden: true } },
                                s4: { tag: 'span', aria: { hidden: true } }
                            }
                        }
                    }
                },
                body: {
                    id: bodyId,
                    class: {
                        'navbar-menu': 1
                    },
                    children: {
                        navStart: {
                            class: {
                                'navbar-start': 1
                            }
                        },
                        navEnd: {
                            class: {
                                'navbar-end': 1
                            }
                        }
                    }
                }
            }
        };
    }
}

Navbar.initClass();

/**
 *
 */
export class Nav extends Container {
    static type = 'nav';

    static configurable = {
        bar: class {
            phase = 'init';
            value = {
                type: Navbar,
                docked: 'top',
                order: -10
            };

            apply (instance, value, was) {
                return Component.reconfigure(was, value, {
                    defaults: {
                        parent: instance
                    }
                });
            }
        },

        items: class {
            update (instance, value) {
                let tabs = null,
                    it, ref, tab;

                if (value) {
                    for (ref in value) {
                        it = value[ref];
                        tab = it.tab;

                        if (tab) {
                            if (typeof tab === 'string') {
                                tab = {
                                    html: tab
                                };
                            }

                            (tabs ??= {})[`${ref}Tab`] = tab;
                        }
                    }
                }

                instance.tabs = tabs;
            }
        },

        props: {
            tabs: null
        },

        tabs: class extends ItemsConfig {
            getItemDefaults (instance) {
                return {
                    type: NavbarTab,
                    parent: instance
                };
            }

            update (instance, value) {
                instance.props.tabs = value && values(value);
            }
        }
    };

    getItems (docked) {
        let items = super.getItems(docked),
            { bar } = this;

        if (bar && (docked === true || docked === bar.docked)) {
            items.unshift(bar);
        }

        return items;
    }
}

Nav.initClass();
