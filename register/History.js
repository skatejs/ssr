class History {
  constructor() {
    this._history = [];
    this._index = 0;
    this.pushState({}, null, 'about:blank');
  }
  get length() {
    return this._history.length;
  }
  get state() {
    return this._history[this._index];
  }
  back() {
    if (index > 0) {
      this.index--;
      this._dispatch();
    }
  }
  forward() {
    if (index < this.length - 1) {
      this.index++;
      this._dispatch();
    }
  }
  go(rel) {
    const abs = Math.abs(rel);
    const method = rel > 0;
    if (rel > 0) {
      for (const a = 0; a < abs; a++) {
        this.forward();
      }
    } else if (rel < 0) {
      for (const a = 0; a < abs; a++) {
        this.back();
      }
    }
  }
  pushState(state, title, url) {
    this._history.push({
      state,
      title,
      url
    });
    this._dispatch();
  }
  replaceState(state, title, url) {
    Object.assign(this.state, {
      state,
      title,
      url
    });
    this._dispatch();
  }
  _dispatch() {
    dispatchEvent(
      new Event('popstate', {
        state: this.state
      })
    );
  }
}

module.exports = {
  History
};
