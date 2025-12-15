import { Container, Dom, iconCls } from '@appiphany/webly';
import { map, merge } from '@appiphany/aptly';


/**
 * A panel component.
 */
export class Panel extends Container {
    static type = 'panel';

    static configurable = {
        buttons: null,
        icon: null,
        title: null
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
        if (typeof item === 'string') {
            item = { text: item };
        }

        item = merge({
            tag: 'a',
            class: { 'card-footer-item': 1 }
        }, item);

        if (typeof ref !== 'string') {
            ref = `btn${item.text}`;
        }

        return [ref, item];
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

Panel.initClass();
