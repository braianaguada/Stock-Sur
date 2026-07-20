import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("Unexpected network request in unit test"))),
  );
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "open", {
  writable: true,
  value: () => ({
    document: {
      write: () => {},
      close: () => {},
    },
    focus: () => {},
    print: () => {},
    close: () => {},
  }),
});

Object.defineProperty(window.URL, "createObjectURL", {
  writable: true,
  value: () => "blob:mock",
});

Object.defineProperty(window.URL, "revokeObjectURL", {
  writable: true,
  value: () => {},
});

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  writable: true,
  value: {
    writeText: async () => {},
  },
});
