// The extension API a content script sees in a page, in memory: a runtime
// that records what the script sends the worker and answers after a task, its
// onMessage listeners, and the sync and local storage areas. Stub it as the
// `chrome` global before importing a content script.
type StorageValues = Record<string, unknown>;
type StorageChanges = Record<string, { newValue?: unknown; oldValue?: unknown }>;
type StorageListener = (changes: StorageChanges, area: string) => void;
type MessageListener = (message: unknown, sender: object, sendResponse: (response?: unknown) => void) => unknown;
type Message = Record<string, unknown>;
// The worker's answer to a message, or 'never' for a worker that does not answer.
type Responder = ((message: Message) => unknown) | 'never';

interface ContentChromeOptions {
  sync?: StorageValues;
  local?: StorageValues;
  // Answers by action; any other message gets { ok: true }.
  replies?: Record<string, Responder>;
}

function isMessage(value: unknown): value is Message {
  return typeof value === 'object' && value !== null;
}

function pick(values: StorageValues, keys: unknown): StorageValues {
  if (keys === null || keys === undefined) {
    return { ...values };
  }
  const list = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : Object.keys(Object(keys)));
  return Object.fromEntries(list.filter((key): key is string => typeof key === 'string' && key in values).map((key) => [key, values[key]]));
}

function createArea(values: StorageValues, writes: StorageValues[]) {
  return {
    values,
    get(keys: unknown, callback?: (result: StorageValues) => void) {
      const result = pick(values, keys);
      if (callback) {
        callback(result);
        return undefined;
      }
      return Promise.resolve(result);
    },
    set(payload: StorageValues, callback?: () => void) {
      writes.push({ ...payload });
      Object.assign(values, payload);
      if (callback) {
        callback();
        return undefined;
      }
      return Promise.resolve();
    }
  };
}

function createContentChrome(options: ContentChromeOptions = {}) {
  const messages: Message[] = [];
  const messageListeners: MessageListener[] = [];
  const storageListeners: StorageListener[] = [];
  const storageWrites: StorageValues[] = [];
  const replies = options.replies || {};
  const runtime: {
    id: string;
    lastError: null;
    getURL(path: string): string;
    onMessage: {
      addListener(listener: MessageListener): void;
      removeListener(listener: MessageListener): void;
      hasListener(listener: MessageListener): boolean;
    };
    sendMessage?(message: unknown, callback?: (response: unknown) => void): void;
  } = {
    id: 'lumno-test',
    lastError: null,
    getURL: (path: string) => `chrome-extension://lumno-test/${String(path).replace(/^\//, '')}`,
    onMessage: {
      addListener: (listener: MessageListener) => { messageListeners.push(listener); },
      removeListener: (listener: MessageListener) => {
        const index = messageListeners.indexOf(listener);
        if (index >= 0) messageListeners.splice(index, 1);
      },
      hasListener: (listener: MessageListener) => messageListeners.includes(listener)
    },
    sendMessage(message: unknown, callback?: (response: unknown) => void) {
      const request = isMessage(message) ? message : {};
      messages.push(request);
      const responder = typeof request.action === 'string' ? replies[request.action] : undefined;
      if (responder === 'never') {
        return;
      }
      const response = responder ? responder(request) : { ok: true };
      if (callback) {
        setTimeout(() => callback(response), 0);
      }
    }
  };
  const chrome = {
    runtime,
    storage: {
      sync: createArea({ ...(options.sync || {}) }, storageWrites),
      local: createArea({ ...(options.local || {}) }, storageWrites),
      onChanged: {
        addListener: (listener: StorageListener) => { storageListeners.push(listener); },
        removeListener: (listener: StorageListener) => {
          const index = storageListeners.indexOf(listener);
          if (index >= 0) storageListeners.splice(index, 1);
        },
        hasListener: (listener: StorageListener) => storageListeners.includes(listener)
      }
    },
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    }
  };
  return {
    chrome,
    messages,
    messageListeners,
    storageWrites,
    // The actions sent since the last call.
    takeActions(): unknown[] {
      return messages.splice(0).map((message) => message.action);
    },
    // A change another page made to a stored value.
    changeStorage(area: string, key: string, newValue: unknown, oldValue?: unknown) {
      storageListeners.slice().forEach((listener) => listener({ [key]: { newValue, oldValue } }, area));
    },
    // Sends the content scripts a message from the worker; resolves with the
    // answer, or undefined when no listener keeps the channel open.
    dispatch(message: Message): Promise<unknown> {
      return new Promise((resolve) => {
        let kept = false;
        messageListeners.slice().forEach((listener) => {
          kept = listener(message, {}, resolve) === true || kept;
        });
        if (!kept) resolve(undefined);
      });
    }
  };
}

type ContentChrome = ReturnType<typeof createContentChrome>;

export { createContentChrome };
export type { ContentChrome, ContentChromeOptions };
