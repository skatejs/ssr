require('undom/register');
const { parseFragment } = require('parse5');

const ElementProto = Element.prototype;
const NodeProto = Node.prototype;
const { insertBefore, removeChild } = NodeProto;
const { dispatchEvent } = ElementProto;
const { keys, defineProperty: prop } = Object;
const isConnected = Symbol();

function expose (name, value) {
  return global[name] = window[name] = value;
}

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
  return node;
}

function translateParsed (parsed) {
  let node;
  const { attrs, childNodes, nodeName, value } = parsed;

  if (nodeName === '#document-fragment') {
    node = document.createDocumentFragment();
  } else if (nodeName === '#text') {
    node = document.createTextNode(value);
  } else {
    node = document.createElement(nodeName);
    attrs.forEach(({ name, value }) => node.setAttribute(name, value));
  }

  if (childNodes) {
    childNodes.forEach(c => node.appendChild(translateParsed(c)));
  }

  return node;
}

function patchCustomElements () {
  const customElementRegistry = {};
  expose('customElements', {
    define (name, func) {
      prop(func.prototype, 'nodeName', { value: name.toUpperCase() });
      customElementRegistry[name] = func;
    },
    get (name) {
      return customElementRegistry[name];
    }
  });

  const createElement = document.createElement.bind(document);
  document.createElement = function (name) {
    const Ctor = window.customElements.get(name);
    return Ctor ? new Ctor() : createElement(name);
  };
}

function patchDocumentFragment () {
  expose('DocumentFragment', class extends Node {
    get nodeName () {
      return '#document-fragment';
    }
  });
  document.createDocumentFragment = () => new DocumentFragment();
}

function patchElement () {
  ElementProto.dispatchEvent = function (evnt) {
    evnt.target = this;
    return dispatchEvent.call(this, evnt);
  }
  ElementProto.hasAttribute = function (name) {
    return !!this.getAttribute(name);
  };
  prop(ElementProto, 'innerHTML', {
    get () {
      return this.childNodes.map(c => c.outerHTML || c.textContent).join('');
    },
    set (val) {
      while (this.hasChildNodes()) {
        this.removeChild(this.firstChild);
      }
      this.appendChild(translateParsed(parseFragment(val)));
    }
  });
  prop(ElementProto, 'outerHTML', {
    get () {
      const { attributes, children, nodeName } = this;
      const name = nodeName.toLowerCase();
      return `<${name}${attributes.reduce((prev, { name, value }) => prev + ` ${name}="${value}"`, '')}>${this.innerHTML}</${name}>`;
    },
    set (val) {
      throw new Error('Not implemented: set outerHTML');
    }
  });
}

function patchEvents () {
  expose('CustomEvent', expose('Event', class extends Event {
    constructor (evnt, opts = {}) {
      super(evnt, opts);
    }
  }));
}

function patchHTMLElement () {
  expose('HTMLElement', class extends Element {
    attachShadow () {
      const shadowRoot = document.createElement('shadow-root');
      prop(this, 'shadowRoot', { value: shadowRoot });
      return shadowRoot;
    }
  });
}

function patchNode () {
  Node.DOCUMENT_FRAGMENT_NODE = 11;
  Node.ELEMENT_NODE = 1;
  Node.TEXT_NODE = 3;

  prop(NodeProto, 'textContent', {
    get () {
      return this.nodeValue || this.childNodes.map(c => c.textContent).join('');
    },
    set (val) {
      this.nodeValue = val;
    }
  });

  NodeProto.contains = function (node) {
    if (this === node) {
      return true;
    }
    for (let childNode of this.childNodes) {
      if (childNode.contains(node)) {
        return true;
      }
    }
    return false;
  };

  NodeProto.hasChildNodes = function () {
    return this.childNodes.length;
  }

  // Undom internally calls insertBefore in appendChild.
  NodeProto.insertBefore = function (newNode, refNode) {
    return each(newNode, newNode => {
      insertBefore.call(this, newNode, refNode);
      connectNode(newNode);
    });
  };

  // Undom internally calls removeChild in replaceChild.
  NodeProto.removeChild = function (refNode) {
    return each(refNode, refNode => {
      removeChild.call(this, refNode);
      disconnectNode(refNode);
    });
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
patchEvents();
patchHTMLElement();
patchNode();

module.exports.render = render;
