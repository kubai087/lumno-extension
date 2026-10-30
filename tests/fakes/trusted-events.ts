// Trusted input for tests. JSDOM marks every event a script dispatches as
// untrusted, and the extension ignores those for anything privileged (keys
// the overlay owns, a tab switcher's activation). dispatchTrusted delivers an
// event through JSDOM's own dispatch with isTrusted set, the way a real key
// press or click reaches the page: along the composed path, with capture,
// target and bubble phases and stopPropagation as the browser has them.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

interface EventImpl {
  isTrusted: boolean;
}

interface TargetImpl {
  _dispatch(event: EventImpl): boolean;
}

function isEventImpl(value: unknown): value is EventImpl {
  return typeof value === 'object' && value !== null && 'isTrusted' in value;
}

function isTargetImpl(value: unknown): value is TargetImpl {
  return typeof value === 'object' && value !== null && '_dispatch' in value && typeof value._dispatch === 'function';
}

function readImplForWrapper(utils: unknown): (wrapper: unknown) => unknown {
  const implForWrapper = typeof utils === 'object' && utils !== null && 'implForWrapper' in utils
    ? utils.implForWrapper
    : null;
  if (typeof implForWrapper !== 'function') {
    throw new Error('JSDOM no longer exposes implForWrapper; update tests/fakes/trusted-events.ts.');
  }
  return (wrapper) => Reflect.apply(implForWrapper, undefined, [wrapper]);
}

const implForWrapper = readImplForWrapper(require('jsdom/lib/generated/idl/utils.js'));

// Dispatches `event` at `target` as trusted input and returns the event.
export function dispatchTrusted<E extends Event>(target: EventTarget, event: E): E {
  const eventImpl = implForWrapper(event);
  const targetImpl = implForWrapper(target);
  if (!isEventImpl(eventImpl) || !isTargetImpl(targetImpl)) {
    throw new Error('dispatchTrusted needs a JSDOM event and event target.');
  }
  eventImpl.isTrusted = true;
  targetImpl._dispatch(eventImpl);
  return event;
}

// A trusted key press (keydown) or release (keyup) at `target`.
export function trustedKey(target: EventTarget, type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
  return dispatchTrusted(target, new KeyboardEvent(type, { bubbles: true, cancelable: true, composed: true, ...init }));
}
