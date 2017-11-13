// @flow

class StyleSheet {
  /*:: ownerNode: Node */
  constructor(ownerNode /*: Node */) {
    this.ownerNode = ownerNode;
  }
}

class CSSStyleSheet extends StyleSheet {
  /*:: cssRules: Array<string>; */
  constructor(ownerNode /*: Node */) {
    super(ownerNode);
    this.cssRules = [];
  }
  insertRule(rule /*: string*/, index /*: ?number*/) /*: number */ {
    index = index || 0;
    this.cssRules.splice(index, 0, rule);
    return index;
  }
  deleteRule(index /*: number */) /*: void*/ {
    this.cssRules.splice(index, 1);
  }
}

module.exports = {
  CSSStyleSheet,
  StyleSheet
};
