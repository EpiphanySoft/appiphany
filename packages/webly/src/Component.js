import {
    chain, panik, Widget, Signal, isObject, clone, merge, values, Config,
    EMPTY_ARRAY, EMPTY_OBJECT, remove, isString
}
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
    findFloatRoot = p => p.floatRoot,
    ignoredComposeConfigs = { props: 1, renderTarget: 1 },
    orderSortFn = (a, b) => a.order - b.order,
    fontAwesomeRe = /\bfa-/,
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

export const
    iconCls = icon => {
        icon = Config.Flags.canonicalize(icon);

        return {
            fas: Object.entries(icon).some(([c, v]) => v && fontAwesomeRe.test(c)),
            ...icon
        }
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
                existingByRef[ref][1].destroy();
                same = false;
            }
        }

        return same ? was : items;
    }

    getItemDefaults (instance) {
        return {
            parent: instance,
            type: instance.defaultType
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
        style: null,

        centered: null,
        bottom: null,
        left: null,
        right: null,
        top: null,

        element: {
            tag: 'div'
            // aria: {}
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

        defaultType: 'component',

        // General

        floaters: null,
        floatRoot: null,
        modal: null,

        floating: class {
            update (instance, floating) {
                instance.floatParent = floating ? instance.up(findFloatRoot) : null;
            }
        },

        floatParent: class {
            nullify = true;

            update (instance, floatParent, was) {
                was?.removeFloater(instance);
                floatParent?.addFloater(instance);
            }
        },

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
            element, mode, renderTo, style;

        if (!dom && !me.destroyed) {
            ({ element, renderTo, style } = me);

            element = clone(element);
            element.style = clone(style);

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

    initialize() {
        this.recompose();

        super.initialize();
    }

    destruct () {
        let me = this,
            { parent } = me;

        me.#unrender();

        parent?.remove(me);

        super.destruct();
    }

    add (item) {
        let me = this,
            items = clone(me.items) || {},
            { ref } = item;

        if (!ref) {
            panik('Item must have a ref property');
        }

        items[ref] = item;

        me.items = items;

        return me.items[ref];
    }

    remove (item) {
        let me = this,
            items = !me.destroyed && me.items,
            ref,
            it = items?.[ref = isString(item) ? item : item.ref];

        if (it && (ref === item || it === item)) {
            items = clone(items);
            delete items[ref];
            me.items = items;
        }
    }

    addFloater (child) {
        let { floaters } = this;

        if (!floaters?.includes(child)) {
            this.floaters = floaters?.concat(child) || [child];
        }
    }

    bringToFront () {
        let me = this,
            { floatParent } = me,
            floaters = floatParent?.floaters;

        if (floaters?.includes(me) && floaters.at(-1) !== me) {
            floaters = floaters.slice();
            remove(floaters, me);
            floaters.push(me);

            floatParent.floaters = floaters;
        }
    }

    removeFloater (child) {
        let { floaters } = this,
            newVal = floaters?.filter(c => c !== child);

        if (floaters && newVal.length !== floaters.length) {
            this.floaters = newVal;
        }
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

    render () {
        let me = this,
            { cls, centered, docked, html, flex, floatRoot, id, layout, width, height, parent,
              bottom, left, right, style, top } = me,
            spec = clone(me.element),
            children, posH, posV;

        cls = cls ? clone(cls) : {};
        style = clone(style);

        if (top != null) {
            posV = true;
            (style ??= {}).top = top;
        }

        if (bottom != null) {
            posV = true;
            (style ??= {}).bottom = bottom;
        }

        if (left != null) {
            posH = true;
            (style ??= {}).left = left;
        }

        if (right != null) {
            posH = true;
            (style ??= {}).right = right;
        }

        cls['x-centered'] = centered;
        cls['x-pos'] = posH || posV;
        cls['x-pos-h'] = posH;
        cls['x-pos-v'] = posV;

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

        if (floatRoot) {
            (children ??= {}).floatRoot = me.renderFloaters();
        }

        spec.id = id;
        spec.class = cls;
        style && (spec.style = style);
        children && (spec.children = children);

        if (html) {
            html = me.renderHtml(html, 'root');
            html && merge(spec, html);
        }

        layout?.decorateElement('root', spec);
        parent?.layout?.decorateChild(this, spec);

        return spec;
    }

    renderHtml (html) {
        return {
            children: {
                html: {
                    html,
                    class: {
                        content: true, // bulma
                        'x-html': true
                    }
                }
            }
        };
    }

    renderFloaters () {
        let children = this.floaters?.map(c => c.dom),
            i = children?.length,
            c;

        while (i) {
            c = children.at(--i);

            if (c.owner.modal) {
                children.splice(i, 0, {
                    ref: '_mask',
                    class: {
                        'x-mask': true
                    }
                });

                break;
            }
        }

        return {
            class: {
                'x-floaters': true
            },
            children
        };
    }

    #getRenderPlan () {
        let me = this,
            // { floating, renderTo } = me,
            { renderTo } = me,
            renderToUsed = me.#renderToUsed,
            // floatParent,
            mode;

        if (me.destroyed) {
            renderTo = null;
        }
        else {
            // if (floating || renderTo) {
            if (renderTo) {
                me.#renderToUsed = renderToUsed = true;

                // if (floating) {
                //     me.floatParent = floatParent = me.up(findFloatRoot);
                //     renderTo = floatParent.dom.refs.floatRoot;
                // }
                // else {
                    [mode, renderTo] = renderTo;
                // }
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

        // console.log(`recompose ${this.id}`);

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

                if (me.peekConfig('items')) {
                    // console.log(`needs recompose ${this.id}`);
                    composer.invalidate();
                }
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
