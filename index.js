const _id = Symbol();
const utils = require("./utils");

function formatCss(css, shadowRootId) {
  return css.replace(/(\.[^\s,]+)/g, `$1${shadowRootId}`);
}

let shadowRootIds = 0;
function extractStyleData(node, cache = {}, currentShadowRoot) {
  const { childNodes, nodeName, shadowRoot } = node;
  let data = [];

  // We must intercept style nodes and cache their content so that we can
  // dedupe it. Later we add it to the response
  if (nodeName === "STYLE") {
    let css = stringifyAll(childNodes);
    let id = cache[css];

    if (id === undefined) {
      id = cache[css] = data.length;

      // We format the CSS here because we want to dedupe the CSS across
      // multiple shadow roots. If we format it above, it will be different
      // for every shadow root, so we only scope the CSS that will actually
      // get output to the browser.
      data.push({
        id: `__style_${shadowRootIds}`,
        textContent: formatCss(css, shadowRootIds)
      });

      // We give the shadow root a unique ID so that we can scope both the CSS
      // input here and also in the class names that are contained within the
      // shadow roots upon rendering.
      //
      // This makes all shadow roots that have the same exact style output
      // share the same scoped style tag in the head.
      //
      // TODO try and remove this side-effect.
      if (currentShadowRoot) {
        currentShadowRoot[_id] = shadowRootIds++;
      }
    }
  }

  data = data.concat(
    ...childNodes.map(n => extractStyleData(n, cache, currentShadowRoot))
  );

  if (shadowRoot) {
    data = data.concat(
      ...shadowRoot.childNodes.map(n => extractStyleData(n, cache, shadowRoot))
    );
  }

  return data;
}

function stringify(node, opts, currentShadowRoot) {
  const { attributes = [], childNodes, nodeName, nodeValue, shadowRoot } = node;

  // Text nodes don't need any decoration.
  if (nodeName === "#text") {
    return nodeValue;
  }

  // We must intercept style nodes and cache their content so that we can
  // dedupe it. Later we add it to the response.
  if (currentShadowRoot && nodeName === "STYLE") {
    return opts.rehydrate
      ? `<script data-style-id="__style_${currentShadowRoot[
          _id
        ]}">${opts.funcName}_restyle()</script>`
      : "";
  }

  const localName = nodeName === "#document" ? "html" : nodeName.toLowerCase();

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
      opts,
      currentShadowRoot
    )}</slot>`;
  }

  if (currentShadowRoot && currentShadowRoot[_id] !== undefined) {
    const className = node.getAttribute("class");
    if (className) {
      node.setAttribute(
        "class",
        className.split(" ").map(c => c + currentShadowRoot[_id]).join(" ")
      );
    }
  }

  const shadowNodes = shadowRoot
    ? stringify(shadowRoot, Object.assign({}, opts, { host: node }), shadowRoot)
    : "";
  const lightNodes = stringifyAll(childNodes, opts, currentShadowRoot);
  const rehydrationScript =
    opts.rehydrate && nodeName === "SHADOW-ROOT"
      ? `<script>${opts.funcName}_rehydrate()</script>`
      : "";
  return `<${localName}${stringifyAttributes(
    attributes
  )}>${shadowNodes}${lightNodes}${rehydrationScript}</${localName}>`;
}

function stringifyAll(nodes, opts, currentShadowRoot) {
  return nodes.map(node => stringify(node, opts, currentShadowRoot)).join("");
}

function stringifyAttributes(attributes) {
  return Array.from(attributes || []).map(
    ({ name, value }) => ` ${name}="${value}"`
  );
}

function createElement(name, props) {
  const e = document.createElement(name);
  Object.assign(e, props);
  return e;
}

function render(node, opts) {
  // Holds nodes to cleanup after rendering.
  // This is only if a document node is passed.
  const nodesToRemove = [];

  // Document mode is enabled if the consumer passes a document element.
  const isDocument = node == document;

  // Cleans up side-effects.
  shadowRootIds = 0;

  // Merge defaults with custom options.
  opts = Object.assign(
    {
      debug: process.env.NODE_ENV === "development",
      funcName: "__ssr",
      rehydrate: true,
      resolver: setTimeout
    },
    opts
  );

  // In document mode we assume the consumer appended their child to the body.
  // If not in document mode, we must do this for them so that it goes through
  // the custom element lifecycle. We must also tell it to remove the node once
  // we're finished.
  if (!isDocument) {
    document.body.appendChild(node);
    nodesToRemove.push(node);
  }

  return new Promise(resolve => {
    opts.resolver(() => {
      const styleData = extractStyleData(node);
      let prefix = "";

      // Only if we're rehydrating do we need to add scripts.
      if (opts.rehydrate) {
        const textContent =
          utils("rehydrate", opts.funcName) + utils("restyle", opts.funcName);

        // In document mode, we must mutate the head and clean up after it when
        // we're done.
        if (isDocument) {
          const ssrScriptElement = createElement("script", { textContent });
          nodesToRemove.push(ssrScriptElement);
          document.head.appendChild(ssrScriptElement);
        } else {
          prefix = `<script>${textContent}</script>`;
        }
      }

      // Like scripts, if a document is passed we must mutate the head and
      // clean up after it.
      if (isDocument) {
        styleData.forEach(props => {
          const style = createElement("style", props);
          nodesToRemove.push(style);
          document.head.appendChild(style);
        });
      } else {
        prefix += styleData
          .map(
            ({ id, textContent }) => `<style id="${id}">${textContent}</style>`
          )
          .join("");
      }

      // Stringify first so we can format if in debug mode.
      let stringified = prefix + stringify(node, opts);

      // Having a formatted HTML string is great for debug mode.
      if (opts.debug) {
        // somehow pretty print html
      }

      // Now that we've stringified the tree, we can clean up after any
      // mutations.
      nodesToRemove.forEach(n => n.parentNode.removeChild(n));

      // Calls back to the callee.
      resolve(stringified);
    });
  });
}

module.exports = render;
