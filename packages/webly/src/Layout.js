import { Config, applyMissing, merge, Widget } from '@appiphany/aptly';
import { Factoryable } from '@appiphany/aptly/mixin';
// import {  } from '@appiphany/webly';


/**
 * A container widget.
 */
export class Layout extends Widget.mixin(Factoryable) {
    static type = 'auto';

    static factory = {
        defaultType: 'auto'
    };

    static configurable = {
        /**
         * @config {Object}
         * The classes that apply to the owner's element tree.
         */
        classes: {
            // body: {},
            // root: {}
        },

        /**
         * @config {Object}
         * The classes that apply to the owner's children. The applicable classes for a child are
         * determined by the child's `docked` config as well as its `renderTarget`. If the child
         * uses the parent's `itemRenderTarget`, then the key used to identify the child's classes
         * in this object is 'default'.
         */
        childClasses: {
            // 'docked-top': {},
            // default: {}
        }
    };

    static identifierPrefix () {
        return `layout-${this.type}`;
    }

    addClasses (spec, classes) {
        classes && applyMissing(spec.class ??= {}, classes);
    }

    decorateChild (child, spec) {
        let me = this,
            { docked, renderTarget } = child,
            itemRenderTarget = me.parent?.itemRenderTarget,
            rt = (renderTarget && renderTarget !== itemRenderTarget) ? renderTarget : 'default',
            key = docked ? `docked-${docked}` : rt;

        me.addClasses(spec, me.childClasses[key]);

        return spec;
    }

    decorateElement (ref, spec) {
        (ref === 'root') && this.addClasses(spec, {
            [`x-layout-${this.type}`]: 1
        });

        this.addClasses(spec, this.classes[ref]);

        return spec;
    }
}

Layout.initClass();


//------------------------------------------------------------------------------------------------

export class Box extends Layout {
    static type = 'box';

    static configurable = {
        horizontal: class {
            value = null;
            default = false;
        },

        classes: {
            root: {
                'x-layout-box': 1
            }
        },

        classesH: {
            body: {
                'x-box-h': 1
            },
            root: {
                'x-layout-hbox': 1
            }
        },

        classesV: {
            body: {
                'x-box-v': 1
            },
            root: {
                'x-layout-vbox': 1
            }
        },

        childClasses: {
            default: {
                'x-box-item': 1
            }
        }
    };

    decorateElement (ref, spec) {
        this.addClasses(spec, this[`classes${this.horizontal ? 'H' : 'V'}`][ref]);

        return super.decorateElement(ref, spec);
    }
}

export class HBox extends Box {
    static type = 'hbox';

    static configurable = {
        horizontal: true
    };
}

export class VBox extends Box {
    static type = 'vbox';
}

Box.initClass();
HBox.initClass();
VBox.initClass();


//------------------------------------------------------------------------------------------------

export class LayoutConfig extends Config {
    value = 'auto';

    apply (instance, value, was) {
        if (typeof value === 'string') {
            value = { type: value };
        }

        return Layout.reconfigure(was, value, {
            defaults: {
                parent: instance
            }
        });
    }
}
