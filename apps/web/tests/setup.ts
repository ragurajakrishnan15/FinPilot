import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Routes are lazy-loaded; a cold dynamic import (e.g. the chart chunk) can exceed the 1s default.
configure({ asyncUtilTimeout: 5000 })

// jsdom lacks these browser APIs, which cmdk (the command palette) and Radix rely on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
