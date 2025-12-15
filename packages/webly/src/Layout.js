import { Config, applyMissing, merge, Widget, isString } from '@appiphany/aptly';
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
        classes: null,
        //  = {
        //      body: {},
        //      default: {},
        //      root: {}
        //  },

        /**
         * @config {Object}
         * The classes that apply to the owner's children. The applicable classes for a child are
         * determined by the child's `docked` config as well as its `renderTarget`. If the child
         * uses the parent's `itemRenderTarget`, then the key used to identify the child's classes
         * in this object is 'default'.
         */
        childClasses: null
        //  = {
        //      'docked-top': {},
        //      default: {}
        //  }
    };

    static identifierPrefix () {
        return `layout-${this.type}`;
    }

    addClasses (spec, classes) {
        classes && applyMissing(spec.class ??= {}, classes);
    }

    decorateChild (child, spec) {
        let key = child.childDomain;

        this.decorateChildWith(child, spec, key, this.childClasses?.[key]);

        return spec;
    }

    decorateChildWith (child, spec, key, classes) {
        this.addClasses(spec, classes);
    }

    decorateElement (ref, spec) {
        let me = this;

        if (ref === me.parent?.itemRenderTarget) {
            ref = 'default';
        }

        (ref === 'root' || ref === 'default') && me.addClasses(spec, {
            [`x-layout-${me.type}`]: 1
        });

        me.addClasses(spec, me.classes?.[ref]);

        return spec;
    }
}

Layout.initClass();


//------------------------------------------------------------------------------------------------
// Box, HBox, VBox

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
            default: {
                'x-box-h': 1
            },
            root: {
                'x-layout-hbox': 1
            }
        },

        classesV: {
            default: {
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

export class Deck extends Layout {
    static type = 'deck';

    static configurable = {
        classes: {
            default: {
                'x-deck-item-container': 1
            }
        },

        childClasses: {
            default: {
                'x-deck-item': 1
            }
        },

        activeClasses: {
            0: {
                'x-deck-item-active': 1
            },
            1: {
                'x-deck-item-after-active': 1
            },
            '-1': {
                'x-deck-item-before-active': 1
            }
        }
    };

    decorateChildWith (child, spec, key, classes) {
        super.decorateChildWith(child, spec, key, classes);

        if (key === 'default') {
            let me = this,
                { index } = child,
                { parent } = me,
                activeIndex = parent?.activeIndex;

            if (index != null && activeIndex != null) {
                // console.log(`${child.id}.index = ${index} / activeIndex = ${activeIndex} (was ${parent.activeIndexWas})`);

                me.addClasses(spec, me.activeClasses?.[Math.sign(index - activeIndex)]);
                me.addClasses(spec, { 'x-deck-item-was-active': index === parent.activeIndexWas });
            }
        }

        return spec;
    }
}

Deck.initClass();


//------------------------------------------------------------------------------------------------

export class LayoutConfig extends Config {
    apply (instance, value, was) {
        if (isString(value)) {
            value = { type: value };
        }

        return Layout.reconfigure(was, value, {
            defaults: {
                parent: instance
            }
        });
    }
}
