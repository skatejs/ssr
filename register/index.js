require('undom/register');
const { parseFragment } = require('parse5');
const { MutationObserver, MutationRecord } = require('./MutationObserver');

const ElementProto = Element.prototype;
const NodeProto = Node.prototype;
const { insertBefore, removeChild } = NodeProto;
const { dispatchEvent } = ElementProto;
const { defineProperty: prop } = Object;
const isConnected = Symbol('isConnected');

function expose(name, value) {
  global[name] = window[name] = value;
  return value;
}

function triggerMutation(
  mutationType,
  childNode,
  attributeName = null,
  oldValue = null
) {
  const { parentNode, previousSibling, nextSibling } = childNode;
  window.dispatchEvent(
    new Event('__MutationObserver', {
      mutationType,
      childNode,
      parentNode,
      previousSibling,
      nextSibling,
      attributeName,
      oldValue
    })
  );
}

function connectNode(node) {
  if (node.connectedCallback && !node[isConnected]) {
    node.connectedCallback();
  }
  node[isConnected] = true;
  triggerMutation('add', node);
}

function disconnectNode(node) {
  if (node.disconnectedCallback && node[isConnected]) {
    node.disconnectedCallback();
  }
  node[isConnected] = false;
  triggerMutation('remove', node);
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

function patchComment() {
  expose(
    'Comment',
    class extends Node {
      get outerHTML() {
        return `<!--${this.textContent}-->`;
      }
      get innerHTML() {
        return this.textContent;
      }
    }
  );

  document.createComment = function(textContent) {
    const comment = new Comment();
    comment.textContent = textContent;
    return comment;
  };
}

function patchCustomElements() {
  const customElementRegistry = {};
  expose('customElements', {
    define(name, func) {
      prop(func.prototype, 'nodeName', { value: name.toUpperCase() });
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
    prop(elem, 'localName', { value: name });
    return elem;
  };
}

function patchDocumentFragment() {
  expose(
    'DocumentFragment',
    class extends Node {
      get nodeName() {
        return '#document-fragment';
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
  ElementProto.hasAttributes = function() {
    return !!this.attributes.length;
  };
  ElementProto.removeAttribute = function(name) {
    const oldValue = this.getAttribute(name);
    removeAttribute.call(this, name);
    triggerMutation('attribute', this, name, oldValue);
    if (this.attributeChangedCallback) {
      this.attributeChangedCallback(name, oldValue, null);
    }
  };
  ElementProto.setAttribute = function(name, newValue) {
    const oldValue = this.getAttribute(name);
    setAttribute.call(this, name, newValue);
    triggerMutation('attribute', this, name, oldValue);
    if (this.attributeChangedCallback) {
      this.attributeChangedCallback(name, oldValue, newValue);
    }
  };
  ElementProto.assignedNodes = function() {
    if (this.nodeName !== 'SLOT') {
      throw new Error(
        'Non-standard: assignedNodes() called on non-slot element.'
      );
    }

    const name = this.getAttribute('name') || this.name;

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
            ? n.getAttribute && n.getAttribute('slot') === name
            : !n.getAttribute || !n.getAttribute('slot');
        })
      : [];
  };

  // This really should go on HTMLElement, however, all nodes created by Undom
  // derive from Element.
  ElementProto.attachShadow = function({ mode }) {
    const shadowRoot = document.createElement('shadow-root');
    prop(this, 'shadowRoot', { value: shadowRoot });
    prop(shadowRoot, 'host', { value: this });
    prop(shadowRoot, 'mode', { value: mode });
    prop(shadowRoot, 'parentNode', { value: this });
    return shadowRoot;
  };

  prop(ElementProto, 'innerHTML', {
    get() {
      return this.childNodes.map(c => c.outerHTML || c.textContent).join('');
    },
    set(val) {
      while (this.hasChildNodes()) {
        this.removeChild(this.firstChild);
      }
      this.appendChild(translateParsed(parseFragment(val)));
    }
  });
  prop(ElementProto, 'outerHTML', {
    get() {
      const { attributes, nodeName } = this;
      const name = nodeName.toLowerCase();
      return `<${name}${attributes.reduce(
        (prev, { name, value }) => prev + ` ${name}="${value}"`,
        ''
      )}>${this.innerHTML}</${name}>`;
    },
    set(val) {
      throw new Error('Not implemented: set outerHTML');
    }
  });
}

function patchEvents() {
  const PatchedEvent = expose(
    'Event',
    class extends Event {
      constructor(evnt, opts = {}) {
        super(evnt, opts);
        Object.assign(this, opts);
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
  );
  expose('CustomEvent', PatchedEvent);
  expose('MouseEvent', PatchedEvent);

  document.createEvent = function(name) {
    return new window[name]();
  };
}

function patchHTMLElement() {
  // Most nodes should derive from this but they derive from Element instead,
  // so we've put everything there and just expose this as a synonnym.
  expose('HTMLElement', Element);
}

function patchNode() {
  Node.DOCUMENT_FRAGMENT_NODE = 11;
  Node.ELEMENT_NODE = 1;
  Node.TEXT_NODE = 3;

  prop(NodeProto, 'content', {
    get() {
      if (!this._content) {
        this._content = new DocumentFragment();
        this.childNodes.forEach(node => this._content.appendChild(node));
      }
      return this._content;
    }
  });

  prop(NodeProto, 'ownerDocument', {
    get() {
      return document;
    }
  });

  prop(NodeProto, 'nodeType', {
    get() {
      if (this instanceof Element) {
        return 1;
      }
      if (this instanceof Text) {
        return 3;
      }
      if (this instanceof DocumentFragment) {
        return 11;
      }
    }
  });

  prop(NodeProto, 'textContent', {
    get() {
      return this.childNodes.map(c => c.nodeValue).join('');
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
      disconnectNode(refNode, this);
      removeChild.call(this, refNode);
    });
  };
}

document.createTreeWalker = function(
  root,
  whatToShow = NodeFilter.SHOW_ALL,
  filter = { acceptNode: () => NodeFilter.FILTER_ACCEPT }
) {
  let initial = true;
  return {
    currentNode: null,
    nextNode() {
      if (initial) {
        initial = false;
        this.currentNode = root;
      } else if (this.currentNode.nextSibling) {
        this.currentNode = this.currentNode.nextSibling;
      } else if (this.currentNode.firstChild) {
        this.currentNode = this.currentNode.firstChild;
      } else {
        this.currentNode = null;
      }
      return this.currentNode;
    }
  };
};

document.importNode = function(node, deep) {
  const { parentNode } = node;
  if (parentNode) {
    parentNode.removeChild(node);
  }
  if (!deep) {
    while (node.hasChildNodes()) {
      node.removeChild(node.firstChild);
    }
  }
  return node;
};

document.head = document.createElement('head');
document.insertBefore(document.head, document.body);

class History {
  constructor() {
    this._history = [];
    this._index = 0;
    this.pushState({}, null, 'about:blank');
  }
  get length() {
    return this._history.length;
  }
  get state() {
    return this._history[this._index];
  }
  back() {
    if (index > 0) {
      this.index--;
      this._dispatch();
    }
  }
  forward() {
    if (index < this.length - 1) {
      this.index++;
      this._dispatch();
    }
  }
  go(rel) {
    const abs = Math.abs(rel);
    const method = rel > 0;
    if (rel > 0) {
      for (const a = 0; a < abs; a++) {
        this.forward();
      }
    } else if (rel < 0) {
      for (const a = 0; a < abs; a++) {
        this.back();
      }
    }
  }
  pushState(state, title, url) {
    this._history.push({
      state,
      title,
      url
    });
    this._dispatch();
  }
  replaceState(state, title, url) {
    Object.assign(this.state, {
      state,
      title,
      url
    });
    this._dispatch();
  }
  _dispatch() {
    window.dispatchEvent(
      new Event('popstate', {
        state: this.state
      })
    );
  }
}

expose('__handlers', {});
expose('addEventListener', ElementProto.addEventListener.bind(window));
expose('removeEventListener', ElementProto.removeEventListener.bind(window));
expose('dispatchEvent', ElementProto.dispatchEvent.bind(window));
expose('history', new History());
expose('location', {
  hash: '',
  href: 'about:blank',
  protocol: 'node'
});
expose('navigator', {
  userAgent: 'Node'
});
expose('NodeFilter', {
  FILTER_ACCEPT: 100,
  FILTER_REJECT: 101,
  FILTER_SKIP: 102,
  SHOW_ALL: -1,
  SHOW_COMMENT: 128,
  SHOW_DOCUMENT: 256,
  SHOW_DOCUMENT_FRAGMENT: 1024,
  SHOW_DOCUMENT_TYPE: 512,
  SHOW_ELEMENT: 1,
  SHOW_PROCESSING_INSTRUCTION: 64,
  SHOW_TEXT: 4
});

patchComment();
patchCustomElements();
patchDocumentFragment();
patchElement();
patchEvents();
patchHTMLElement();
patchNode();

expose('MutationObserver', MutationObserver);
expose('MutationRecord', MutationRecord);
