import { decapitalize } from '@appiphany/aptly';


export const Identifiable = Base => class Identifiable extends Base {
    static idSep = '-';

    static configurable = {
        id: class {
            value = undefined;
            priority = -1000;

            apply (me, v) {
                let auto = me.autoGenId = v == null,
                    cls, prefix;

                if (auto) {
                    prefix = (cls = me.$meta.class).generateAutoIdPrefix();
                    v = `${prefix}${cls.generateAutoId(prefix)}`;
                }

                return v;
            }
        }
    };

    static generateAutoIdPrefix () {
        let prefix = this.identifierPrefix();

        return prefix ? prefix + this.idSep : '';
    }

    static generateAutoId (/* prefix */) {
        let { $meta: meta } = this;

        return meta.nextId = (meta.nextId || 0) + 1;
    }

    static identifierPrefix () {
        return decapitalize(this.className);
    }
}
