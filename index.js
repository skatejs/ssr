function ssrScript (funcName) {
  return `<script>function ${funcName}(){var a=document.currentScript.previousElementSibling,b=a.firstElementChild;a.removeChild(b);for(var c=a.attachShadow({mode:"open"});b.hasChildNodes();)c.appendChild(b.firstChild);}</script>`;
}

function stringify (node, { funcName }) {
  const { attributes = [], childNodes, nodeName, nodeValue, shadowRoot } = node;
  if (nodeName === '#text') {
    return nodeValue;
  }
  const attrsAsString = Array.from(attributes || []).map(({ name, value }) => ` ${name}="${value}"`);
  const localName = nodeName.toLowerCase();
  const shadowNodes = shadowRoot ? stringify(shadowRoot, { funcName }) : '';
  const lightNodes = childNodes.map(stringify, { funcName }).join('');
  const rehydrationScript = shadowRoot ? `<script>${funcName}()</script>` : '';
  return `<${localName}${attrsAsString}>${shadowNodes}${lightNodes}</${localName}>${rehydrationScript}`;
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
