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
}


/**
 * A navigation bar component.
 *
 * See https://bulma.io/documentation/components/navbar/
 */
export class Navbar extends Component {
    static type = 'navbar';

    static configurable = {
        cls: {
            navbar: 1
        }
    };

    render () {
        let { props } = this,
            { tabs } = props,
            ret = {
                specs: {}
                // class: {
                // },
                // on: {
                //     click: 'onClick'
                // }
            };

        return ret;
    }

    // onClick (e) {
    //     this.fire('click', e);
    // }
    render () {
        let { items, props } = this,
            { tabs } = props;

        debugger;
        return {
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
                type: Navbar
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
