const NodeEnvironment = require('jest-environment-node');
const undom = require('undom');

module.exports = class extends NodeEnvironment {
  constructor (config) {
    super(config);
    const window = undom().defaultView;
    Object.getOwnPropertyNames(global).forEach(n => (window[n] = global[n]));
    Object.assign(this.context, window, { window });
  }
};
