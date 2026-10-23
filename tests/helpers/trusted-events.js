'use strict';

// JSDOM cannot make a trusted event: every dispatched event has isTrusted
// false, and the extension ignores those for anything privileged. Tracking a
// target's listeners lets a test hand them an event object that says it is
// trusted, the way a real key press or click reaches them.

function createTrustedEvent(type, init) {
  const event = Object.assign({
    type,
    isTrusted: true,
    key: '',
    code: '',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    propagationStopped: false,
    immediatePropagationStopped: false
  }, init || {});
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  event.stopPropagation = () => {
    event.propagationStopped = true;
  };
  event.stopImmediatePropagation = () => {
    event.immediatePropagationStopped = true;
    event.propagationStopped = true;
  };
  if (typeof event.composedPath !== 'function') {
    event.composedPath = () => (event.target ? [event.target] : []);
  }
  return event;
}

// JSDOM's selector engine adds capture listeners for focus, key and mouse
// events to the window the first time its document runs a selector, and keeps
// them for the document's lifetime. Starting the engine before tracking keeps
// those listeners out of the ones the page registers.
function startSelectorEngine(target) {
  const document = (target && (target.document || target.ownerDocument)) || target;
  if (document && typeof document.querySelector === 'function') {
    document.querySelector('*');
  }
}

// Tracks the listeners added to `target` (a window, document or element) so
// trusted events can be delivered to them. Listeners keep working for real
// dispatchEvent calls too.
function trackListeners(target) {
  startSelectorEngine(target);
  const listeners = [];
  const nativeAdd = target.addEventListener.bind(target);
  const nativeRemove = target.removeEventListener.bind(target);
  const captureOf = (options) => (typeof options === 'boolean' ? options : Boolean(options && options.capture));
  target.addEventListener = (type, listener, options) => {
    const capture = captureOf(options);
    if (listener && !listeners.some((entry) => entry.type === type && entry.listener === listener && entry.capture === capture)) {
      listeners.push({ type, listener, capture });
    }
    return nativeAdd(type, listener, options);
  };
  target.removeEventListener = (type, listener, options) => {
    const capture = captureOf(options);
    const index = listeners.findIndex((entry) => entry.type === type && entry.listener === listener && entry.capture === capture);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
    return nativeRemove(type, listener, options);
  };
  return {
    // The listeners currently registered for `type`.
    listeners(type) {
      return listeners.filter((entry) => entry.type === type).map((entry) => entry.listener);
    },
    count(type) {
      return listeners.filter((entry) => entry.type === type).length;
    },
    // Delivers a trusted event to every listener for `type`, capture listeners
    // first, until one stops immediate propagation. Returns the event.
    dispatch(type, init) {
      const event = createTrustedEvent(type, Object.assign({ target }, init || {}));
      const ordered = listeners.filter((entry) => entry.type === type && entry.capture)
        .concat(listeners.filter((entry) => entry.type === type && !entry.capture));
      for (const entry of ordered) {
        const listener = entry.listener;
        if (typeof listener === 'function') {
          listener.call(target, event);
        } else if (listener && typeof listener.handleEvent === 'function') {
          listener.handleEvent(event);
        }
        if (event.immediatePropagationStopped) {
          break;
        }
      }
      return event;
    }
  };
}

// Records the listeners of every node, window and shadow root in `window`
// (install before the page's scripts run). The returned dispatch(target,
// type, init) delivers a trusted event along the composed path the way the
// browser does: capture listeners from the window down, then the target and
// bubble listeners back up, stopping where propagation is stopped.
function recordAllListeners(window) {
  startSelectorEngine(window);
  const registry = new WeakMap();
  const proto = window.EventTarget.prototype;
  const nativeAdd = proto.addEventListener;
  const nativeRemove = proto.removeEventListener;
  const captureOf = (options) => (typeof options === 'boolean' ? options : Boolean(options && options.capture));
  proto.addEventListener = function(type, listener, options) {
    if (listener) {
      const list = registry.get(this) || [];
      const capture = captureOf(options);
      if (!list.some((entry) => entry.type === type && entry.listener === listener && entry.capture === capture)) {
        list.push({ type, listener, capture, once: Boolean(options && options.once) });
      }
      registry.set(this, list);
    }
    return nativeAdd.call(this, type, listener, options);
  };
  proto.removeEventListener = function(type, listener, options) {
    const list = registry.get(this);
    if (list) {
      const capture = captureOf(options);
      const index = list.findIndex((entry) => entry.type === type && entry.listener === listener && entry.capture === capture);
      if (index >= 0) list.splice(index, 1);
    }
    return nativeRemove.call(this, type, listener, options);
  };

  function composedPath(target) {
    const path = [];
    let node = target;
    while (node) {
      path.push(node);
      if (node.parentNode) {
        node = node.parentNode;
      } else if (node.host) {
        node = node.host;
      } else if (node.nodeType === 9) {
        node = node.defaultView;
      } else {
        node = null;
      }
    }
    return path;
  }

  function invoke(node, event, phase) {
    const list = (registry.get(node) || []).filter((entry) => entry.type === event.type &&
      (phase === 'target' || entry.capture === (phase === 'capture')));
    for (const entry of list) {
      if (entry.once) {
        const all = registry.get(node);
        all.splice(all.indexOf(entry), 1);
      }
      event.currentTarget = node;
      if (typeof entry.listener === 'function') entry.listener.call(node, event);
      else if (entry.listener && typeof entry.listener.handleEvent === 'function') entry.listener.handleEvent(event);
      if (event.immediatePropagationStopped) return;
    }
  }

  return function dispatch(target, type, init) {
    const path = composedPath(target);
    const event = createTrustedEvent(type, Object.assign({ target, bubbles: true }, init || {}));
    event.composedPath = () => path.slice();
    for (let index = path.length - 1; index > 0 && !event.propagationStopped; index -= 1) {
      invoke(path[index], event, 'capture');
    }
    if (!event.propagationStopped) invoke(target, event, 'target');
    if (event.bubbles !== false) {
      for (let index = 1; index < path.length && !event.propagationStopped; index += 1) {
        invoke(path[index], event, 'bubble');
      }
    }
    return event;
  };
}

module.exports = { createTrustedEvent, recordAllListeners, startSelectorEngine, trackListeners };
