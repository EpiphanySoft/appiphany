import { chain, panik, Configurable, Signal } from '@appiphany/appiphany';
import { Bindable, Factoryable, Identifiable } from '@appiphany/appiphany/mixin';
import { Dom } from '@appiphany/appiphany/widget';


const
    MODE_MAP = {
        append: 'parent',
        before: 'before',
        after: 'after'
    },
    gatherRefs = (refs, ref, spec) => {
        //  spec = {
        //      specs: {
        //          body: {
        //              specs: {
        //                  inner: {
        //                  }
        //              }
        //          }
        //      }
        //  }
        //
        if (spec) {
            if (ref) {
                refs[ref] = spec;
            }

            if (spec.specs) {
                for (ref in spec.specs) {
                    gatherRefs(refs, ref, spec.specs[ref]);
                }
            }
        }

        return refs;
    };


export class Widget extends Configurable.mixin(Bindable, Identifiable, Factoryable) {
    static type = 'widget';
    static factory = {
        defaultType: 'widget'
    };

    static configurable = {
        iprops: {
            cls: null,
            tag: 'div'
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
                me.recompose();
            }
        }
    };

    static #idMap = chain();

    static generateAutoId (prefix) {
        let map = Widget.#idMap;

        return map[prefix] = (map[prefix] || 0) + 1;
    }

    static idPrefix () {
        return this.type;
    }

    #composer = null;
    #dom = null;
    #recomposer = null;
    #renderWatcher = null;
    #watcherNotified = false;

    get dom () {
        return this.#dom;
    }

    compose () {
        let spec = this.render(),
            refs = gatherRefs({}, 'root', spec);


        return spec;
    }

    render () {
        const { props } = this;

        return {
            tag: props.tag,
            class: props.cls
        };
    }

    recompose () {
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
            }
            else if (dom.adopted !== adopt) {
                panik('Cannot change between adopted and rendered element');
            }
            else if (adopt && dom.el !== renderTo) {
                panik('Cannot change adopted element');
            }

            dom.update(spec);

            if (!watcher) {
                this.#renderWatcher = watcher = Signal.watch(() => {
                    this.#watcherNotified = true;
                    this.recomposeSoon();
                });

                watcher.watch(composer);

                this.$meta.types.forEach(t => dom.el.classList.add(`x-${t}`));
            }
        }
        else {
            if (watcher) {
                watcher.unwatch(this.#composer);
                this.#renderWatcher = this.#composer = null;
            }

            if (dom) {
                dom.destroy();
                this.#dom = null;
            }
        }
    }

    #recomposeNow () {
        this.recompose();

        if (this.#watcherNotified) {
            this.#watcherNotified = false;
            this.#renderWatcher?.watch();
        }
    }

    recomposeSoon () {
        let recompose = this.#recomposer ??= () => this.#recomposeNow();

        this.scheduler.add(recompose);
    }
}

Widget.initClass();
