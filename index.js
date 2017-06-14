function stringify (node) {
  const { attributes = [], childNodes, nodeName, nodeValue, shadowRoot } = node;
  if (nodeName === '#text') {
    return nodeValue;
  }
  const attrsAsString = Array.from(attributes || []).map(({ name, value }) => ` ${name}="${value}"`);
  const localName = nodeName.toLowerCase();
  const shadowNodes = shadowRoot ? stringify(shadowRoot) : '';
  const lightNodes = childNodes.map(stringify).join('');
  const rehydrationScript = shadowRoot ? `<script>var a=document.currentScript.previousElementSibling,b=a.firstElementChild;a.removeChild(b);for(var c=a.attachShadow({mode:"open"});b.hasChildNodes();)c.appendChild(b.firstChild);</script>` : '';
  return `<${localName}${attrsAsString}>${shadowNodes}${lightNodes}</${localName}>${rehydrationScript}`;
}

function render (node, resolver = setTimeout) {
  document.body.appendChild(node);
  return new Promise(resolve => {
    resolver(() => {
      resolve(stringify(node));
      document.body.removeChild(node);
    });
  });
}

module.exports = render;
