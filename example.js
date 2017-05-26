const { render } = require('./index');
const { customElements, HTMLElement } = window;

class Hello extends HTMLElement {
  connectedCallback () {
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.appendChild(document.createTextNode('Hello, '));
    shadowRoot.appendChild(document.createElement('slot'));
    shadowRoot.appendChild(document.createTextNode('!'));
  }
}

customElements.define('x-hello', Hello);

const hello = new Hello();
hello.appendChild(document.createTextNode('World'));

render(hello).then(console.log);
