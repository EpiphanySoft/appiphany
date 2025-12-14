import { EMPTY_ARRAY, merge } from '@appiphany/aptly';
import { Component } from '@appiphany/webly';

const
    DOCKS = {
        h: 'left',
        v: 'top'
    },
    FLOWS = {
        left: 'h',
        right: 'h',
        top: 'v',
        bottom: 'v'
    },
    toObject = a => Object.fromEntries(a);


/**
 * A container component.
 */
export class Container extends Component {
    static type = 'container';

    static configurable = {
        activeIndex: class {
            apply (instance, value, was) {
                if (value !== was) {
                    let items = instance.getItems(),
                        it = items[value];

                    instance.$config.activeIndex = value;
                    instance.activeItem = it;
                    instance.activeIndexWas = was;
                }
            }
        },

        activeItem: class {
            apply (instance, value) {
                let items = instance.getItems(),
                    index = 0,
                    it;

                for (it of items) {
                    if (it === value || it.ref === value) {
                        instance.$config.activeItem = it;
                        instance.activeIndex = index;

                        break;
                    }

                    ++index;
                }
            }
        },

        itemRenderTarget: 'body',

        items: class {
            update (instance, value, was) {
                if (!was && !instance.activeItem) {
                    instance.activeIndex = 0;
                }
            }
        },

        layout: {
            type: 'auto'
        }
    };

    static shardable = {
        renderBody (a, b) {
            return merge(a, b);
        }
    };

    render (first) {
        let me = this,
            body = me.renderBody(first),
            cls = {},
            items;

        if (first || !(items = me.getItems({ docked: true })).length) {
            cls['x-box-v'] = 1;
            body = { body };
        }
        else {
            items.reverse();
            body = me.renderDocked(body, items);
        }

        return {
            class: cls,
            children: body
        };
    }

    renderBody () {
        let { id, html, layout } = this,
            body = {
                id: `${id}-body`,
                class: {
                    'x-body': 1,
                    'x-box-body': 1
                }
            };

        if (html) {
            html = this.renderHtml(html, 'body');
            html && merge(body, html);
        }

        return layout.decorateElement('body', body);
    }

    renderDocked (body, items) {
        let docked, item, ref, f, flow, // = 'h', 'v'
            bodyIndex = 0,
            counter = 0,
            bwrap = [
                ['body', body]
            ],
            mark = b => {
                b[bodyIndex][1].class['x-box-body'] = 1;
                return b;
            },
            wrap = b => [
                [`bodyWrap${++counter}`, {
                    class: {
                        'x-body-wrap': 1,
                        [`x-box-${flow}`]: 1
                    },
                    children: toObject(mark(b))
                }]
            ];

        for (item of items) {
            ref = item.ref || item.id;
            docked = item.docked;
            f = FLOWS[docked];

            if (!flow) {
                flow = f;
            }
            else if (flow !== f) {
                bwrap = wrap(bwrap);
                flow = f;
                bodyIndex = 0;
            }

            if (docked === DOCKS[flow]) {
                bwrap.unshift([ref, item.dom]);
                ++bodyIndex;
            }
            else {
                bwrap.push([ref, item.dom]);
            }
        }

        return toObject(flow ? wrap(bwrap) : bwrap);
    }

    renderHtml (html, ref) {
        return (ref === 'body') && super.renderHtml(html, ref);
    }
}

Container.initClass();
