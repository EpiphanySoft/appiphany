import { map, SKIP } from '@appiphany/aptly';
import { Component, Container } from '@appiphany/webly';

const
    mapTab = it => {
        let { tab } = it;

        debugger;
        if (!tab) {
            return SKIP;
        }

        if (typeof tab === 'string') {
            tab = {
                html: tab
            };
        }

        return tab;
    };

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
        debugger;
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
        let { id, burger, menu } = this.props,
            items = this.getItems(),
            { tabs } = this.props;

        debugger;
        if (tabs) {
            items = Component.sortItems([...tabs, ...items]);
        }

        return {
            brand: {
                cls: {
                    'navbar-brand': 1
                }
                // brand icon
                // burger button
            },
            body: {
                id: `${id}-body`,
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
            value = {
                type: Navbar,
                docked: 'top'
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
                instance.props.tabs = value ? map(value, mapTab, 'array') : [];
            }
        },

        props: {
            tabs: null
        }
    };
}

Nav.initClass();
