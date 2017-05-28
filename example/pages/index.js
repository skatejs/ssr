/** @jsx h */

const { Component, define, h } = require('skatejs');
const { HTMLElement } = window;

const Yell = define(class extends HTMLElement {
  static is = 'x-yell'
  connectedCallback () {
    const slot = document.createElement('slot');
    const strong = document.createElement('strong');

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(strong);
    strong.appendChild(slot);
  }
});

const Hello = define(class extends Component {
  static is = 'x-hello'
  renderCallback () {
    return (
      <span>Hello, <x-yell><slot /></x-yell>!</span>
    );
  }
});

module.exports = define(class extends Component {
  static is = 'x-index'
  renderCallback () {
    return (
      <div>
        <h1>SkateJS</h1>
        <p><x-hello>World</x-hello></p>
      </div>
    );
  }
});
