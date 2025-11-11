import { chain, panik, Configurable, Signal, isObject, clone, isEqual } from '@appiphany/appiphany';
import { Bindable, Factoryable, Identifiable } from '@appiphany/appiphany/mixin';
import { Dom } from '@appiphany/appiphany/widget';


const
    EMPTY_ARRAY = [],
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
    static expando = ['ref'];
    static factory = {
        defaultType: 'widget'
    };

    static configurable = {
        $props: {
            cls: null,
            items: null,
            tag: 'div'
        },

        itemRenderTarget: null,

        items: class {
            apply (me, newItems, was) {
                //  newItems = {
                //      foo: { type: 'widget' },
                //      bar: { type: 'widget' },
                //  }
                //
                let items = [],
                    existingByRef = was && chain(),
                    i = 0,
                    existingItem, ref, item;

                newItems ??= {};

                if (!isObject(newItems)) {
                    panik('items must be an object');
                }

                if (was) {
                    for (item of was) {
                        existingByRef[item.ref] = [i++, item];
                    }
                }

                for (ref in newItems) {
                    item = newItems[ref];

                    if (item) {
                        existingItem = existingByRef?.[ref] || null;

                        if (!item.is?.widget) {
                            item = clone(item);
                            item.parent = me;
                            item.ref = ref;

                            item = Widget.factory.reconfigure(existingItem, item);
                        }

                        if (item === existingItem) {
                            // either newItems held an instantiated Widget to replace the existingItem,
                            // or the reconfigure() of the existingItem returned the existingItem (now
                            // with config changes).
                            delete existingByRef[ref];
                        }

                        items.push(item);
                    }
                }

                if (existingByRef) {
                    for (ref in existingByRef) {
                        existingByRef[ref].destroy();
                    }
                }

                return isEqual(was, items) ? was : items;
            }

            update (me) {
                if (me.initialized) {
                    me.recompose(true);
                }
            }
        },

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

            update (me) {
                me.recompose(true);
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

            for (it of items) {
                renderTarget = refs[it.renderTarget || itemRenderTarget];

                if (renderTarget) {
                    it.recompose();

                    specs = renderTarget.specs ??= {};

                    if (Array.isArray(specs)) {
                        specs.push(it.dom);
                    }
                    else {
                        specs[it.ref] = it.dom;
                    }
                }
            }
        }

        return spec;
    }

    render () {
        let { props } = this;

        return {
            tag: props.tag,
            class: props.cls
        };
    }

    recompose (full) {
        let { id } = this,
            dom = this.#dom,
            [m, r2] = this.renderTo || EMPTY_ARRAY,  // {'append'|'before'|'after'|'adopt'}
            renderTo = this.destroyed ? null : (r2 || Dom.limbo),
            mode = renderTo ? m || 'append' : '',
            adopt = mode === 'adopt',
            composer = renderTo &&
                (this.#composer ??= Signal.formula(this.compose.bind(this), { name: `composer@${id}` })),
            watcher = this.#renderWatcher,
            spec;

        full && this.#composer.invalidate();

        spec = composer?.get();

        if (!spec) {
            this.#unrender();
        }
        else {
            spec.id = id;

            if (!adopt && renderTo) {
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

Widget.initClass();
