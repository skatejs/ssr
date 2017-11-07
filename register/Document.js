const { Comment } = require('./Comment');
const { customElements } = require('./CustomElements');
const { DocumentFragment } = require('./DocumentFragment');
const { NodeFilter } = require('./NodeFilter');

const createElement = document.createElement.bind(document);

document.createComment = function(textContent) {
  const comment = new Comment();
  comment.textContent = textContent;
  return comment;
};

document.createDocumentFragment = () => new DocumentFragment();

document.createElement = function(name) {
  const Ctor = customElements.get(name);
  const elem = Ctor ? new Ctor() : createElement(name);
  Object.defineProperty(elem, 'localName', { value: name });
  return elem;
};

document.createEvent = function(name) {
  return new window[name]();
};

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

// Custom configuration options.
document.ssr = {
  scriptBase: process.cwd()
};
