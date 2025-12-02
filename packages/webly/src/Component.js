import { chain, panik, Widget, Signal, isObject, clone, merge } from '@appiphany/aptly';
import { Factoryable } from '@appiphany/aptly/mixin';
import { Dom } from '@appiphany/webly';


const
    EMPTY_ARRAY = [],
    MODE_MAP = {
        append: 'parent',
        before: 'before',
        after: 'after'
    },
    ignoredComposeConfigs = { props: 1, renderTarget: 1 },
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


export class Component extends Widget.mixin(Factoryable) {
    static type = 'component';
    static expando = ['ref'];
    static factory = {
        defaultType: 'component'
    };

    static #idMap = chain();

    static generateAutoId (prefix) {
        let map = Component.#idMap;

        return map[prefix] = (map[prefix] || 0) + 1;
    }

    static identifierPrefix () {
        return this.type;
    }

    static configurable = {
        cls: null,

        html: null,

        style: null,

        tag: 'div',

        /**
         * The default `renderTarget` for items that do not specify their own `renderTarget`.
         */
        itemRenderTarget: null,

        /**
         * A `Component` can container other component. This property is an object mapping ref names to
         * component configs:
         *
         *      new Component({
         *          renderTo: document.body,
         *          items: {
         *              btn: {
         *                  type: 'button',
         *                  ...
         *              }
         *          }
         *      });
         *
         * The keys of the object preserve their declaration order, and that order determines their
         * order in the DOM.
         */
        items: class {
            apply (me, newItems, was) {
                //  newItems = {
                //      foo: { type: 'component' },
                //      bar: { type: 'component' },
                //  }
                //
                let items = {},
                    existingByRef = was && chain(),
                    i = 0,
                    same = true,
                    existingIndex, existingItem, ref, item;

                newItems ??= {};

                if (!isObject(newItems)) {
                    panik('items must be an object');
                }

                if (was) {
                    for (ref in was) {
                        existingByRef[ref] = [i++, was[ref]];
                    }
                }

                i = 0;

                for (ref in newItems) {
                    item = newItems[ref];

                    if (item) {
                        [existingIndex, existingItem] = existingByRef?.[ref] || EMPTY_ARRAY;

                        if (!item.is?.component) {
                            item = clone(item);
                            item.parent = me;
                            item.ref = ref;

                            item = Component.reconfigure(existingItem, item);
                        }

                        if (item === existingItem) {
                            // either newItems held an instantiated Component to replace the existingItem,
                            // or the reconfigure() of the existingItem returned the existingItem (now
                            // with config changes).
                            delete existingByRef[ref];
                        }
                        else {
                            same = false;
                        }

                        items[ref] = item;

                        if (existingIndex !== i) {
                            same = false;
                        }
                    }

                    ++i;
                }

                if (existingByRef) {
                    for (ref in existingByRef) {
                        existingByRef[ref].destroy();
                        same = false;
                    }
                }

                return same ? was : items;
            }
        },

        /**
         * The ref name of the element to render this component's content into. If not specified,
         * the parent component's `itemRenderTarget` is used.
         */
        renderTarget: class {
            value = null;

            update (me) {
                let { parent } = me;

                if (parent?.initialized) {
                    parent.recompose(true);
                }
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
        }
    };

    static shardable = {
        render (a, b) {
            return merge(a, b);
        }
    };

    #composer = null;
    #dom = null;
    #recomposer = null;
    #renderToUsed = false;
    #renderWatcher = null;
    #watcherNotified = false;
    #watchRenderConfigs = null;

    get dom () {
        return this.#dom;
    }

    destruct () {
        this.#unrender();

        super.destruct();
    }

    compose () {
        let spec = this.render(),
            items = this.items,
            { itemRenderTarget } = this,
            it, ref, refs, renderTarget, specs;

        if (items) {
            refs = gatherRefs({}, 'root', spec);
            itemRenderTarget ??= 'root';

            for (ref in items) {
                it = items[ref];
                renderTarget = refs[it.renderTarget || itemRenderTarget];

                if (renderTarget) {
                    specs = renderTarget.specs ??= [];

                    if (!Array.isArray(specs)) {
                        renderTarget.specs = specs = Dom.canonicalizeSpecs(specs);
                    }

                    specs.push(it.dom);
                }
            }
        }

        return spec;
    }

    initialize() {
        super.initialize();

        if (!this.dom) {
            this.recompose();
        }
    }

    render () {
        let { cls, html, style, tag } = this;

        return {
            tag,
            html,
            class: clone(cls),
            style: clone(style)
        };
    }

    #getRenderPlan () {
        let renderTo = !this.destroyed && this.renderTo,
            renderToUsed = this.#renderToUsed,
            mode;

        if (renderTo) {
            this.#renderToUsed = renderToUsed = true;
            [mode, renderTo] = renderTo;
        }
        else if (renderToUsed) {
            renderTo = Dom.limbo;
        }

        return [renderToUsed, mode || 'append', renderTo];
    }

    recompose (full) {
        let me = this,
            { id } = me,
            dom = me.#dom,
            [renderToUsed, mode, renderTo] = me.#getRenderPlan(),
            adopt = mode === 'adopt',
            composer = me.#composer ??=
                Signal.formula(() => me.compose(), { name: `composer@${id}` }),
            watcher = me.#renderWatcher,
            configsUsed, spec;

        full && composer.invalidate();

        configsUsed = me.trackUsedConfigs(() => {
            spec = composer.get();
        });

        if (configsUsed) {
            me.#watchRenderConfigs ??= me.watchConfigs(() => me.initialized && me.recompose(true));
        }

        (configsUsed || full) && me.#watchRenderConfigs?.(configsUsed);

        if (!spec) {
            me.#unrender();
        }
        else {
            spec.id = id;

            if (!adopt && renderToUsed) {
                spec[MODE_MAP[mode]] = renderTo;
            }

            if (!dom) {
                me.#dom = dom = new Dom(adopt ? renderTo : null, me);
            }
            else if (dom.adopted !== adopt) {
                panik('Cannot change between adopted and rendered element');
            }
            else if (adopt && dom.el !== renderTo) {
                panik('Cannot change adopted element');
            }

            dom.update(spec);

            if (!watcher) {
                me.#renderWatcher = watcher = Signal.watch(() => {
                    me.#watcherNotified = true;
                    me.recomposeSoon();
                });

                watcher.watch(composer);

                me.$meta.types.forEach(t => dom.el.classList.add(`x-${t}`));
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
        let recomposer = this.#recomposer ??= () => this.#recomposeNow();

        console.log(`invalidated ${this.id}`);
        this.scheduler.add(recomposer);
    }

    #unrender () {
        let watcher = this.#renderWatcher;

        if (watcher) {
            watcher.unwatch(this.#composer);
            this.#renderWatcher = this.#composer = null;
        }

        this.#dom?.destroy();
        this.#dom = null;
    }
}

Component.initClass();
