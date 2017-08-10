const { minify } = require("uglify-es");

const { code: minified } = minify(rehydrate.toString());

/**
 * Client side rehydration script.
 * This will get stringified, so it cannot rely on any external scope
 * @return {undefined}
 */
function rehydrate() {
  const script = document.currentScript;
  const fakeShadowRoot = script.parentNode;
  const host = fakeShadowRoot.parentNode;
  const move = (from, to) => {
    while (from && from.firstChild) to.appendChild(from.firstChild);
  };

  // This cleans up the resulting DOM but also seems to have a positive impact on performance.
  fakeShadowRoot.removeChild(script);

  // First thing we do is remove the fake shadow root so we can attach a shadow root safely.
  host.removeChild(fakeShadowRoot);

  // Create the real shadow root once we've cleaned up.
  const realShadowRoot = host.attachShadow({ mode: "open" });

  // Then we can move stuff over from the fake root to the real one.
  move(fakeShadowRoot, realShadowRoot);

  // We must find the slots *after* the shadow root is hydrated so we don't get any unwanted ones.
  const slots = realShadowRoot.querySelectorAll("slot");

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

module.exports.rehydrate = rehydrate;

module.exports.stringify = function(funcName) {
  return minified.replace(`function ${rehydrate.name}`, `function ${funcName}`);
};
