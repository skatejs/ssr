const { Component, h } = require('skatejs');

const { document, HTMLElement } = typeof window === 'undefined' ? global : window;
const _childNodes = Symbol();
const _scopeName = Symbol();
const _scopeExists = Symbol();
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
  return refNode.nodeType === 1 ? [refNode] : Array.from(refNode.childNodes || []);
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

function getScopeName (host) {
  return host[_scopeName] || (host[_scopeName] = 'scoped-' + Math.random().toString(36).substring(2, 8));
}

function stringify (node) {
  const { attributes, childNodes, nodeName, shadowRoot } = node;
  if (nodeName === '#text') {
    return node.nodeValue;
  }
  const attrsAsString = Array.from(attributes).map(({ name, value }) => ` ${name}="${value}"`);
  const localName = nodeName.toLowerCase();
  const nodes = shadowRoot ? shadowRoot.childNodes : node.childNodes;
  return `<${localName}${attrsAsString}>${nodes.map(stringify).join('')}</${localName}>`;
}

const withShadow = Base =>
  class extends (Base || HTMLElement) {
    get children () {
      return this.childNodes.filter(n => n.nodeType === 1);
    }
    get firstChild () {
      return this.childNodes[0] || null;
    }
    get lastChild () {
      const chs = this.childNodes;
      return chs[chs.length - 1] || null;
    }

    get innerHTML () {
      return this.childNodes.map(n => n.innerHTML || n.textContent).join('');
    }
    set innerHTML (innerHTML) {
      parser.innerHTML = innerHTML;
      this.childNodes = reParentAll(makeNodeList(parser.childNodes), this);
    }

    get outerHTML () {
      return stringify(this);
    }
    set outerHTML (outerHTML) {
      // TODO get attributes and apply to custom element host.
      parser.outerHTML = outerHTML;
      this.childNodes = reParentAll(makeNodeList(parser.childNodes), this);
    }

    get textContent () {
      return this.childNodes.map(n => n.textContent).join('');
    }
    set textContent (textContent) {
      this.childNodes = reParentAll(makeNodeList([document.createTextNode(textContent)]), this);
    }

    appendChild (newNode) {
      this.childNodes = this.childNodes.concat(reParentAll(ensureArray(newNode), this));
      return newNode;
    }
    insertBefore (newNode, refNode) {
      newNode = reParentAll(ensureArray(newNode), this);
      doIfIndex(this, refNode, (index, chren) => {
        this.childNodes = chren.concat(chren.slice(0, index + 1), newNode, chren.slice(index));
      }, (chren) => {
        this.childNodes = chren.concat(newNode);
      });
      return newNode;
    }
    removeChild (refNode) {
      doIfIndex(this, refNode, (index, chren) => {
        reParentOne(refNode, null);
        this.childNodes = chren.splice(index, 1).concat();
      });
      return refNode;
    }
    replaceChild (newNode, refNode) {
      doIfIndex(this, refNode, (index, chren) => {
        reParentOne(refNode, null);
        this.childNodes = chren.concat(chren.slice(0, index), reParentAll(ensureArray(newNode)), chren.slice(index));
      });
      return refNode;
    }

    attachShadow () {
      // We use an actual element attached to the node.
      const shadowRoot = document.createElement('shadowroot');

      // Remove all existing light nodes.
      while (super.childNodes && super.childNodes.length) {
        this.childNodes.push(this.firstChild);
        super.removeChild(super.firstChild);
      }

      // Attach the new shadow node to render the root into view.
      super.appendChild(shadowRoot);

      // DOM-like libraries likely touch childNodes, so we need to make sure
      // that they didn't put the shadowRoot in them.
      const found = this.childNodes && this.childNodes.indexOf(shadowRoot);
      if (found > -1) {
        this.childNodes.splice(found, 1);
      }

      // { mode } is silly.
      Object.defineProperty(this, 'shadowRoot', { value: shadowRoot });
      
      return shadowRoot;
    }
  };

// This is the base class that provides the default childNodes prop that
// queues a render when set.
const withShadowProps = Base =>
  class extends withShadow(Base || Component) {
    static get props () {
      return {
        childNodes: {
          coerce: v => Array.from(v)
        }
      };
    }
  }

// CSS scoping exports.
//
// Special thanks to Jason Miller (@_developit) for this idea.
// Link: https://jsfiddle.net/developit/vLzdhcg0/

// Scopes the CSS to the given root node.
const scopeCss = (root, css) => {
  const scopeName = getScopeName(root);
  const tokenizer = /(?:(\/\*[\s\S]*?\*\/|\burl\([\s\S]*?\)|(['"])[\s\S]*?\2)|(\{)|(\}))/g;

  let namespacedCss = '';
  let index = 0;
  let token, before;

  while ((token = tokenizer.exec(css))) {
    before = css.substring(index, token.index);
    if (token[3]) {
      before = before.replace(/((?:^|\s*[,\s>+~]|)\s*)(?:([a-z*][^{,\s>+~]*)|([^{,\s>+~]+))/gi, `$1$2[${scopeName}]$3`);
    }
    namespacedCss += before + token[0];
    index = token.index + token[0].length;
  }

  return namespacedCss + css.substring(index);
}

// Scopes the tree at the given root.
const scopeTree = (root) => {
  const scopeName = getScopeName(root);
  walk(root, node => {
    if (!node[_scopeExists]) {
      node[_scopeExists] = true;
      node.setAttribute(scopeName, '');
    }
  });
}

// Abstracts the imperative scoping calls behind a declarative interface.
class Style extends withShadowProps(Component) {
  static get props () {
    return Object.assign({}, super.props, {
      root: null
    });
  }
  renderCallback ({ root, textContent }) {
    scopeTree(root);
    return h('style', scopeCss(root, textContent));
  }
}

// Returns a promise that renders a node tree.
function render (node) {
  return new Promise(resolve => {
    walk(node, n => n.connectedCallback && n.connectedCallback());
    setTimeout(() => resolve(stringify(node)), 1);
  });
}

module.exports.render = render;
module.exports.scopeCss = scopeCss;
module.exports.scopeTree = scopeTree;
module.exports.Style = Style;
module.exports.withShadow = withShadow;
module.exports.withShadowProps = withShadowProps;
