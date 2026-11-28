import '@testing-library/jest-dom/vitest';

// jsdom has no PointerEvent: fall back to MouseEvent so `clientX/clientY` survive `fireEvent.pointer*`.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}
