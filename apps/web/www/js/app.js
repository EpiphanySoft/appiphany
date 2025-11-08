import { Dom, Widget } from '@appiphany/appiphany/widget';

debugger;

window.Dom = Dom;
window.Widget = Widget;


window.w = new Widget({
    renderTo: document.body
});

window.w.initialize();
