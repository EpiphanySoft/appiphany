import { chain, Configurable, Scheduler, Signal } from '@appiphany/appiphany';
import { Bindable, Factoryable, Identifiable } from '@appiphany/appiphany/mixin';
import { Dom } from '@appiphany/appiphany/widget';


const
    MODE_MAP = {
        append: 'parent',
        before: 'before',
        after: 'after'
    }

export class Widget extends Configurable.mixin(Bindable, Identifiable, Factoryable) {
    static type = 'widget';
    static factory = {
        defaultType: 'widget'
    };

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
            phase = 'init';

            apply (me, value) {
                return value ? (Array.isArray(value) ? value : ['append', value]) : [];
            }

            update (me) {
                me.render();
            }
        },
    };

    static #idMap = chain();

    static generateAutoId (prefix) {
        let map = this.#idMap;

        return map[prefix] = (map[prefix] || 0) + 1;
    }

    static idPrefix () {
        return this.type;
    }

    #composer = null;
    #dom = null;
    #recomposeNow = null;
    #renderWatcher = null;

    get dom () {
        return this.#dom;
    }

    compose () {
        const { props } = this;

        return {
            tag: props.tag,
            class: props.cls
        };
    }

    #recompose () {
        this.render();
        this.#renderWatcher?.watch();
    }

    #recomposeSoon () {
        let work = this.#recomposeNow ??= this.#recompose.bind(this);

        this.scheduler.add(work);
    }

    render () {
        let { id } = this,
            dom = this.#dom,
            [mode, renderTo] = this.renderTo,  // mode in {'append'|'before'|'after'|'adopt'}
            adopt = mode === 'adopt',
            composer = renderTo &&
                (this.#composer ??= Signal.formula(this.compose.bind(this), { name: `composer@${id}` })),
            spec = composer?.get(),
            watcher = this.#renderWatcher;

        if (spec) {
            spec.id = id;

            if (!adopt) {
                spec[MODE_MAP[mode]] = renderTo;
            }

            if (!dom) {
                this.#dom = dom = new Dom(adopt ? renderTo : null, this);
                dom.adopted = adopt;
            }
            else if (dom.adopted !== adopt) {
                throw new Error('Cannot change between adopted and rendered element');
            }
            else if (adopt && dom.el !== renderTo) {
                throw new Error('Cannot change adopted element');
            }

            dom.update(spec);

            if (!watcher) {
                this.#renderWatcher = watcher = Signal.watch(this.#recomposeSoon.bind(this));
                watcher.watch(composer);
            }
        }
        else {
            if (watcher) {
                watcher.unwatch(this.#composer);
                this.#renderWatcher = this.#composer = null;
            }

            if (dom) {
                if (dom.adopted) {
                    dom.el = null;  // prevent el.remove()
                }

                dom.destroy();
                this.#dom = null;
            }
        }
    }
}
