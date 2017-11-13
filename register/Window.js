const { customElements } = require('./CustomElements');
const { Element } = require('./Element');
const { Event } = require('./Event');
const { History } = require('./History');
const { Location } = require('./Location');
const { HTMLElement } = require('./HTMLElement');
const { MutationObserver, MutationRecord } = require('./MutationObserver');
const { Navigator } = require('./Navigator');
const { NodeFilter } = require('./NodeFilter');
const { CSSStyleSheet, StyleSheet } = require('./StyleSheet');
const { Worker } = require('./Worker');
const { expose } = require('./util');

// Copy over window props to the global before making the same.
Object.getOwnPropertyNames(window).forEach(name => {
  global[name] = window[name];
});

// Ensure mutations that happen to window also happen to global and vice versa.
window = global;

expose('dispatchEvent', Element.prototype.dispatchEvent.bind(window));
expose('Event', Event);
expose('CustomEvent', Event);
expose('MouseEvent', Event);
expose('CSSStyleSheet', StyleSheet);
expose('customElements', customElements);
expose('HTMLElement', HTMLElement);
expose('MutationObserver', MutationObserver);
expose('MutationRecord', MutationRecord);
expose('NodeFilter', NodeFilter);
expose('StyleSheet', StyleSheet);
expose('Worker', Worker);

expose('__handlers', {});
expose('addEventListener', Element.prototype.addEventListener.bind(window));
expose(
  'removeEventListener',
  Element.prototype.removeEventListener.bind(window)
);

expose('scrollTo', function() {});
expose('navigator', new Navigator());
expose('location', new Location());
expose('history', new History());
