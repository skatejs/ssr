require('undom/register');

// Some libraries detect window or global, so we duplicate that here.
window.Object = global.Object;

const root = typeof window === 'undefined' ? global : window;
const { document, Node } = root;
const parser = document.createElement('div');
const isConnected = Symbol();

function doIfIndex (host, refNode, callback, otherwise) {
  const chren = host.childNodes;
  const index = chren.indexOf(refNode);

  if (index > -1) {
    callback(index, chren);
  } else if (otherwise) {
    otherwise(chren);
  }
}

function makeNodeList (nodeList) {
  const copy = Array.from(nodeList || []);
  copy.item = i => copy[i];
  return copy;
}

function ensureArray (refNode) {
  return refNode.nodeType === 8 ? Array.from(refNode.childNodes || []) : [refNode];
}

function reParentOne (refNode, newHost) {
  Object.defineProperty(refNode, 'parentNode', {
    configurable: true,
    value: newHost
  });
  return refNode;
}

function reParentAll (nodeList, newHost) {
  return nodeList.map(n => reParentOne(n, newHost));
}

function connectNode (node) {
  if (node.connectedCallback && !node[isConnected]) {
    node[isConnected] = true;
    node.connectedCallback();
  }
}

function disconnectNode (node) {
  if (node.disconnectedCallback && node[isConnected]) {
    node[isConnected] = false;
    node.disconnectedCallback();
  }
}


// Patch necessary DOM interfaces.

// Patch the Node interface to connect nodes.
window.Node.prototype.appendChild = function (newNode) {
  return this.insertBefore(newNode);
};
window.Node.prototype.insertBefore = function (newNode, refNode) {
  newNode = reParentAll(ensureArray(newNode), this);
  doIfIndex(this, refNode, (index, chren) => {
    this.childNodes = chren.concat(chren.slice(0, index + 1), newNode, chren.slice(index));
  }, (chren) => {
    this.childNodes = chren.concat(newNode);
  });
  newNode.forEach(connectNode);
  return newNode;
};
window.Node.prototype.removeChild = function (refNode) {
  doIfIndex(this, refNode, (index, chren) => {
    reParentOne(refNode, null);
    this.childNodes = chren.splice(index, 1).concat();
  });
  disconnectNode(refNode);
  return refNode;
};
window.Node.prototype.replaceChild = function (newNode, refNode) {
  doIfIndex(this, refNode, (index, chren) => {
    reParentOne(refNode, null);
    this.childNodes = chren.concat(chren.slice(0, index), reParentAll(ensureArray(newNode)), chren.slice(index));
  });
  newNode.forEach(connectNode);
  disconnectNode(refNode);
  return refNode;
};

// Patch the Element interface to allow shadow roots.
window.Element.prototype.attachShadow = function () {
  const shadowRoot = document.createElement('shadow-root');
  Object.defineProperty(this, 'shadowRoot', { value: shadowRoot });
  return shadowRoot;
};

// Undom does not define HTMLElement.
window.HTMLElement = window.Element;


// Custom elements

const registry = {};
const customElements = window.customElements = {
  define (name, func) {
    Object.defineProperty(func.prototype, 'nodeName', { value: name });
    registry[name] = func;
  },
  get (name) {
    return registry[name];
  }
};

const createElement = document.createElement.bind(document);
document.createElement = function (name) {
  const Ctor = customElements.get(name);
  return Ctor ? new Ctor() : createElement(name);
};


// Serialisation

function ssr (node) {
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
      setTimeout(() => resolve(ssr(node)));
    }
  });
}

module.exports.render = render;
