const DEFAULT_COMMIT_ENTER_IGNORE_MS = 120;

// The fields of a keyboard or composition event the guard reads.
interface ImeKeyEvent {
  key?: string;
  code?: string;
  target?: unknown;
  isComposing?: boolean;
  keyCode?: number;
  which?: number;
}

interface ImeKeyGuardOptions {
  now?: () => number;
  commitEnterIgnoreMs?: number;
}

function isEnterKey(event: ImeKeyEvent | null | undefined): boolean {
  return Boolean(event && (event.key === 'Enter' || event.code === 'Enter'));
}

function getEventTarget(event: ImeKeyEvent | null | undefined): unknown {
  return event && event.target ? event.target : null;
}

function createImeKeyGuard(options?: ImeKeyGuardOptions) {
  const settings: ImeKeyGuardOptions = options && typeof options === 'object' ? options : {};
  const now = typeof settings.now === 'function'
    ? settings.now
    : () => Date.now();
  const commitEnterIgnoreMs = Math.max(
    0,
    Number(settings.commitEnterIgnoreMs) || DEFAULT_COMMIT_ENTER_IGNORE_MS
  );
  let composing = false;
  let lastCompositionEndAt = 0;
  let lastCompositionTarget: unknown = null;

  function isComposing() {
    return composing;
  }

  function markCompositionStart(event?: ImeKeyEvent | null) {
    composing = true;
    lastCompositionEndAt = 0;
    lastCompositionTarget = getEventTarget(event);
  }

  function markCompositionEnd(event?: ImeKeyEvent | null) {
    composing = false;
    lastCompositionEndAt = now();
    lastCompositionTarget = getEventTarget(event);
  }

  // Releasing the key that committed the text (Space, a candidate number) ends
  // the commit window, so an Enter typed right after it still submits.
  function markKeyUp() {
    if (!composing) {
      lastCompositionEndAt = 0;
    }
  }

  function isNativeCompositionEvent(event: ImeKeyEvent | null | undefined): boolean {
    return Boolean(
      event &&
      (
        event.isComposing ||
        event.keyCode === 229 ||
        event.which === 229 ||
        event.key === 'Process'
      )
    );
  }

  function isWithinCompositionCommitWindow(event: ImeKeyEvent | null | undefined): boolean {
    if (!isEnterKey(event) || !lastCompositionEndAt) {
      return false;
    }
    const elapsed = now() - lastCompositionEndAt;
    if (elapsed < 0 || elapsed > commitEnterIgnoreMs) {
      return false;
    }
    const target = getEventTarget(event);
    return !lastCompositionTarget || !target || target === lastCompositionTarget;
  }

  function shouldIgnoreKeydown(event: ImeKeyEvent | null | undefined): boolean {
    return Boolean(
      composing ||
      isNativeCompositionEvent(event) ||
      isWithinCompositionCommitWindow(event)
    );
  }

  return Object.freeze({
    isComposing,
    markCompositionStart,
    markCompositionEnd,
    markKeyUp,
    shouldIgnoreKeydown
  });
}

type ImeKeyGuard = ReturnType<typeof createImeKeyGuard>;

export { createImeKeyGuard };
export type { ImeKeyGuard };
export type { ImeKeyEvent, ImeKeyGuardOptions };
