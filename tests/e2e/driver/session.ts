// One attached target (a page or the service worker): evaluating in it,
// polling it, and trusted input through the protocol.
import { arrayAt, isRecord, numberAt, recordAt, stringAt, type CdpConnection } from './cdp';

const KEYS: Record<string, { code: string; keyCode: number }> = {
  Enter: { code: 'Enter', keyCode: 13 },
  Escape: { code: 'Escape', keyCode: 27 },
  Tab: { code: 'Tab', keyCode: 9 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  Alt: { code: 'AltLeft', keyCode: 18 },
  Shift: { code: 'ShiftLeft', keyCode: 16 },
  q: { code: 'KeyQ', keyCode: 81 }
};

// CDP modifier bits.
const MODIFIERS = { Alt: 1, Control: 2, Meta: 4, Shift: 8 };
export type Modifier = keyof typeof MODIFIERS;

export interface InputOptions {
  modifiers?: Modifier[];
}

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

// Reads one element inside a shadow root, run in the page with the element as `this`.
export type ElementReader = (this: Element) => unknown;

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const modifierBits = (modifiers: Modifier[] = []) => modifiers.reduce((sum, name) => sum + MODIFIERS[name], 0);
const keyOf = (key: string) => KEYS[key] || { code: key, keyCode: 0 };

function describeException(details: unknown): string {
  const exception = recordAt(details, 'exception');
  return stringAt(exception, 'description') || stringAt(details, 'text');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// The node in a DOM.getDocument tree (shadow roots and frames included)
// whose id attribute is `id`.
function findNodeById(node: unknown, id: string): unknown {
  if (!isRecord(node)) {
    return null;
  }
  const attributes = arrayAt(node, 'attributes');
  for (let index = 0; index < attributes.length; index += 2) {
    if (attributes[index] === 'id' && attributes[index + 1] === id) {
      return node;
    }
  }
  const document = node.contentDocument;
  const children = [...arrayAt(node, 'children'), ...arrayAt(node, 'shadowRoots'), ...(document ? [document] : [])];
  for (const child of children) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

export function createSession(cdp: CdpConnection, sessionId: string) {
  async function evaluate(expression: string): Promise<unknown> {
    const reply = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (isRecord(reply.exceptionDetails)) {
      throw new Error(describeException(reply.exceptionDetails));
    }
    return recordAt(reply, 'result').value;
  }

  // Polls an expression until it returns a truthy value, and returns that.
  async function waitFor(expression: string, { timeout = 5000, interval = 100, message }: WaitOptions = {}): Promise<unknown> {
    const deadline = Date.now() + timeout;
    let last: unknown;
    while (Date.now() < deadline) {
      try {
        last = await evaluate(expression);
        if (last) return last;
      } catch (error) {
        last = errorMessage(error);
      }
      await delay(interval);
    }
    throw new Error(`${message || `timed out waiting for ${expression}`} (last: ${JSON.stringify(last)})`);
  }

  async function dispatchKey(type: string, key: string, options: InputOptions = {}, extra: Record<string, unknown> = {}): Promise<void> {
    const { code, keyCode } = keyOf(key);
    await cdp.send('Input.dispatchKeyEvent', {
      type, key, code, windowsVirtualKeyCode: keyCode, modifiers: modifierBits(options.modifiers), ...extra
    }, sessionId);
  }

  async function press(key: string, options: InputOptions = {}): Promise<void> {
    await dispatchKey('keyDown', key, options);
    await dispatchKey('keyUp', key, options);
  }

  const keyDown = (key: string, options: InputOptions = {}) => dispatchKey('rawKeyDown', key, options);
  const keyUp = (key: string, options: InputOptions = {}) => dispatchKey('keyUp', key, options);

  async function type(text: string): Promise<void> {
    await cdp.send('Input.insertText', { text }, sessionId);
  }

  // Types lowercase letters as key presses, so key listeners see each one.
  async function typeKeys(text: string): Promise<void> {
    for (const key of text) {
      const base = { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) };
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: key }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
    }
  }

  async function click(x: number, y: number, options: InputOptions = {}): Promise<void> {
    const modifiers = modifierBits(options.modifiers);
    const base = { x, y, button: 'left', clickCount: 1, modifiers };
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base }, sessionId);
  }

  // Runs `read` on each element matching `selector` inside the shadow root
  // of #hostId, closed shadow roots included, which page scripts cannot
  // reach. Returns the results, or null when there is no such host.
  async function inShadow(hostId: string, selector: string, read: ElementReader): Promise<unknown[] | null> {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true }, sessionId);
    const host = findNodeById(root, hostId);
    const [shadowRoot] = arrayAt(host, 'shadowRoots');
    const nodeId = numberAt(shadowRoot, 'nodeId');
    if (nodeId === null) {
      return null;
    }
    // One call on the shadow root queries and reads the elements together,
    // so a re-render cannot swap them out in between.
    const resolved = await cdp.send('DOM.resolveNode', { nodeId }, sessionId);
    const reply = await cdp.send('Runtime.callFunctionOn', {
      objectId: stringAt(recordAt(resolved, 'object'), 'objectId'),
      functionDeclaration: `function (selector) {
        const read = ${read.toString()};
        return Array.from(this.querySelectorAll(selector), (element) => read.call(element));
      }`,
      arguments: [{ value: selector }],
      returnByValue: true,
      awaitPromise: true
    }, sessionId);
    if (isRecord(reply.exceptionDetails)) {
      throw new Error(describeException(reply.exceptionDetails));
    }
    const value = recordAt(reply, 'result').value;
    return Array.isArray(value) ? value : null;
  }

  async function waitForShadow(
    hostId: string,
    selector: string,
    read: ElementReader,
    predicate: (results: unknown[]) => boolean,
    { timeout = 5000, message }: WaitOptions = {}
  ): Promise<unknown[]> {
    const deadline = Date.now() + timeout;
    let last: unknown = null;
    while (Date.now() < deadline) {
      try {
        const results = await inShadow(hostId, selector, read);
        last = results;
        if (results && predicate(results)) return results;
      } catch (error) {
        // The host or its shadow root was replaced while it was being read.
        last = errorMessage(error);
      }
      await delay(150);
    }
    throw new Error(`${message || `timed out waiting for ${selector} in #${hostId}`} (last: ${JSON.stringify(last)})`);
  }

  // Navigates and waits until the new document has loaded.
  async function goto(url: string): Promise<void> {
    await cdp.send('Page.navigate', { url }, sessionId);
    await waitFor(`location.href !== 'about:blank' && document.readyState === 'complete'`, {
      timeout: 15000,
      message: `${url} did not load`
    });
  }

  return { sessionId, evaluate, waitFor, goto, press, keyDown, keyUp, type, typeKeys, click, inShadow, waitForShadow };
}

export type Session = ReturnType<typeof createSession>;
