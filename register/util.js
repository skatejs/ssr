function each(node, call) {
  if (node.nodeName === '#document-fragment') {
    Array.from(node.childNodes).forEach(call);
  } else {
    call(node);
  }
  return node;
}

function expose(name, value) {
  global[name] = window[name] = value;
  return value;
}

function find(root, call, opts = {}) {
  const tree = document.createTreeWalker(root);

  // Since we short-circuit in the loop, we can initialise this to the default
  // return value we'd expect if nothing is found.
  const list = opts.one ? null : [];

  while (tree.nextNode()) {
    if (call(tree.currentNode)) {
      // Short-circuit if only returning one.
      if (opts.one) {
        return tree.currentNode;
      }
      list.push(tree.currentNode);
    }
  }

  return list;
}

module.exports = {
  each,
  expose,
  find
};
