'use strict';

// A throwaway headless Chrome with this extension loaded, driven over a CDP
// pipe. Extensions.loadUnpacked loads the extension, so branded Chrome works
// as well as Chrome for Testing.
//
// Every uncaught exception, console error and failed load from the extension
// (its pages, worker and content scripts) is collected in `failures`; failed
// loads from other origins (remote images, wallpapers) only land in `notes`.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_CANDIDATES = [
  process.env.LUMNO_E2E_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const KEYS = {
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;
}

// CDP over --remote-debugging-pipe: fd 3 carries requests, fd 4 responses,
// each message terminated by a NUL byte.
function createPipeConnection(child) {
  const writer = child.stdio[3];
  const reader = child.stdio[4];
  const pending = new Map();
  const listeners = [];
  let nextId = 1;
  let buffer = '';
  reader.on('data', (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, method } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result || {});
      } else {
        listeners.forEach((listener) => listener(message));
      }
    }
  });
  return {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      writer.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
    },
    onEvent(listener) {
      listeners.push(listener);
    }
  };
}

function shortUrl(url) {
  return url.replace(/^chrome-extension:\/\/[a-z]+\//, '');
}

// One attached target (a page or the service worker).
function createSession(cdp, sessionId) {
  async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception ? exceptionDetails.exception.description : exceptionDetails.text);
    }
    return result.value;
  }

  // Polls an expression until it returns a truthy value.
  async function waitFor(expression, { timeout = 5000, interval = 100, message } = {}) {
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
      try {
        last = await evaluate(expression);
        if (last) return last;
      } catch (error) {
        last = error.message;
      }
      await delay(interval);
    }
    throw new Error(`${message || `timed out waiting for ${expression}`} (last: ${JSON.stringify(last)})`);
  }

  async function press(key, { modifiers = [] } = {}) {
    const { code, keyCode } = KEYS[key] || { code: key, keyCode: 0 };
    const bits = modifiers.reduce((sum, name) => sum + MODIFIERS[name], 0);
    const base = { key, code, windowsVirtualKeyCode: keyCode, modifiers: bits };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
  }

  async function keyDown(key, { modifiers = [] } = {}) {
    const { code, keyCode } = KEYS[key] || { code: key, keyCode: 0 };
    const bits = modifiers.reduce((sum, name) => sum + MODIFIERS[name], 0);
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers: bits }, sessionId);
  }

  async function keyUp(key, { modifiers = [] } = {}) {
    const { code, keyCode } = KEYS[key] || { code: key, keyCode: 0 };
    const bits = modifiers.reduce((sum, name) => sum + MODIFIERS[name], 0);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers: bits }, sessionId);
  }

  async function type(text) {
    await cdp.send('Input.insertText', { text }, sessionId);
  }

  // Types lowercase letters as key presses, so key listeners see each one.
  async function typeKeys(text) {
    for (const key of text) {
      const base = { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) };
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: key }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
    }
  }

  async function click(x, y, { modifiers = [] } = {}) {
    const bits = modifiers.reduce((sum, name) => sum + MODIFIERS[name], 0);
    const base = { x, y, button: 'left', clickCount: 1, modifiers: bits };
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers: bits }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base }, sessionId);
  }

  // Runs fn(element, ...args) on each element matching `selector` inside the
  // shadow root of #hostId; closed shadow roots included, which page scripts
  // cannot reach. Returns the results, or null when there is no such host.
  async function inShadow(hostId, selector, fn, ...args) {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true }, sessionId);
    const findHost = (node) => {
      if (!node) return null;
      const attributes = node.attributes || [];
      for (let index = 0; index < attributes.length; index += 2) {
        if (attributes[index] === 'id' && attributes[index + 1] === hostId) return node;
      }
      for (const child of (node.children || []).concat(node.shadowRoots || [], node.contentDocument || [])) {
        const found = findHost(child);
        if (found) return found;
      }
      return null;
    };
    const host = findHost(root);
    if (!host) return null;
    const shadowRoot = (host.shadowRoots || [])[0];
    if (!shadowRoot) return null;
    // One call on the shadow root queries and reads the elements together,
    // so a re-render cannot swap them out in between.
    const { object } = await cdp.send('DOM.resolveNode', { nodeId: shadowRoot.nodeId }, sessionId);
    const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration: `function (selector, args) {
        const read = ${fn.toString()};
        return Array.from(this.querySelectorAll(selector), (element) => read.apply(element, args));
      }`,
      arguments: [{ value: selector }, { value: args }],
      returnByValue: true,
      awaitPromise: true
    }, sessionId);
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception ? exceptionDetails.exception.description : exceptionDetails.text);
    }
    return result.value;
  }

  async function waitForShadow(hostId, selector, fn, predicate, { timeout = 5000, message } = {}) {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
      try {
        last = await inShadow(hostId, selector, fn);
        if (last && predicate(last)) return last;
      } catch (error) {
        // The host or its shadow root was replaced while it was being read.
        last = error.message;
      }
      await delay(150);
    }
    throw new Error(`${message || `timed out waiting for ${selector} in #${hostId}`} (last: ${JSON.stringify(last)})`);
  }

  // Navigates and waits until the new document has loaded.
  async function goto(url) {
    await cdp.send('Page.navigate', { url }, sessionId);
    await waitFor(`location.href !== 'about:blank' && document.readyState === 'complete'`, {
      timeout: 15000,
      message: `${url} did not load`
    });
  }

  return { sessionId, evaluate, waitFor, goto, press, keyDown, keyUp, type, typeKeys, click, inShadow, waitForShadow };
}

async function launchBrowser({ extensionPath }) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('No Chrome found; set LUMNO_E2E_CHROME.');
  }
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumno-e2e-'));
  const child = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-search-engine-choice-screen',
    '--window-size=1400,900',
    // CI runners do not allow Chrome's user-namespace sandbox.
    ...(process.env.CI ? ['--no-sandbox'] : [])
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const cdp = createPipeConnection(child);
  const labels = new Map();
  const failures = [];
  const notes = [];
  let extensionId = '';

  cdp.onEvent((message) => {
    const label = labels.get(message.sessionId) || 'browser';
    if (message.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = message.params;
      labels.set(sessionId, `${targetInfo.type}:${shortUrl(targetInfo.url)}`);
      cdp.send('Runtime.enable', {}, sessionId).catch(() => {});
      cdp.send('Log.enable', {}, sessionId).catch(() => {});
      cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
    } else if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      const text = (details.exception && details.exception.description) || details.text;
      failures.push(`[${label}] uncaught ${text.split('\n').slice(0, 3).join(' | ')} (${details.url || ''}:${details.lineNumber})`);
    } else if (message.method === 'Runtime.consoleAPICalled'
        && (message.params.type === 'error' || message.params.type === 'assert')) {
      const text = message.params.args.map((arg) => arg.value || arg.description || '').join(' ');
      failures.push(`[${label}] console.${message.params.type} ${text}`);
    } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const { entry } = message.params;
      const line = `[${label}] ${entry.source}: ${entry.text} ${entry.url || ''}`;
      if (entry.url && extensionId && !entry.url.startsWith(`chrome-extension://${extensionId}/`)) {
        notes.push(line);
      } else {
        failures.push(line);
      }
    }
  });

  async function attach(targetId, label) {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    labels.set(sessionId, label);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId).catch(() => {});
    return createSession(cdp, sessionId);
  }

  // Opens a URL in a new tab and waits for its load event.
  async function openPage(url) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const page = await attach(targetId, shortUrl(url));
    page.targetId = targetId;
    await page.goto(url);
    return page;
  }

  async function closePage(page) {
    await cdp.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
  }

  const waitForExit = (ms) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('exit', resolve);
    setTimeout(resolve, ms);
  });

  // Asks Chrome to quit so its helper processes stop writing to the profile,
  // and kills it only if it does not.
  async function close() {
    cdp.send('Browser.close').catch(() => {});
    await waitForExit(5000);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await waitForExit(2000);
    }
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (error) {
      console.warn(`Could not remove ${profileDir}: ${error.message}`);
    }
  }

  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  ({ id: extensionId } = await cdp.send('Extensions.loadUnpacked', { path: extensionPath }));

  // The worker, for dispatching commands and reading extension state.
  let workerTarget = null;
  for (let attempt = 0; attempt < 50 && !workerTarget; attempt += 1) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    workerTarget = targetInfos.find((target) => target.type === 'service_worker' && target.url.includes(extensionId));
    if (!workerTarget) await delay(100);
  }
  if (!workerTarget) {
    await close();
    throw new Error('the service worker did not start');
  }
  const worker = await attach(workerTarget.targetId, 'service_worker');

  return {
    cdp,
    extensionId,
    extensionUrl: (file) => `chrome-extension://${extensionId}/${file}`,
    worker,
    openPage,
    closePage,
    failures,
    notes,
    close
  };
}

module.exports = { delay, findChrome, launchBrowser };
