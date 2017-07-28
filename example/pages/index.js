/** @jsx vh */

const { Component, define, h } = require("skatejs");
const vh = require("@skatejs/val").default(h);

const Yell = define(
  class extends HTMLElement {
    static is = "x-yell";
    connectedCallback() {
      const slot = document.createElement("slot");
      const strong = document.createElement("strong");

      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(strong);
      strong.appendChild(slot);
    }
  }
);

const Hello = define(
  class extends Component {
    renderCallback() {
      return (
        <span>
          Hello,{" "}
          <Yell>
            <slot />
          </Yell>!
        </span>
      );
    }
  }
);

module.exports = define(
  class extends Component {
    renderCallback() {
      return (
        <div>
          <h1>SkateJS</h1>
          <p>
            <Hello>World</Hello>
          </p>
        </div>
      );
    }
  }
);
