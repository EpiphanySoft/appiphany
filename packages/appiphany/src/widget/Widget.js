import { Configurable } from '@appiphany/appiphany';
import { Bindable } from '@appiphany/appiphany/mixin';
import { Dom } from '@appiphany/appiphany/widget';


export class Widget extends Configurable.mixin(Bindable) {
    static configurable = {
        props: {
            $: {
                cls: null,
                tag: 'div'
            }
        },

        /**
         * The element to render to and (optionally) the mode to use.
         *
         *      {
         *          renderTo: el
         *      }
         *
         * Or:
         *
         *      {
         *          renderTo: ['adopt', el]
         *      }
         *
         */
        renderTo: class {
            value = null;

            update (me, target) {
                let [mode, el] = Array.isArray(target) ? target : ['', target];

                if (el) {
                    me.render(el, mode);
                }
                else {
                    me.derender();
                }
            }
        },
    };

    #dom;
    #renderWatcher;

    get dom () {
        return this.#dom ??= new Dom(null, this);
    }

    compose () {
        const { props } = this;

        return {
            tag: props.tag,
            class: props.cls
        };
    }

    derender () {
        this.#dom?.el.remove();
        this.#dom = null;
    }

    render (el, mode) {
        mode = mode || 'append';  // in {'append'|'before'|'after'|'adopt'}

        const { dom } = this;

        dom.update(this.compose());
    }
}
