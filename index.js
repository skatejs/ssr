require('undom/register');

// Undom has Element, but not HTMLElement.
window.HTMLElement = window.Element;

// Some libraries detect window or global, so we duplicate that here.
window.Object = global.Object;

const root = typeof window === 'undefined' ? global : window;
const { document, HTMLElement, Node } = root;
const parser = document.createElement('div');

function walk (root, call) {
  const chs = root.childNodes;
  call(root);
  for (let a = 0; a < chs.length; a++) {
    walk(chs[a], call);
  }
}

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

window.HTMLElement = function () {
  return HTMLElement.call(this);
}
window.HTMLElement.prototype = Object.create(HTMLElement.prototype, {
  appendChild: {value (newNode) {
    this.childNodes = this.childNodes.concat(reParentAll(ensureArray(newNode), this));
    return newNode;
  }},
  insertBefore: {value (newNode, refNode) {
    newNode = reParentAll(ensureArray(newNode), this);
    doIfIndex(this, refNode, (index, chren) => {
      this.childNodes = chren.concat(chren.slice(0, index + 1), newNode, chren.slice(index));
    }, (chren) => {
      this.childNodes = chren.concat(newNode);
    });
    return newNode;
  }},
  removeChild: {value (refNode) {
    doIfIndex(this, refNode, (index, chren) => {
      reParentOne(refNode, null);
      this.childNodes = chren.splice(index, 1).concat();
    });
    return refNode;
  }},
  replaceChild: {value (newNode, refNode) {
    doIfIndex(this, refNode, (index, chren) => {
      reParentOne(refNode, null);
      this.childNodes = chren.concat(chren.slice(0, index), reParentAll(ensureArray(newNode)), chren.slice(index));
    });
    return refNode;
  }},
  attachShadow: {value () {
    const shadowRoot = document.createElement('shadow-root');
    Object.defineProperty(this, 'shadowRoot', { value: shadowRoot });
    return shadowRoot;
  }}
});


// Custom elements

window.customElements = {
  registry: {},
  define (name, func) {
    Object.defineProperty(func.prototype, 'nodeName', { value: name });
    this.registry[name] = func;
  },
  get (name) {
    return this.registry[name];
  }
};


// Serialisation

function stringifyAttributes (node) {
  const { attributes = [] } = node;
  return Array.from(attributes || []).map(({ name, value }) => ` ${name}="${value}"`);
}

function stringifyOuter (node) {
  const localName = node.nodeName.toLowerCase();
  if (localName === '#text') {
    return node.nodeValue;
  }
  return `<${localName}${stringifyAttributes(node)}>${stringifyInner(node)}</${localName}>`;
}

function stringifyInner (node) {
  return Array.from(node.childNodes).map(stringifyOuter).join('') || node.nodeValue || node.textContent || '';
}

function ssr (node) {
  const { nodeName, shadowRoot } = node;
  const attrsAsString = stringifyAttributes(node);
  const localName = nodeName.toLowerCase();
  const shadowNodes = shadowRoot ? stringifyOuter(shadowRoot) : '';
  const lightNodes = stringifyInner(node);
  return `<${localName}${attrsAsString}>${shadowNodes}${lightNodes}</${localName}><script>var a=document.currentScript.previousElementSibling,b=a.firstElementChild;a.removeChild(b);for(var c=a.attachShadow({mode:"open"});b.hasChildNodes();)c.appendChild(b.firstChild);</script>`;
}

function render (node) {
  return new Promise(resolve => {
    walk(node, n => n.connectedCallback && n.connectedCallback());
    setTimeout(() => resolve(ssr(node)), 1);
  });
}

module.exports.render = render;
