// One pending save per setting while a slider moves: each change restarts the
// wait, and a final change (the end of a drag, a typed value) saves at once.
import type { DebouncedSaver } from './wallpaper-runtime-types';

function createDebouncedSaver(windowObj: Window, delayMs: number): DebouncedSaver {
  const timers = new Map<string, number>();
  return function save(key, write, options) {
    const pending = timers.get(key);
    if (pending !== undefined) {
      windowObj.clearTimeout(pending);
      timers.delete(key);
    }
    if (options && options.final) {
      write();
      return;
    }
    timers.set(key, windowObj.setTimeout(() => {
      timers.delete(key);
      write();
    }, delayMs));
  };
}

export { createDebouncedSaver };
