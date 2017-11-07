const customElementRegistry = {};
const customElements = {
  define(name, func) {
    Object.defineProperty(func.prototype, 'nodeName', {
      value: name.toUpperCase()
    });
    customElementRegistry[name] = func;
  },
  get(name) {
    return customElementRegistry[name];
  }
};

module.exports = {
  customElements
};
