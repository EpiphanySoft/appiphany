import { merge, xss } from '@appiphany/aptly';
import { Component } from '@appiphany/webly';

/**
 * A button component.
 *
 * See https://bulma.io/documentation/elements/button/
 */
export class Button extends Component {
    static type = 'button';

    static configurable = {
        cls: {
            button: 1
        },

        element: {
            tag: 'button'
        },

        text: null,

        fullwidth: null,
        icon: null,
        inverted: null,
        level: null,  // info, success, warning, danger, primary, link, ghost, text
        loading: null,
        outlined: null,
        rounded: null,
        selected: null,
        size: null    // small, normal, medium, large
    };

    render () {
        let { fullwidth, level, loading, icon, inverted, outlined, props, rounded, selected, size, text }
                = this,
            { theme } = props;

        return {
            class: {
                'is-fullwidth' : !!fullwidth,
                'is-inverted'  : !!inverted,
                'is-loading'   : !!loading,
                'is-outlined'  : !!outlined,
                'is-rounded'   : !!rounded,
                'is-selected'  : !!selected,
                [`is-${level}`]: !!level,
                [`is-${size}`] : !icon && !!size,
                [`is-${theme}`]: true,
            },
            children: {
                icon: icon && {
                    tag: 'span',
                    class: {
                        icon: 1,
                        [`is-${size}`]: !!size
                    },
                    children: {
                        _i: {
                            tag: 'i',
                            class: {
                                fas: icon.startsWith('fa-'),
                                ...Object.fromEntries(icon.split(' ').map(c => [c, 1]))
                            }
                        }
                    }
                },
                text: text && {
                    tag: 'span',
                    text
                }
            },
            on: {
                click: 'onClick'
            }
        };
    }

    onClick (e) {
        this.fire('click', e);
    }
}

Button.initClass();
