// @flow

class MutationRecord {
  constructor() {
    this.addedNodes = [];
    this.attributeName = null;
    this.attributeNamespace = null;
    this.oldValue = null;
    this.nextSibling = null;
    this.previousSibling = null;
    this.removedNodes = [];
    this.target = null;
    this.type = null;
  }
}

function promise(done) {
  let cancelled = false;
  Promise.resolve().then(() => {
    if (!cancelled) {
      done();
    }
  });
  return {
    cancel() {
      cancelled = true;
    }
  };
}

class MutationObserver {
  constructor(callback) {
    this._callback = callback;
    this._cancel = () => {};
    this._element = null;
    this._enqueue = this._enqueue.bind(this);
    this._promise = promise();
    this._records = new Map();
  }
  disconnect() {
    window.removeEventListener('__MutationObserver', this._enqueue);
  }
  observe(element, options) {
    this._element = element;
    this._options = options;
    window.addEventListener('__MutationObserver', this._enqueue);
  }
  takeRecords() {
    const entries = this._records.entries();
    this._records.clear();
    return Array.from(entries).map(map => map[1]);
  }
  _enqueue(e) {
    let record = this._records.get(e.parentNode);
    if (!record) {
      this._records.set(e.parentNode, (record = new MutationRecord()));
    }

    // if (this._options.childList) {
    //   if (e.mutationType !== 'add' && e.mutationType !== 'remove') {
    //     return;
    //   }
    //   if (!this._options.subtree && this._element !== e.parentNode) {
    //     return;
    //   }
    // }
    //
    // if (this._options.attributes && e.mutationType !== 'attribute') {
    //   return;
    // }
    //
    // if (this._options.characterData) {
    //   throw new Error('The MutationObserver characterData is not implemented.');
    // }

    this._promise.cancel();
    this._promise = promise(() => this._callback(this.takeRecords()));

    if (e.mutationType === 'add') {
      record.type = 'childList';
      record.target = e.parentNode;
      record.addedNodes.push(e.childNode);
    } else if (e.mutationType === 'remove') {
      record.type = 'childList';
      record.target = e.parentNode;
      record.removedNodes.push(e.childNode);
    } else if (e.mutationType === 'attribute') {
      record.type = 'attributes';
      record.target = e.parentNode;
      record.attributeName = e.attributeName;
      record.oldValue = e.oldvalue;
    } else if (e.mutationType === 'cdata') {
      record.type = 'characterData';
      record.oldValue = e.oldvalue;
    }
  }
}

Object.assign(module.exports, {
  MutationObserver,
  MutationRecord
});
