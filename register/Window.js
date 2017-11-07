const { customElements } = require('./CustomElements');
const { Element } = require('./Element');
const { Event } = require('./Event');
const { History } = require('./History');
const { HTMLElement } = require('./HTMLElement');
const { MutationObserver, MutationRecord } = require('./MutationObserver');
const { NodeFilter } = require('./NodeFilter');
const { expose } = require('./util');

// Events
expose('__handlers', {});
expose('addEventListener', Element.prototype.addEventListener.bind(window));
expose(
  'removeEventListener',
  Element.prototype.removeEventListener.bind(window)
);
expose('dispatchEvent', Element.prototype.dispatchEvent.bind(window));
expose('Event', Event);
expose('CustomEvent', Event);
expose('MouseEvent', Event);

// History
expose('history', new History());

// Location
expose('location', {
  hash: '',
  href: 'about:blank',
  protocol: 'node'
});

// Navigator
expose('navigator', {
  userAgent: 'Node'
});

// MutationObserver
expose('MutationObserver', MutationObserver);
expose('MutationRecord', MutationRecord);

// Node / Element / HTMLElement
expose('NodeFilter', NodeFilter);
expose('HTMLElement', HTMLElement);

// CustomElements
expose('customElements', customElements);
