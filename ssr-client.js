function attachShadow (node) {
  if (!node.shadowRoot) {
    node.attachShadow({ mode: 'open' });
  }
}

function applyContent (node, parentNode) {
  parentNode.shadowRoot.innerHTML = node.innerHTML;
}

class ShadowRootElement extends HTMLElement {
  connectedCallback() {
    const { parentNode } = this;
    parentNode.removeChild(this);
    attachShadow(parentNode);
    if (this.hasChildNodes()) {
      applyContent(this, parentNode);
    } else {
      const mo = new MutationObserver(() => {
        applyContent(this, parentNode);
        mo.disconnect();
      });
      mo.observe(this, { childList: true });
    }
  }
}

customElements.define('shadow-root', ShadowRootElement);
