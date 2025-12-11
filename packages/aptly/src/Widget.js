import { chain, Configurable } from '@appiphany/aptly';
import { Bindable, Eventable, Stateful, Identifiable } from '@appiphany/aptly/mixin';

/**
 * A widget is a non-visual object that can participate in the props and object hierarchy.
 */
export class Widget extends Configurable.mixin(Bindable, Eventable, Stateful, Identifiable) {
    static className = 'Widget';

    // wrap configs in Signals so that we can react to their changes:
    static signalize = true;

    static hierarchicalType = `widget`;

    static #idMap = chain();

    static generateAutoId (prefix) {
        let map = Widget.#idMap;

        return map[prefix] = (map[prefix] || 0) + 1;
    }

    static identifierPrefix () {
        return this.type || super.identifierPrefix();
    }
}

Widget.initClass();
