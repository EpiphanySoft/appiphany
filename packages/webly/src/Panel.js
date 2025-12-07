import { Container } from '@appiphany/webly';


/**
 * A panel component.
 */
export class Panel extends Container {
    static type = 'panel';

    static configurable = {
    };

    render () {
        return {
            class: {
                [`x-box-v`]: 1, // TODO 'x-box-h' if title bar on left/right
            }
        };
    }
}

Panel.initClass();
