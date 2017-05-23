// Client side: https://www.webpackbin.com/bins/-KkN6aEwSXCrHR6oRAcV

require('undom/register');

// Undom has Element, but not HTMLElement.
window.HTMLElement = Element;

// Skate uses window if defined, otherwise global, however Object doesn't exist
// on window after Undom patches it.
window.Object = global.Object;

const { h } = require('skatejs');
const { render, withShadowProps } = require('./sd');

const List = class extends withShadowProps() {
  get nodeName () {
    return 'x-list';
  }
  renderCallback ({ children }) {
    return h('ul', {},
      ...children.map(c => h('li', {}, c.textContent))
    );
  }
};

const list = new List();
const div1 = document.createElement('div');
const div2 = document.createElement('div');
const div3 = document.createElement('div');

div1.textContent = 'div 1';
div2.textContent = 'div 2';
div3.textContent = 'div 3';

list.appendChild(div1);
list.appendChild(div2);
list.appendChild(div3);

console.log(list.outerHTML);
render(list).then(console.log);
