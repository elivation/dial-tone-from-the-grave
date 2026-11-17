import '@testing-library/jest-dom';

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX, clientY
// and pointerId. A MouseEvent subclass is enough for our pointer handlers.
if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill, writable: true });
}

// jsdom has no showModal or close on <dialog>. This stand-in toggles `open` and fires the close
// event, which is all the listing detail relies on. It does not trap focus or build a top layer.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
    // Browsers close a modal dialog on Escape. jsdom does not.
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
