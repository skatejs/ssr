describe("window", () => {
  it("should work if re-included", () => {
    require("..");
  });

  it("Object", () => {
    expect(window.Object).toBeDefined();
    expect(window.Object).toEqual(global.Object);
  });

  describe("customElements", () => {
    it("should be an object", () => {
      expect(typeof window.customElements).toEqual("object");
    });

    it("define should add a the nodeName to the customElement", () => {
      expect(CustomElement.prototype.nodeName).toEqual("CUSTOM-ELEMENT");
    });

    it("get should return the custom element", () => {
      expect(window.customElements.get("custom-element")).toEqual(
        CustomElement
      );
    });
  });
});
