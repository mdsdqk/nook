import "@testing-library/jest-dom/vitest";

// jsdom ships an incomplete <dialog>; always overwrite open/showModal/close.
if (typeof HTMLDialogElement !== "undefined") {
  Object.defineProperty(HTMLDialogElement.prototype, "open", {
    configurable: true,
    enumerable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute("open");
    },
    set(this: HTMLDialogElement, value: boolean) {
      if (value) this.setAttribute("open", "");
      else this.removeAttribute("open");
    },
  });

  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  };

  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    const wasOpen = this.hasAttribute("open");
    this.removeAttribute("open");
    if (wasOpen) this.dispatchEvent(new Event("close"));
  };
}

// Harden closed <dialog> the same way production CSS does so regression
// tests catch author `display:flex` utilities overriding UA hide rules.
const style = document.createElement("style");
style.textContent = `
  dialog:not([open]) {
    display: none !important;
  }
`;
document.head.appendChild(style);
