import '@testing-library/jest-dom'

// Minimal EventSource stub so TimerContext SSE code is covered in unit tests.
// The stub implements the browser EventSource API surface without making real HTTP requests.
if (typeof global.EventSource === 'undefined') {
  global.EventSource = class MockEventSource {
    constructor() {
      this.onerror = null
      this._listeners = {}
    }
    addEventListener(type, fn) {
      this._listeners[type] = fn
    }
    removeEventListener() {}
    close() {}
  }
}
