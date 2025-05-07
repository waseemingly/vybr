class EventTargetPolyfill {
  private listeners: { [key: string]: Function[] } = {};

  addEventListener(type: string, callback: Function) {
    if (!(type in this.listeners)) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  removeEventListener(type: string, callback: Function) {
    if (!(type in this.listeners)) {
      return;
    }
    const stack = this.listeners[type];
    const index = stack.indexOf(callback);
    if (index !== -1) {
      stack.splice(index, 1);
    }
  }

  dispatchEvent(event: { type: string; [key: string]: any }) {
    if (!(event.type in this.listeners)) {
      return true;
    }
    const stack = this.listeners[event.type].slice();
    for (let i = 0; i < stack.length; i++) {
      stack[i].call(this, event);
    }
    return !event.defaultPrevented;
  }
}

// Polyfill EventTarget
if (typeof global.EventTarget === 'undefined') {
  global.EventTarget = EventTargetPolyfill;
  global.Event = class Event {
    type: string;
    defaultPrevented: boolean = false;
    constructor(type: string) {
      this.type = type;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}

export { EventTargetPolyfill as EventTarget }; 