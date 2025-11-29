import { merge, xss } from '@appiphany/aptly';
import { Component } from '@appiphany/webly';


export class Button extends Component {
    static type = 'button';

    static configurable = {
        $props: {
            cls: {
                button: 1
            },
            tag: 'button',
            text: null
        },

        level: null  // info, success, warning, danger
    };

    render () {
        let { level, props } = this,
            { text, theme } = props,
            ret = super.render();

        if (text) {
            ret.html = xss(text);
        }

        merge(ret, {
            class: {
                [`is-${level}`]: !!level,
                [`is-${theme}`]: true,
            },
            listeners: {
                click: 'onClick'
            }
        });

        return ret;
    }

    onClick (e) {
        this.fire('click', e);
    }
}

Button.initClass();
