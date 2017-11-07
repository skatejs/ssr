const fs = require('fs');
const path = require('path');
const { parseFragment } = require('parse5');

const { ClassList } = require('./ClassList');
const { triggerMutation } = require('./MutationObserver');

const ElementProto = Element.prototype;
const {
  dispatchEvent,
  getAttribute,
  removeAttribute,
  setAttribute
} = ElementProto;

let settingProp = false;
const attrToPropMap = {
  class: 'className',
  id: 'id',
  src: 'src'
};

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
  if (settingProp) return;
  const oldValue = this.getAttribute(name);
  const propName = attrToPropMap[name];
  setAttribute.call(this, name, newValue);
  if (propName) {
    settingProp = true;
    this[propName] = newValue;
    settingProp = false;
  }
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
  Object.defineProperty(this, 'shadowRoot', { value: shadowRoot });
  Object.defineProperty(shadowRoot, 'host', { value: this });
  Object.defineProperty(shadowRoot, 'mode', { value: mode });
  Object.defineProperty(shadowRoot, 'parentNode', { value: this });
  return shadowRoot;
};

Object.defineProperty(ElementProto, 'classList', {
  get() {
    return new ClassList(this);
  }
});

Object.defineProperty(ElementProto, 'innerHTML', {
  get() {
    return this.childNodes.map(c => c.outerHTML || c.textContent).join('');
  },
  set(val) {
    if (this.nodeName === 'SCRIPT') {
      return (this.textConten = val);
    }
    while (this.hasChildNodes()) {
      this.removeChild(this.firstChild);
    }
    this.appendChild(translateParsed(parseFragment(val)));
  }
});

Object.defineProperty(ElementProto, 'outerHTML', {
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

Object.defineProperty(ElementProto, 'src', {
  get() {
    return this._src;
  },
  set(val) {
    this._src = val;
    const filePath = path.resolve(path.join(document.ssr.scriptBase, val));
    fs.readFile(filePath, (err, str) => {
      eval(str.toString('utf-8'));
      this.onload && this.onload();
    });
  }
});

module.exports = {
  Element
};
