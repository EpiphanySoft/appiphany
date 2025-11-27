import { Configurable } from '@appiphany/aptly';
import { Bindable, Eventable, Stateful, Identifiable } from '@appiphany/aptly/mixin';

/**
 * A widget is a non-visual object that can participate in the props and object hierarchy.
 */
export class Widget extends Configurable.mixin(Bindable, Eventable, Stateful, Identifiable) {
    //
}

Widget.initClass();
