# Server-side rendering web components

This is currently a WIP of how one would server-side render web components.

## Why

- Lightweight rehydration of shadow content.
- Web crawlers can index both light and shadow DOM.
- Selectors work through shadow roots (possible Selenium integration), though they won't be the same on the server as on the client.

## Caveats

- While the page can be rendered without JavaScript, it won't be pretty because there is no style emulation being done on the server.

## Controversial opinion

Require JavaScript for your users and use this for things that don't care how it looks.

## How

*For all you haters, this example is using vanilla custom elements and shadow DOM in order to show that it can work with any web component library.*

On the server (`example.js`):

```js
const { render } = require('./ssr-server');
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
```

And then just `node` your server code:

```
$ node example.js
<x-hello>World<shadow-root>Hello, <slot></slot>!</shadow-root></x-hello>
```

On the client:

```js
<script src="./ssr-client.js"></script>
<x-hello>World<shadow-root>Hello, <slot></slot>!</shadow-root></x-hello>
```

[See it in action!](https://www.webpackbin.com/bins/-Kl27vKrFK82_BDrv6h4)
