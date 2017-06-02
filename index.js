require('undom/register');

const { document, Element, Node: { prototype: NodeProto } } = window;
const { insertBefore, removeChild } = NodeProto;
const isConnected = Symbol();

function connectNode (node) {
  if (node.connectedCallback && !node[isConnected]) {
    node.connectedCallback();
  }
  node[isConnected] = true;
}

function disconnectNode (node) {
  if (node.disconnectedCallback && node[isConnected]) {
    node.disconnectedCallback();
  }
  node[isConnected] = false;
}

function each (node, call) {
  if (node instanceof DocumentFragment) {
    Array.from(node.childNodes).forEach(call);
  } else {
    call(node);
  }
}

function patchCustomElements () {
  const customElementRegistry = {};
  global.HTMLElement = window.customElements = {
    define (name, func) {
      Object.defineProperty(func.prototype, 'nodeName', { value: name });
      customElementRegistry[name] = func;
    },
    get (name) {
      return customElementRegistry[name];
    }
  };

  const createElement = document.createElement.bind(document);
  document.createElement = function (name) {
    const Ctor = window.customElements.get(name);
    return Ctor ? new Ctor() : createElement(name);
  };
}

function patchDocumentFragment () {
  DocumentFragment = class extends Node {};
}

function patchElement () {
  global.HTMLElement = window.HTMLElement = class extends Element {
    attachShadow () {
      const shadowRoot = document.createElement('shadow-root');
      Object.defineProperty(this, 'shadowRoot', { value: shadowRoot });
      return shadowRoot;
    }
  }
}

function patchNode () {
  // Undom internally calls insertBefore in appendChild.
  NodeProto.insertBefore = function (newNode, refNode) {
    const ret = insertBefore.call(this, newNode, refNode);
    each(newNode, connectNode);
    return ret;
  };

  // Undom internally calls removeChild in replaceChild.
  NodeProto.removeChild = function (refNode) {
    const ret = removeChild.call(this, refNode);
    each(refNode, disconnectNode);
    return ret;
  };
}


// Serialisation

function stringify (node) {
  const { attributes = [], childNodes, nodeName, nodeValue, shadowRoot } = node;
  if (nodeName === '#text') {
    return nodeValue;
  }
  const attrsAsString = Array.from(attributes || []).map(({ name, value }) => ` ${name}="${value}"`);
  const localName = nodeName.toLowerCase();
  const shadowNodes = shadowRoot ? ssr(shadowRoot) : '';
  const lightNodes = childNodes.map(ssr).join('');
  const rehydrationScript = shadowRoot ? `<script>var a=document.currentScript.previousElementSibling,b=a.firstElementChild;a.removeChild(b);for(var c=a.attachShadow({mode:"open"});b.hasChildNodes();)c.appendChild(b.firstChild);</script>` : '';
  return `<${localName}${attrsAsString}>${shadowNodes}${lightNodes}</${localName}>${rehydrationScript}`;
}

function render (node, resolver) {
  connectNode(node);
  return new Promise(resolve => {
    if (resolver) {
      resolver(resolve);
    } else {
      // By default we wait until after microtasks complete in case frameworks
      // are using them to schedule rendering.
      setTimeout(() => resolve(stringify(node)));
    }
  });
}

patchCustomElements();
patchDocumentFragment();
patchElement();
patchNode();

module.exports.render = render;
