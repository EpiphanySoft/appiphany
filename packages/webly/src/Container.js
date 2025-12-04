import { Component } from '@appiphany/webly';
import { values } from '@appiphany/aptly';

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

export class Container extends Component {
    static type = 'container';

    static configurable = {
        itemRenderTarget: 'body'
    };

    render () {
        let body = this.renderBody(),
            items = this.getItems(true);

        if (items.length) {
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

            items.reverse();

            for (item of items) {
                ref = item.ref;
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
                    bwrap.splice(bodyIndex++, 0, [ref, item.dom]);
                }
                else {
                    bwrap.push([ref, item.dom]);
                }
            }

            body = toObject(flow ? wrap(bwrap) : bwrap);
        }

        return {
            children: body
        };
    }

    renderBody () {
        let { id } = this;

        return {
            id: `${id}-body`,
            class: {
                'x-body': 1
            }
        };
    }
}

Container.initClass();
