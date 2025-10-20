export const Identifiable = Base => class Identifiable extends Base {
    static configurable = {
        id: class {
            value = undefined;

            apply(me, v) {
                let meta = me.$meta,
                    auto = me.autoGenId = v == null;

                if (auto) {
                    v = meta.class.formatAutoId(meta.nextId = (meta.nextId || 0) + 1);
                }

                return v;
            }
        }
    };

    static formatAutoId(nextId) {
        return `${this.idPrefix(this.className)}${this.idSep}${nextId}`;
    }

    static idPrefix = v => v;
    static idSep = '-';
}
