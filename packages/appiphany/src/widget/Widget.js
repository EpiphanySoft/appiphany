import { Configurable } from '@appiphany/appiphany';
import { Bindable } from '@appiphany/appiphany/mixin';


export class Widget extends Configurable.mixin(Bindable) {
    static configurable = {
        adopt: null,
        parent: null,

        cls: null,

        bind: {
            cls: '~cls'
        },

        props: {
            $: {
                cls: null,
                tag: 'div'
            }
        }
    };

    render () {
        const { props } = this;

        return {
            tag: props.tag,
            class: props.cls
        };
    }
}
