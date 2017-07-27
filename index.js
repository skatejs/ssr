function ssrScript (funcName) {
  return `
    <script>
      function __ssr () {
        const script = document.currentScript;
        const host = script.previousElementSibling;
        const fakeShadowRoot = host.firstElementChild;
        const slots = host.getElementsByTagName('slot');
        const move = (from, to) => { while (from.firstChild) to.appendChild(from.firstChild) };

        // At each Shadow Root, we only care about its slots, not composed slots,
        // therefore we need to move the children of top level slots, but no others
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

        // // Removing the script speeds up rendering by a few hundred ms when
        // // not optimised and only a few when optimised.
        script.parentNode.removeChild(script);

        // The fastest overall method is to simply use innerHTML. This seems to be
        // faster when not optimised (by about 50%) but is slightly slower when
        // optimised compared to traversing the fake shadow root and appending each
        // element to the real one:
        const realShadowRoot = host.attachShadow({ mode: 'open' });
        move(fakeShadowRoot, realShadowRoot);
        host.removeChild(fakeShadowRoot);
      }
    </script>
  `;
}

function stringify (node, opts) {
  const { attributes = [], childNodes, nodeName, nodeValue, shadowRoot } = node;

  if (nodeName === '#text') {
    return nodeValue;
  }

  const localName = nodeName.toLowerCase();

  if (localName === 'slot') {
    let currentNode = node, host;
    while (currentNode = currentNode.parentNode) {
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
      attributes.push({ name: 'default', value: '' });
    }

    return `<slot${stringifyAttributes(attributes)}>${stringifyAll(nodesToRender, opts)}</slot>`;
  }

  const shadowNodes = shadowRoot ? stringify(shadowRoot, Object.assign({}, opts, { host: node })) : '';
  const lightNodes = stringifyAll(childNodes, opts);
  const rehydrationScript = shadowRoot ? `<script>${opts.funcName}()</script>` : '';
  return `<${localName}${stringifyAttributes(attributes)}>${shadowNodes}${lightNodes}</${localName}>${rehydrationScript}`;
}

function stringifyAll (nodes, opts) {
  return nodes.map(node => stringify(node, opts)).join('');
}

function stringifyAttributes (attributes) {
  return Array.from(attributes || []).map(({ name, value }) => ` ${name}="${value}"`);
}

function render (node, opts) {
  const { funcName, resolver } = Object.assign({}, {
    funcName: '__ssr',
    resolver: setTimeout
  }, opts);
  document.body.appendChild(node);
  return new Promise(resolve => {
    resolver(() => {
      resolve(ssrScript(funcName) + stringify(node, { funcName }));
      document.body.removeChild(node);
    });
  });
}

module.exports = render;
