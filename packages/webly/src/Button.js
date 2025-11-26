import { xss } from '@appiphany/aptly';
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
        }
    };

    render () {
        let { props } = this,
            { text } = props,
            ret = super.render();

        if (text) {
            ret.html = xss(text);
        }

        return ret;
    }
}

Button.initClass();
