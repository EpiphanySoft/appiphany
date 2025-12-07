import { Config, merge, Widget } from '@appiphany/aptly';
import { Factoryable } from '@appiphany/aptly/mixin';
// import {  } from '@appiphany/webly';


export class LayoutConfig extends Config {
    value = 'auto';

    apply (instance, value) {
        if (typeof value === 'string') {
            value = { type: value };
        }

        return value;
    }
}

/**
 * A container component.
 */
export class Layout extends Widget.mixin(Factoryable) {
    static type = 'default';

    static factory = {
        defaultType: 'default'
    };

    static configurable = {
        classes: {
            root: {},
            body: {}
        }
    };

    decorateElement (ref, spec) {
        let classes = this.getClasses(ref);

        if (classes) {
            spec.class = merge(spec.class || {}, classes);
        }

        return spec;
    }

    getClasses (ref) {
        return this.classes?.[ref];
    }
}

Layout.initClass();

export class Box extends Layout {
    static type = 'box';

    static configurable = {
        horizontal: class {
            value = null;
            default = false;
        },

        classesH: {
            root: {},
            body: {}
        },

        classesV: {
            root: {},
            body: {}
        }
    };

    getClasses (ref) {
        let { extra } = this[`classes${this.horizontal ? 'H' : 'V'}`];

        extra = extra?.[ref] || {};

        return merge(super.getClasses(ref), extra);
    }
}

Box.initClass();

export class HBox extends Box {
    static type = 'hbox';

    static configurable = {
        horizontal: true
    };
}

HBox.initClass();

export class VBox extends Box {
    static type = 'vbox';
}

VBox.initClass();
