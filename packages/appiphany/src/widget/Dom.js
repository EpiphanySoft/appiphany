
export class Dom {
    // static key = Symbol('dom');
    static key = '$dom';

    static get (el) {
        return el[Dom.key] ??= new Dom(el);
    }

    constructor (el) {
        this.el = el;
    }

    /**
     * A DOM spec is an object with the following properties:
     *
     *  {
     *      html: '',
     *      text: '',
     *
     *      specs: []
     *
     *      // other
     *      href: '',
     *  }
     */
    update (spec) {
        //
    }
}
