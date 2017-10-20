/** @jsx h */

const { h } = require('@skatejs/val');

function observe(func, opts) {
  const el = <div />;
  const mo = new MutationObserver(func);
  mo.observe(el, opts);
  return { el, mo };
}

test('childList', done => {
  const { el } = observe(
    muts => {
      expect(Array.isArray(muts)).toBe(true);
      done();
    },
    {
      childList: true
    }
  );
  el.appendChild(<div />);
});
