import { Configurable } from '@appiphany/appiphany';
import { Bindable } from '@appiphany/appiphany/mixin';


export class Widget extends Configurable.mixin(Bindable) {
    static configurable = {
        props: {
            $: {
                cls: null,
                tag: 'div'
            }
        }
    };

    render (options) {
        // [adopt|after|before|parent]
        const { props } = this;

        return {
            tag: props.tag,
            class: props.cls
        };
    }
}
