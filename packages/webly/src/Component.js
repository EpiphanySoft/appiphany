import { chain, panik, Widget, Signal, isObject, clone, merge,
         EMPTY_ARRAY, EMPTY_OBJECT, values, Config, Configurable }
    from '@appiphany/aptly';
import { Factoryable } from '@appiphany/aptly/mixin';
import { Dom, LayoutConfig } from '@appiphany/webly';


const
    MODE_MAP = {
        append: 'parent',
        before: 'before',
        after: 'after'
    },
    ignoredComposeConfigs = { props: 1, renderTarget: 1 },
    orderSortFn = (a, b) => a.order - b.order,
    gatherRefs = (refs, ref, spec) => {
        //  spec = {
        //      children: {
        //          body: {
        //              children: {
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

            if (spec.children) {
                for (ref in spec.children) {
                    gatherRefs(refs, ref, spec.children[ref]);
                }
            }
        }

        return refs;
    };


export class ItemsConfig extends Config {
    apply (instance, newItems, was) {
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
                    item.parent = instance;
                    item.ref = ref;

                    item = this.reconfigureItem(instance, existingItem, item);
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

    getItemDefaults (instance) {
        return {
            parent: instance
        };
    }

    reconfigureItem (instance, existingItem, item) {
        return Component.reconfigure(existingItem, item, {
            defaults: this.getItemDefaults(instance)
        });
    }
}

export class Component extends Widget.mixin(Factoryable) {
    static type = 'component';
    static factory = {
        defaultType: 'component'
    };

    static configurable = {
        // CSS/HTML
        cls: class extends Config.Flags {},

        flex: null,
        html: null,
        width: null,
        height: null,

        element: {
            aria: null,
            style: null,
            tag: 'div'
        },

        // General

        docked: null,
        ref: null,
        tab: null,
        zone: null,

        layout: class extends LayoutConfig {},

        order: class {
            default = 0;
        },

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
        items: class extends ItemsConfig {},

        /**
         * The ref name of the element to render this component's content into. If not specified,
         * the parent component's `itemRenderTarget` is used.
         */
        renderTarget: null,

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
            phase = 'init';

            apply (instance, value) {
                return value ? (Array.isArray(value) ? value : ['append', value]) : [];
            }
        }
    };

    static shardable = {
        render (a, b) {
            return merge(a, b);
        }
    };

    static sortItems (items) {
        items?.sort(orderSortFn);

        return items;
    }

    #composer = null;
    #dom = null;
    #recomposer = null;
    #renderToUsed = false;
    #renderWatcher = null;
    #watcherNotified = false;

    destruct () {
        this.#unrender();

        super.destruct();
    }

    get dom () {
        return this.#dom;
    }

    get el () {
        return this.#dom?.el;
    }

    getItems (docked) {
        let items = values(this.items || EMPTY_OBJECT);

        if (docked !== '*') {
            items = items.filter(
                (docked === true) ? i => i.docked : (docked ? i => i.docked === docked : i => !i.docked));
        }

        return Component.sortItems(items);
    }

    compose () {
        let spec = this.render(),
            items = this.getItems(),
            { itemRenderTarget } = this,
            it, refs, renderTarget, children;

        if (items) {
            itemRenderTarget ??= 'root';
            refs = gatherRefs({}, 'root', spec);

            for (it of items) {
                renderTarget = refs[it.renderTarget || itemRenderTarget];

                if (renderTarget) {
                    children = renderTarget.children ??= [];

                    if (!Array.isArray(children)) {
                        renderTarget.children = children = Dom.canonicalizeSpecs(children);
                    }

                    children.push(it.#dom);
                }
            }
        }

        return spec;
    }

    initialize() {
        super.initialize();

        if (!this.#dom) {
            this.recompose();
        }
    }

    render () {
        let me = this,
            { cls, docked, html, flex, layout, width, height, parent } = me,
            { aria, role, style, tag } = me.element,
            spec;

        aria ??= EMPTY_OBJECT;
        cls = cls ? clone(cls) : {};
        style = clone(style);

        if (docked) {
            cls[`x-docked-${docked}`] = 1;
        }

        if (flex != null) {
            (style ??= {}).flex = flex;
        }

        if (width != null) {
            (style ??= {}).width = width;
        }

        if (height != null) {
            (style ??= {}).height = height;
        }

        spec = {
            class: cls,
            tag, html, aria, role, style
        };

        layout.decorateElement('root', spec);
        parent?.layout?.decorateChild(this, spec);

        return spec;
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
            { id, dom } = me,
            [renderToUsed, mode, renderTo] = me.#getRenderPlan(),
            adopt = mode === 'adopt',
            composer = me.#composer ??= Signal.formula(() => me.compose(), { name: `composer@${id}` }),
            watcher = me.#renderWatcher,
            spec;

        full && composer.invalidate();

        spec = composer.get();

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

                // me.$meta.types.forEach(t => dom.el.classList.add(`x-${t}`));
                dom.el.classList.add(...(me.$meta.css ??= me.$meta.types.map(t => `x-${t}`)));
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

        // console.log(`invalidated ${this.id}`);
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
