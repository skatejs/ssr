/** @jsx h */

const { Component, define, h } = require('skatejs');

const Hello = define(class extends Component {
  static is = 'x-hello'
  renderCallback () {
    return (
      <span>Hello, <strong><slot /></strong>!</span>
    );
  }
});

module.exports = define(class extends Component {
  static is = 'x-index'
  renderCallback () {
    return (
      <div>
        <h1>SkateJS</h1>
        <p><x-hello>World</x-hello></p>
      </div>
    );
  }
});
