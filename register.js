require("undom/register");
const { parseFragment } = require("parse5");

const ElementProto = Element.prototype;
const NodeProto = Node.prototype;
const { insertBefore, removeChild } = NodeProto;
const { dispatchEvent } = ElementProto;
const { defineProperty: prop } = Object;
const isConnected = Symbol("isConnected");

function expose(name, value) {
  global[name] = window[name] = value;
  return value;
}

function connectNode(node) {
  if (node.connectedCallback && !node[isConnected]) {
    node.connectedCallback();
  }
  node[isConnected] = true;
}

function disconnectNode(node) {
  if (node.disconnectedCallback && node[isConnected]) {
    node.disconnectedCallback();
  }
  node[isConnected] = false;
}

function each(node, call) {
  if (node instanceof DocumentFragment) {
    Array.from(node.childNodes).forEach(call);
  } else {
    call(node);
  }
  return node;
}

function translateParsed(parsed) {
  let node;
  const { attrs, childNodes, nodeName, value } = parsed;

  if (nodeName === "#document-fragment") {
    node = document.createDocumentFragment();
  } else if (nodeName === "#text") {
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

function patchCustomElements() {
  const customElementRegistry = {};
  expose("customElements", {
    define(name, func) {
      prop(func.prototype, "nodeName", { value: name.toUpperCase() });
      customElementRegistry[name] = func;
    },
    get(name) {
      return customElementRegistry[name];
    }
  });

  const createElement = document.createElement.bind(document);
  document.createElement = function(name) {
    const Ctor = window.customElements.get(name);
    const elem = Ctor ? new Ctor() : createElement(name);
    prop(elem, "localName", { value: name });
    return elem;
  };
}

function patchDocumentFragment() {
  expose(
    "DocumentFragment",
    class extends Node {
      get nodeName() {
        return "#document-fragment";
      }
    }
  );
  document.createDocumentFragment = () => new DocumentFragment();
}

function patchElement() {
  const { getAttribute, removeAttribute, setAttribute } = ElementProto;
  ElementProto.dispatchEvent = function(evnt) {
    evnt.target = this;
    return dispatchEvent.call(this, evnt);
  };
  ElementProto.getAttribute = function(name) {
    const value = getAttribute.call(this, name);
    return value == null ? null : value;
  };
  ElementProto.hasAttribute = function(name) {
    return this.getAttribute(name) !== null;
  };
  ElementProto.removeAttribute = function(name) {
    const oldValue = this.getAttribute(name);
    removeAttribute.call(this, name);
    if (this.attributeChangedCallback) {
      this.attributeChangedCallback(name, oldValue, null);
    }
  };
  ElementProto.setAttribute = function(name, newValue) {
    const oldValue = this.getAttribute(name);
    setAttribute.call(this, name, newValue);
    if (this.attributeChangedCallback) {
      this.attributeChangedCallback(name, oldValue, newValue);
    }
  };
  ElementProto.assignedNodes = function() {
    if (this.nodeName !== "SLOT") {
      throw new Error(
        "Non-standard: assignedNodes() called on non-slot element."
      );
    }

    const name = this.getAttribute("name") || this.name;

    let node = this,
      host;
    while ((node = node.parentNode)) {
      if (node.host) {
        host = node.host;
        break;
      }
    }

    return host
      ? host.childNodes.filter(n => {
          return name
            ? n.getAttribute && n.getAttribute("slot") === name
            : !n.getAttribute || !n.getAttribute("slot");
        })
      : [];
  };
  prop(ElementProto, "innerHTML", {
    get() {
      return this.childNodes.map(c => c.outerHTML || c.textContent).join("");
    },
    set(val) {
      while (this.hasChildNodes()) {
        this.removeChild(this.firstChild);
      }
      this.appendChild(translateParsed(parseFragment(val)));
    }
  });
  prop(ElementProto, "outerHTML", {
    get() {
      const { attributes, nodeName } = this;
      const name = nodeName.toLowerCase();
      return `<${name}${attributes.reduce(
        (prev, { name, value }) => prev + ` ${name}="${value}"`,
        ""
      )}>${this.innerHTML}</${name}>`;
    },
    set(val) {
      throw new Error("Not implemented: set outerHTML");
    }
  });
}

function patchEvents() {
  expose(
    "CustomEvent",
    expose(
      "Event",
      class extends Event {
        constructor(evnt, opts = {}) {
          super(evnt, opts);
        }
        initEvent(type, bubbles, cancelable) {
          this.bubbles = bubbles;
          this.cancelable = cancelable;
          this.type = type;
        }
        initCustomEvent(type, bubbles, cancelable, detail) {
          this.initEvent(type, bubbles, cancelable);
          this.detail = detail;
        }
      }
    )
  );

  document.createEvent = function(name) {
    return new window[name]();
  };
}

function patchHTMLElement() {
  function HTMLElement() {
    let newTarget = this.constructor;
    return Reflect.construct(Element, [], newTarget);
  }
  HTMLElement.prototype = Object.create(Element.prototype, {
    constructor: { value: HTMLElement, configurable: true, writable: true }
  });
  HTMLElement.prototype.attachShadow = function({ mode }) {
    const shadowRoot = document.createElement("shadow-root");
    prop(this, "shadowRoot", { value: shadowRoot });
    prop(shadowRoot, "host", { value: this });
    prop(shadowRoot, "mode", { value: mode });
    prop(shadowRoot, "parentNode", { value: this });
    return shadowRoot;
  };
  expose("HTMLElement", HTMLElement);
}

function patchNode() {
  Node.DOCUMENT_FRAGMENT_NODE = 11;
  Node.ELEMENT_NODE = 1;
  Node.TEXT_NODE = 3;

  prop(NodeProto, "textContent", {
    get() {
      return this.childNodes.map(c => c.nodeValue).join("");
    },
    set(val) {
      this.appendChild(document.createTextNode(val));
    }
  });

  NodeProto.contains = function(node) {
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

  NodeProto.hasChildNodes = function() {
    return this.childNodes.length;
  };

  // Undom internally calls insertBefore in appendChild.
  NodeProto.insertBefore = function(newNode, refNode) {
    return each(newNode, newNode => {
      insertBefore.call(this, newNode, refNode);
      connectNode(newNode);
    });
  };

  // Undom internally calls removeChild in replaceChild.
  NodeProto.removeChild = function(refNode) {
    return each(refNode, refNode => {
      removeChild.call(this, refNode);
      disconnectNode(refNode);
    });
  };
}

document.head = document.createElement("head");
document.insertBefore(document.head, document.body);

patchCustomElements();
patchDocumentFragment();
patchElement();
patchEvents();
patchHTMLElement();
patchNode();
