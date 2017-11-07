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

module.exports = {
  each,
  expose
};
