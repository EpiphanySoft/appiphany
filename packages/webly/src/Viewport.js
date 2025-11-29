import { Component } from '@appiphany/webly';


export class Viewport extends Component {
    static type = 'viewport';

    static configurable = {
        nexus: 'viewport',

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

        stateProvider: {
            type: 'storage',
            storage: localStorage
        },

        themes: [
            'light',
            'dark'
        ],

        renderTo: ['adopt', document.body]
    };

    toggleTheme () {
        let { props, themes } = this,
            { theme } = props;

        theme = (themes.indexOf(theme) + 1) % themes.length;

        props.theme = themes[theme];
    }
}

Viewport.initClass();
