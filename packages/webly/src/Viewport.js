import { Container, Dom } from '@appiphany/webly';


export class Viewport extends Container {
    static type = 'viewport';

    static configurable = {
        nexus: 'viewport',

        layout: 'vbox',
        floatRoot: true,

        props: {
            theme: 'light',
            dark: p => p.theme === 'dark'
        },

        effects: {
            theme (props) {
                let { theme } = props,
                    { themes } = this,
                    classes = Object.fromEntries(themes.map(t => [`theme-${t}`, t === theme]));

                Dom.docRoot.setClasses(classes);
            }
        },

        stateful: {
            theme: true
        },

        themes: ['light', 'dark'],

        renderTo: ['adopt', globalThis.document?.body]
    };

    render () {
        let { layout } = this;

        return {
            class: {
                [`x-layout-${layout?.type}`]: !!layout
            },
            children: {
                floatRoot: {
                    '>': '^body',
                    data: {
                        float: 'root'
                    }
                }
            }
        };
    }

    toggleTheme () {
        let { props, themes } = this,
            { theme } = props;

        theme = (themes.indexOf(theme) + 1) % themes.length;

        props.theme = themes[theme];
    }
}

Viewport.initClass();
