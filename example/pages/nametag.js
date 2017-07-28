/** @jsx h */

const { Component, define, h, props } = require('skatejs');

const Slant = define(class extends HTMLElement {
  static is = 'x-slant'
  connectedCallback () {
    const slot = document.createElement('slot');
    const em = document.createElement('em');

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(em);
    em.appendChild(slot);
  }
});

const Centered = define(class extends HTMLElement {
	static is ='x-centered'

	connectedCallback () {
    const slot = document.createElement('slot');
    const style = document.createElement('style');

    style.innerHTML = `
			:host {
				text-align: center;
			}
    `;

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(slot);
  }
});

const NameCard = define(class extends Component {
  static is = 'x-namecard'

  renderCallback () {
    return (
      <x-centered>
      	<h1><slot name="name" /></h1>
      	<x-slant><slot name="description" /></x-slant>
      </x-centered>
    );
  }
});

module.exports = define(class extends Component {
  static is = 'x-index'

  static props = {
  	name: { ...props.string, default: 'John Doe' },
  	description: { ...props.string, default: 'Web Components enthusiast' }
  }

  renderCallback ({ name, description }) {
    return (
      <x-namecard>
      	<p slot="description">{ description }</p>
        <strong slot="name">{ name }</strong>
      </x-namecard>
    );
  }
});