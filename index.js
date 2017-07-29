function ssrScript(funcName) {
  return `
    <script>
      function __ssr () {
        const script = document.currentScript;
        const fakeShadowRoot = script.parentNode;
        const host = fakeShadowRoot.parentNode;
        const move = (from, to) => { while (from && from.firstChild) to.appendChild(from.firstChild) };

        // This cleans up the resulting DOM but also seems to have a positive impact on performance.
        fakeShadowRoot.removeChild(script);

        // First thing we do is remove the fake shadow root so we can attach a shadow root safely.
        host.removeChild(fakeShadowRoot);

        // Create the real shadow root once we've cleaned up.
        const realShadowRoot = host.attachShadow({ mode: 'open' });

        // Then we can move stuff over from the fake root to the real one.
        move(fakeShadowRoot, realShadowRoot);

        // We must find the slots *after* the shadow root is hydrated so we don't get any unwanted ones.
        const slots = realShadowRoot.querySelectorAll('slot');

        // At each Shadow Root, we only care about its slots, not composed slots,
        // therefore we need to move the children of top level slots, but not others
        // Also can't 'move' in loop as that will mutate the DOM and ruin the
        // 'contains' checks for subsequent slots.
        const topLevelSlots = (() => {
          let top = [],
              ref;

          for (let i = 0, k = slots.length; i < k; i++) {
            const slot = slots[i];

            // Ref is last known top level slot, if current slot is contained by it,
            // then that slot is nested and can be ignored
            if (!(ref && ref.contains(slot))) {
              top.push(slot);
              ref = slot;
            }
          }

          return top;
        })();

        topLevelSlots.forEach(slot => move(slot, host));
      }
    </script>
  `;
}

function stringify(node, opts) {
  const { attributes = [], childNodes, nodeName, nodeValue, shadowRoot } = node;

  if (nodeName === "#text") {
    return nodeValue;
  }

  const localName = nodeName.toLowerCase();

  if (localName === "slot") {
    let currentNode = node,
      host;
    while ((currentNode = currentNode.parentNode)) {
      if (currentNode.host) {
        host = currentNode.host;
        break;
      }
    }

    const assignedNodes = node.assignedNodes();
    const hasAssignedNodes = !!assignedNodes.length;
    const nodesToRender = hasAssignedNodes ? assignedNodes : childNodes;

    // Since we're rendering the assigned nodes into the slots, we don't want
    // to render the light DOM so we must remove it from the host's childNodes.
    assignedNodes.forEach(n => {
      const index = host.childNodes.indexOf(n);
      if (index > -1) {
        host.childNodes.splice(index, 1);
      }
    });

    if (!hasAssignedNodes) {
      attributes.push({ name: "default", value: "" });
    }

    return `<slot${stringifyAttributes(attributes)}>${stringifyAll(
      nodesToRender,
      opts
    )}</slot>`;
  }

  const shadowNodes = shadowRoot
    ? stringify(shadowRoot, Object.assign({}, opts, { host: node }))
    : "";
  const lightNodes = stringifyAll(childNodes, opts);
  const rehydrationScript =
    nodeName === "SHADOW-ROOT" ? `<script>${opts.funcName}()</script>` : "";
  return `<${localName}${stringifyAttributes(
    attributes
  )}>${shadowNodes}${lightNodes}${rehydrationScript}</${localName}>`;
}

function stringifyAll(nodes, opts) {
  return nodes.map(node => stringify(node, opts)).join("");
}

function stringifyAttributes(attributes) {
  return Array.from(attributes || []).map(
    ({ name, value }) => ` ${name}="${value}"`
  );
}

function render(node, opts) {
  const { funcName, resolver } = Object.assign(
    {},
    {
      funcName: "__ssr",
      resolver: setTimeout
    },
    opts
  );
  document.body.appendChild(node);
  return new Promise(resolve => {
    resolver(() => {
      resolve(ssrScript(funcName) + stringify(node, { funcName }));
      document.body.removeChild(node);
    });
  });
}

module.exports = render;
