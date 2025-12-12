import { values } from '@appiphany/aptly';
import { Component, Panel, ItemsConfig } from '@appiphany/webly';


export class NavbarTab extends Component {
    static type = 'navbarTab';

    static configurable = {
        cls: {
            'navbar-item': 1,
            'is-tab': 1
        },

        element: {
            tag: 'a'
        },

        item: null
    }

    get nav () {
        return this.up('nav');
    }

    onClickTab () {
        this.nav.activeItem = this.item;
    }

    render () {
        let { item } = this;

        return {
            class: {
                'is-active': item === this.nav?.activeItem
            },
            on: {
                click: 'onClickTab'
            }
        }
    }
}

NavbarTab.initClass();

/**
 * A navigation bar component.
 *
 * See https://bulma.io/documentation/components/navbar/
 */
export class Navbar extends Component {
    static type = 'navbar';

    static configurable = {
        itemRenderTarget: 'navStart',

        bind: {
            tabs: 'navTabs'
        },

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

        burgerized: null,

        menu: null,

        tabs: class extends ItemsConfig {
            getItemDefaults (instance) {
                return {
                    type: NavbarTab,
                    parent: instance
                };
            }
        },

        props: {
            navTabs () {
                let items = this.parent?.getItems(),
                    tabs = null,
                    it, tab;

                if (items) {
                    for (it of items) {
                        tab = it.tab;

                        if (tab) {
                            if (typeof tab === 'string') {
                                tab = {
                                    html: tab
                                };
                            }

                            (tabs ??= {})[`${it.ref}Tab`] = {
                                ...tab,
                                item: it
                            };
                        }
                    }
                }

                return tabs;
            }
        }
    };

    getItems (kind) {
        let items = super.getItems(kind),
            tabs = (!kind || kind.inner) && this.tabs;

        if (tabs) {
            tabs = values(tabs);
            items = Component.sortItems([...tabs, ...items]);
        }

        return items;
    }

    onClickBurger (e) {
        this.burgerized = !this.burgerized;
    }

    render () {
        let { id, burger, burgerized, menu } = this;

        burgerized = !!burgerized;

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
                            class: { 'navbar-burger': 1, 'is-active': burgerized },
                            on: { click: 'onClickBurger' },
                            children: {
                                _1: { tag: 'span', aria: { hidden: true } },
                                _2: { tag: 'span', aria: { hidden: true } },
                                _3: { tag: 'span', aria: { hidden: true } },
                                _4: { tag: 'span', aria: { hidden: true } }
                            }
                        }
                    }
                },

                body: {
                    id: `${id}-body`,
                    class: {
                        'navbar-menu': 1,
                        'is-active': burgerized
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
export class Nav extends Panel {
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
        }
    };

    getItems (kind) {
        let items = super.getItems(kind),
            { bar } = this;

        if (bar && (kind?.docked === true || kind?.docked === bar.docked)) {
            items.unshift(bar);
        }

        return items;
    }
}

Nav.initClass();
