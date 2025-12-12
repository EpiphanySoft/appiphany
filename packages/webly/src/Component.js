import { chain, panik, Widget, Signal, isObject, clone, merge, values, Config,
         EMPTY_ARRAY, EMPTY_OBJECT }
    from '@appiphany/aptly';
import { Factoryable } from '@appiphany/aptly/mixin';
import { Dom, LayoutConfig } from '@appiphany/webly';


const
    INNER_ITEMS = {
        inner: true
    },
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
    phase = 'init';

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

    static proto = {
        _renderCount: 0
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

        // Parent-affecting

        docked: null,
        ref: null,
        tab: null,
        zone: null,

        order: class {
            default = 0;
        },

        /**
         * The default `renderTarget` for items that do not specify their own `renderTarget`.
         */
        itemRenderTarget: null,

        // General

        floating: null,
        floatRoot: null,

        /**
         * Set by the parent to a number (0, 1, 2, ...) indicating the index of this component
         * with respect to its siblings.
         */
        index: null,

        layout: class extends LayoutConfig {},

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

    static hierarchicalType = `component`;

    static shardable = {
        render (a, b) {
            return merge(a, b);
        }
    };

    static itemFilter (kind) {
        return kind || INNER_ITEMS;
    }

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

    get childDomain () {
        let me = this,
            { docked, floating } = me,
            ret = 'default',
            rt;

        if (docked) {
            ret = `docked-${docked}`;
        }
        else if (floating) {
            ret = 'float';
        }
        else if ((rt = me.renderTarget) && rt !== me.parent?.itemRenderTarget) {
            ret = rt;
        }

        return ret;
    }

    get dom () {
        let me = this,
            dom = me.#dom,
            element, mode, renderTo;

        if (!dom && !me.destroyed) {
            ({ element, renderTo } = me);

            if (renderTo) {
                [mode, renderTo] = renderTo;
            }

            dom = new Dom(mode === 'adopt' ? renderTo : null, me);
            dom.sync(element);

            me.#dom = dom;
        }

        return dom;
    }

    get el () {
        return this.dom?.el;
    }

    getItems (kind) {
        let items = values(this.items || EMPTY_OBJECT),
            f = Component.itemFilter(kind);

        if (items.length) {
            items = items.filter(i =>
                i.docked ? (f.docked === true || f.docked === i.docked)
                         : i.floating ? f.floating : f.inner);
        }

        return Component.sortItems(items);
    }

    compose () {
        let me = this,
            first = !me._renderCount++,
            spec = me.render(first),
            it, itemRenderTarget, items, ref, refs, renderTarget, children;

        if (!first && (items = me.getItems()).length) {
            itemRenderTarget = me.itemRenderTarget || 'root';
            refs = gatherRefs({}, 'root', spec);

            for (it of items) {
                ref = it.renderTarget || itemRenderTarget;
                renderTarget = refs[ref];

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
        this.recompose();

        super.initialize();
    }

    render () {
        let me = this,
            { cls, docked, html, flex, floatRoot, id, layout, width, height, parent } = me,
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
            id,
            class: cls,
            tag, html, aria, role, style
        };

        if (floatRoot) {
            spec.children = {
                floatRoot: {
                    class: {
                        'x-floaters': true
                    }
                }
            };
        }

        layout?.decorateElement('root', spec);
        parent?.layout?.decorateChild(this, spec);

        return spec;
    }

    #getRenderPlan () {
        let me = this,
            { floating, renderTo } = me,
            renderToUsed = me.#renderToUsed,
            mode;

        if (me.destroyed) {
            renderTo = null;
        }
        else {
            if (floating) {
                debugger;
            }

            if (renderTo) {
                me.#renderToUsed = renderToUsed = true;
                [mode, renderTo] = renderTo;
            }
            else if (renderToUsed) {
                renderTo = Dom.limbo;
            }
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

        console.log(`recompose ${this.id}`);

        if (dom.adopted !== adopt) {
            panik('Cannot change between adopted and rendered element');
        }
        else if (adopt && dom.el !== renderTo) {
            panik('Cannot change adopted element');
        }

        full && composer.invalidate();

        spec = composer.get();

        if (!spec) {
            me.#unrender();
        }
        else {
            if (!adopt && renderToUsed) {
                spec[MODE_MAP[mode]] = renderTo;
            }

            dom.sync(spec);

            if (!watcher) {
                me.#renderWatcher = watcher = Signal.watch(() => {
                    me.#watcherNotified = true;
                    me.recomposeSoon();
                });

                watcher.watch(composer);

                // me.$meta.types.forEach(t => dom.el.classList.add(`x-${t}`));
                dom.el.classList.add(...(me.$meta.css ??= me.$meta.types.map(t => `x-${t}`)));

                console.log(`needs recompose ${this.id}`);
                composer.invalidate();
            }
        }
    }

    #recomposeNow () {
        let me = this;

        me.recompose();

        if (me.#watcherNotified) {
            me.#watcherNotified = false;
            me.#renderWatcher?.watch();
        }
    }

    recomposeSoon () {
        // console.log(`invalidated ${this.id}`);
        this.scheduler.add(this.#recomposer ??= () => this.#recomposeNow());
    }

    #unrender () {
        let me = this,
            watcher = me.#renderWatcher;

        if (watcher) {
            watcher.unwatch(me.#composer);
            me.#renderWatcher = me.#composer = null;
        }

        me.#dom?.destroy();
        me.#dom = null;
    }
}

Component.initClass();
