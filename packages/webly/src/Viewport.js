import { Component, LayoutConfig } from '@appiphany/webly';


export class Viewport extends Component {
    static type = 'viewport';

    static configurable = {
        nexus: 'viewport',

        layout: 'vbox',

        props: {
            theme: 'light'
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

        renderTo: ['adopt', document.body]
    };

    render () {
        let { layout } = this;

        return {
            class: {
                [`x-layout-${layout?.type}`]: !!layout
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
