# Web component server-side rendering and testing

[![Build Status](https://travis-ci.org/skatejs/ssr.svg?branch=master)](https://travis-ci.org/skatejs/ssr)

This repo contains all you need to server-side render your web components and run their tests in a node environment.

- Uses [`undom`](https://github.com/developit/undom) for a minimal DOM API in Node.
- No polyfills necessary.
- No client code required.
- Great for rendering out static sites from components.
- Run your tests in Jest!

## Installing

```
npm install @skatejs/ssr
```

## Usage

*This example is using vanilla custom elements and shadow DOM in order to show that it can work with any web component library.*

On the server (`example.js`):

```js
require('@skatejs/ssr/register');
const render = require('@skatejs/ssr');

class Hello extends HTMLElement {
  connectedCallback () {
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = '<span>Hello, <x-yell><slot></slot></x-yell>!</span>';
  }
}
class Yell extends HTMLElement {
  connectedCallback () {
    Promise.resolve().then(() => {
      const shadowRoot = this.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = '<strong><slot></slot></strong>';
    });
  }
}
customElements.define('x-hello', Hello);
customElements.define('x-yell', Yell);

const hello = new Hello();
hello.textContent = 'World';

render(hello).then(console.log);
```

And then just `node` your server code:

```
$ node example.js
<script>function __ssr(){var a=document.currentScript.previousElementSibling,b=a.firstElementChild;a.removeChild(b);for(var c=a.attachShadow({mode:"open"});b.hasChildNodes();)c.appendChild(b.firstChild);}</script><x-hello><shadow-root><span>Hello, <x-yell><shadow-root><strong><slot></slot></strong></shadow-root><slot></slot></x-yell><script>__ssr()</script>!</span></shadow-root>World</x-hello><script>__ssr()</script>
```

On the client, just inline your server-rendered string:

```html
<script>function __ssr(){var a=document.currentScript.previousElementSibling,b=a.firstElementChild;a.removeChild(b);for(var c=a.attachShadow({mode:"open"});b.hasChildNodes();)c.appendChild(b.firstChild);}</script><x-hello><shadow-root><span>Hello, <x-yell><shadow-root><strong><slot></slot></strong></shadow-root><slot></slot></x-yell><script>__ssr()</script>!</span></shadow-root>World</x-hello><script>__ssr()</script>
```

[See it in action!](http://jsbin.com/cilocowozu/2/edit?html,output)

## Running in Node

If you want to run your code in Node, just require the registered environment before doing anything DOMish.

```js
// index.js
require('@skatejs/ssr/register');

// DOM stuff...
```

## Running in Jest

If you want to run your tests in Jest, all you have to do is configure Jest to use the environment we've provided for it.

```js
// package.json
{
  "jest": {
    "testEnvironment": "@skatejs/ssr/jest"
  }
}
```

## Running with other Node / DOM implementations

There's other implementations out there such as [Domino](https://github.com/fgnass/domino) and [JSDOM](https://github.com/tmpvar/jsdom). They don't yet have support for custom elements or shadow DOM, but if they did, then you would use this library in the same way, just without requiring `@skatejs/ssr/register`. With some implementations that don't yet support web components, requiring `@skatejs/ssr/register` may work, but your mileage may vary. Currently only Undom is officially supported.

## Why

- Lightweight rehydration of shadow content.
- Web crawlers can index both light and shadow DOM.
- Selectors work through shadow roots (possible Selenium integration), though they won't be the same on the server as on the client.

## Notes

There's some limitations and workarounds that you should consider. Many of these will be addressed in the future.

### Styling

While the page can be rendered without JavaScript, it won't be pretty because there is no style emulation being done on the server **if you choose to use native Shadow DOM styling**. If you want it to look the same with or without Shadow DOM, you can use most any CSS in JS lib.

### DOM API limitations

You're limited to the subset of DOM methods available through Undom, plus what we add on top of it (which is quite a bit at the moment). Undom works well with Preact and SkateJS due to their mininmal overhead and limited native DOM interface usage.

There's currently [some work](https://github.com/tmpvar/jsdom/pull/1872) happening to get custom element and shadow DOM support in JSDOM. Once that lands, we'll have broader API support and we can start thikning about focusing this API on just serialisation and rehydration.

### Misc

- Uses inline an `<script>` method for rehydration. This [seems](https://discourse.wicg.io/t/declarative-shadow-dom/1904/8) to be more performant and simplifies the usage for the consumer because there's no client code. This creates more weight to send to the client, but it doesn't make any assumptions on how the page is being rendered, other than you don't mess with its output. If a shared function were created, it would make an assumption on how and where you're using the rendered content, which at this point seems like we shouldn't have an opinion on.
- Inline `<script>` tags use relative DOM accessors like `document.currentScript`, `previousElementSibling` and `firstElementChild`. Any HTML post-processing could affect the mileage of it, so beware.
- Could use a `<shadow-root>` element, but that would mean:
  - Probable performance hit (see above).
  - Requires client to include a script (friction).
  - Pollutes the custom element namespace, or requires the consumer to manually register (more friction).
- Shadow root content, prior to being hydrated, is *not* inert so that it can be found by `querySelector` and crawlers. Putting it inside of a `<template>` tag means that it's not participating in the document and the aforementioned wouldn't work, thus negating the benefits of SSR altogether.
