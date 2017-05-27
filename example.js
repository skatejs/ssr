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

class Index extends HTMLElement {
  connectedCallback () {
    const shadowRoot = this.attachShadow({ mode: 'open' });
    const hello = document.createElement('x-hello');
    const title = document.createElement('h1');
    const p = document.createElement('p');

    hello.appendChild(document.createTextNode(this.name));
    p.appendChild(hello);
    title.appendChild(document.createTextNode('Hello!'));

    shadowRoot.appendChild(title);
    shadowRoot.appendChild(hello);
  }
}

customElements.define('x-hello', Hello);
customElements.define('x-index', Index);

const index = new Index();
index.name = 'World';
render(index).then(console.log);
