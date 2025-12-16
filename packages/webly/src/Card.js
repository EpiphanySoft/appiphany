import { Container, Dom, iconCls, renderIcon } from '@appiphany/webly';
import { clone, isString, map, merge } from '@appiphany/aptly';


/**
 * A panel component.
 */
export class Card extends Container {
    static type = 'card';

    static configurable = {
        buttons: null,
        icon: null,
        title: null,

        buttonDefaults: {
            '*': {
                cls: {
                    'card-footer-item': 1
                }
            },

            cancel: {
                icon: 'fa-cancel'
            }
        }
    };

    static shardable = {
        renderHeader (a, b) {
            return merge(a, b);
        },

        renderFooter (a, b) {
            return merge(a, b);
        }
    };

    render () {
        return {
            class: {
               'x-box-v': 1,
               card: 1
            },
            children: {
                header: this.renderHeader(),
                footer: this.renderFooter(),
            }
        };
    }

    renderBody () {
        return {
            class: {
                'card-content': 1
            }
        };
    }

    renderHeader () {
        let { icon, title } = this;

        return (icon || title) && {
            '>': 'body',
            tag: 'header',
            class: {
                'card-header': 1
            },
            children: {
                title: title && {
                    tag: 'p',
                    class: {
                        'card-header-title': 1
                    },
                    text: title
                },
                icon: icon && {
                    tag: 'button',
                    class: {
                        'card-header-icon': 1
                    },
                    children: {
                        _s: {
                            tag: 'span',
                            class: {
                                icon: 1
                            },
                            on: { click: 'onClickIcon' },
                            children: {
                                _i: {
                                    tag: 'i',
                                    aria: { hidden: true },
                                    class: iconCls(icon)
                                }
                            }
                        }
                    }
                }
            }
        };
    }

    renderFooter () {
        let { buttons } = this;

        return buttons && {
            '>': '^body',
            tag: 'footer',
            class: {
                'card-footer': 1
            },
            on: { click: 'onClickFooter' },
            children: map(buttons, (btn, ref) => this.renderFooterItem(ref, btn), 'object')
        };
    }

    renderFooterItem (ref, item) {
        if (isString(item)) {
            item = { text: item };
        }

        ref = isString(ref) ? ref : `btn${item.text}`;

        let { buttonDefaults } = this,
            defaults = clone(buttonDefaults['*']),
            defaults2 = buttonDefaults[ref],
            it = merge(defaults2 ? merge(defaults, defaults2) : defaults, item),
            { icon } = it;

        if (isString(icon)) {
            icon = { cls: icon };
        }

        it = {
            tag: 'a',
            class: it.cls,
            children: {
                _icon: renderIcon(icon),
                _s: {
                    tag: 'span',
                    text: it.text
                }
            }
        };

        return [ref, it];
    }

    onClickFooter (ev) {
        let btn = Dom.get(ev.target.closest('.card-footer-item'));

        btn && this.fire({
            type: 'button',
            action: btn.ref,
            dom: btn
        }, ev);
    }

    onClickIcon (ev) {
        let icon = Dom.get(ev.target.closest('.card-header-icon'));

        this.fire({
            type: 'icon',
            dom: icon
        }, ev);
    }
}

Card.initClass();
