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

        tag: 'button',
        text: null,

        fullwidth: null,
        inverted: null,
        level: null,  // info, success, warning, danger, primary, link, ghost, text
        loading: null,
        outlined: null,
        rounded: null,
        selected: null,
        size: null    // small, normal, medium, large
    };

    render () {
        let { fullwidth, level, loading, inverted, outlined, props, rounded, selected, size, text }
                = this,
            { theme } = props,
            ret = {
                class: {
                    'is-fullwidth' : !!fullwidth,
                    'is-inverted'  : !!inverted,
                    'is-loading'   : !!loading,
                    'is-outlined'  : !!outlined,
                    'is-rounded'   : !!rounded,
                    'is-selected'  : !!selected,
                    [`is-${level}`]: !!level,
                    [`is-${size}`] : !!size,
                    [`is-${theme}`]: true,
                },
                on: {
                    click: 'onClick'
                }
            };

        if (text) {
            ret.html = xss(text);
        }

        return ret;
    }

    onClick (e) {
        this.fire('click', e);
    }
}

Button.initClass();
