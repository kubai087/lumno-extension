const assert = require('assert');
const submitRuntime = require('../src/background/ai-provider-submit.js');

class FakeEvent {
  constructor(type, options) {
    this.type = type;
    Object.assign(this, options || {});
  }
}

class FakeElement {
  constructor(name, env) {
    this.name = name;
    this.env = env;
    this.parentElement = null;
    this.className = '';
    this.disabled = false;
    this.clickCount = 0;
    this.events = [];
    this.attributes = {};
    this._text = '';
  }

  get innerText() {
    return this._text;
  }

  set innerText(value) {
    this.env.editorWrites += 1;
    this._text = String(value || '');
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value || '');
  }

  get innerHTML() {
    return this._text;
  }

  set innerHTML(value) {
    this.env.editorWrites += 1;
    this._text = String(value || '').replace(/<[^>]*>/g, '');
  }

  getAttribute(name) {
    return this.attributes[name] || '';
  }

  focus() {
    this.env.activeElement = this;
  }

  dispatchEvent(event) {
    this.events.push(event);
    if (this.name === 'editor' && event.type === 'keydown' && event.key === 'Enter') {
      this.env.enterPressed = true;
    }
    return true;
  }

  getBoundingClientRect() {
    if (this.name === 'sendButton' && !this.env.isSendButtonVisible()) {
      return { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
    }
    if (this.name === 'sendButton') {
      return { width: 40, height: 40, top: 92, right: 290, bottom: 132, left: 250 };
    }
    return { width: 280, height: 64, top: 80, right: 300, bottom: 144, left: 20 };
  }

  querySelectorAll(selector) {
    if (selector === 'button,[role="button"]') {
      return [this.env.sendButton];
    }
    return [];
  }

  click() {
    this.clickCount += 1;
  }
}

function withFakePromptDom(callback, options) {
  const settings = options && typeof options === 'object' ? options : {};
  const original = {
    document: global.document,
    window: global.window,
    Event: global.Event,
    KeyboardEvent: global.KeyboardEvent,
    InputEvent: global.InputEvent,
    HTMLTextAreaElement: global.HTMLTextAreaElement,
    HTMLInputElement: global.HTMLInputElement,
    setTimeout: global.setTimeout
  };

  const env = {
    activeElement: null,
    enterPressed: false,
    sleepsAfterEnter: 0,
    editorWrites: 0,
    totalSleeps: 0,
    isSendButtonVisible() {
      if (settings.sendButtonAlwaysVisible) {
        return true;
      }
      return this.enterPressed && this.sleepsAfterEnter > 0;
    }
  };

  const editor = new FakeElement('editor', env);
  const composer = new FakeElement('composer', env);
  const root = new FakeElement('root', env);
  const sendButton = new FakeElement('sendButton', env);
  env.editor = editor;
  env.sendButton = sendButton;
  editor.attributes.role = 'textbox';
  editor.parentElement = composer;
  composer.parentElement = root;

  function queryEditor(selector) {
    return (
      selector.includes('ql-editor') ||
      selector.includes('[contenteditable="true"][role="textbox"]') ||
      selector.includes('div[role="textbox"][contenteditable="true"]')
    );
  }

  global.Event = FakeEvent;
  global.KeyboardEvent = FakeEvent;
  global.InputEvent = FakeEvent;
  global.HTMLTextAreaElement = class HTMLTextAreaElement {};
  global.HTMLInputElement = class HTMLInputElement {};
  global.setTimeout = (done) => {
    env.totalSleeps += 1;
    if (typeof settings.onSleep === 'function') {
      settings.onSleep(env);
    }
    if (env.enterPressed) {
      env.sleepsAfterEnter += 1;
    }
    Promise.resolve().then(done);
    return 1;
  };
  global.window = {
    location: {
      origin: settings.documentOrigin || 'https://chatgpt.com'
    },
    getComputedStyle(element) {
      const visible = element.name !== 'sendButton' || env.isSendButtonVisible();
      return {
        display: visible ? 'block' : 'none',
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: 'auto',
        opacity: '1'
      };
    },
    getSelection() {
      return {
        removeAllRanges() {},
        addRange() {}
      };
    }
  };
  global.document = {
    querySelectorAll(selector) {
      if (queryEditor(selector)) {
        return [editor];
      }
      if (selector === 'button[data-testid="send-button"]') {
        return [sendButton];
      }
      return [];
    },
    createRange() {
      return {
        selectNodeContents() {}
      };
    },
    execCommand(command, _showUi, value) {
      if (command === 'insertText' && env.activeElement) {
        env.activeElement.innerText = value;
        return true;
      }
      return false;
    }
  };

  return Promise.resolve()
    .then(() => callback(env))
    .finally(() => {
      global.document = original.document;
      global.window = original.window;
      global.Event = original.Event;
      global.KeyboardEvent = original.KeyboardEvent;
      global.InputEvent = original.InputEvent;
      global.HTMLTextAreaElement = original.HTMLTextAreaElement;
      global.HTMLInputElement = original.HTMLInputElement;
      global.setTimeout = original.setTimeout;
    });
}

function submitWithFakeChrome(strategyName, prompt, options) {
  const settings = options && typeof options === 'object' ? options : {};
  const expectedUrl = settings.expectedUrl || 'https://chatgpt.com/';
  const observations = settings.observations || {};
  observations.tabGetCount = 0;
  observations.executeCount = 0;
  const chromeApi = {
    runtime: {},
    tabs: {
      get(tabId, callback) {
        observations.tabGetCount += 1;
        callback({ id: tabId, url: settings.tabUrl || expectedUrl });
      }
    },
    scripting: {
      executeScript(details, callback) {
        observations.executeCount += 1;
        Promise.resolve(details.func(...details.args))
          .then((result) => callback([{ result }]))
          .catch((error) => callback([{ result: { ok: false, reason: error.message } }]));
      }
    }
  };
  return submitRuntime.submitPromptInTab(chromeApi, 1, prompt, strategyName, expectedUrl);
}

async function run() {
  await withFakePromptDom(async (env) => {
    const observations = {};
    const result = await submitWithFakeChrome('geminiPrompt', 'Explain Lumno', {
      expectedUrl: 'https://gemini.google.com/app',
      observations
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(
      result.method,
      'enter-button',
      'Gemini should keep watching for a nearby send button after Enter'
    );
    assert.strictEqual(env.sendButton.clickCount, 1, 'Gemini send button should be clicked once it appears');
    assert.strictEqual(observations.executeCount, 1);
  }, { documentOrigin: 'https://gemini.google.com' });

  await withFakePromptDom(async (env) => {
    const prompt = '这个插件支持和tasks插件联动吗？\nhttps://github.com/example/repo';
    const result = await submitWithFakeChrome('chatgptPrompt', prompt, {
      expectedUrl: 'https://chatgpt.com/?hints=search&ref=ext&q=x'
    });
    assert.deepStrictEqual(result, { ok: true, method: 'prefill-button' });
    assert.strictEqual(env.editorWrites, 0,
      'ChatGPT prefilled from ?q= must not be rewritten, or the web search pill gets sent alone');
    assert.strictEqual(env.sendButton.clickCount, 1);
  }, {
    sendButtonAlwaysVisible: true,
    onSleep(env) {
      // ChatGPT applies ?q= after hydration, next to the web search pill.
      if (env.totalSleeps === 3) {
        env.editor._text = '网页搜索 这个插件支持和tasks插件联动吗？ https://github.com/example/repo';
      }
    }
  });

  await withFakePromptDom(async (env) => {
    const result = await submitWithFakeChrome('chatgptPrompt', 'Explain Lumno', {
      expectedUrl: 'https://chatgpt.com/?q=Explain%20Lumno'
    });
    assert.deepStrictEqual(result, { ok: true, method: 'button' });
    assert.strictEqual(env.editor.innerText, 'Explain Lumno',
      'ChatGPT should still be filled by Lumno when the page ignores ?q=');
    assert.strictEqual(env.sendButton.clickCount, 1);
  }, { sendButtonAlwaysVisible: true });

  const expectedStrategyOrigins = {
    geminiPrompt: 'https://gemini.google.com',
    chatgptPrompt: 'https://chatgpt.com',
    doubaoPrompt: 'https://www.doubao.com',
    qianwenQuery: 'https://www.qianwen.com',
    yuanbaoPrompt: 'https://yuanbao.tencent.com',
    minimaxPrompt: 'https://chat.minimax.io',
    deepseekPrompt: 'https://chat.deepseek.com',
    kimiPrompt: 'https://www.kimi.com'
  };
  Object.entries(expectedStrategyOrigins).forEach(([strategy, origin]) => {
    assert.deepStrictEqual(submitRuntime.getAllowedStrategyOrigins(strategy), [origin]);
    assert.strictEqual(submitRuntime.isAllowedStrategyOrigin(strategy, origin), true);
    assert.strictEqual(origin.startsWith('https://'), true);
  });

  const maliciousOriginObservations = {};
  const maliciousOrigin = await submitWithFakeChrome('chatgptPrompt', 'Private prompt', {
    expectedUrl: 'https://attacker.example/chat',
    observations: maliciousOriginObservations
  });
  assert.deepStrictEqual(maliciousOrigin, { ok: false, reason: 'unapproved-submit-origin' });
  assert.strictEqual(maliciousOriginObservations.tabGetCount, 0);
  assert.strictEqual(maliciousOriginObservations.executeCount, 0,
    'an attacker-controlled expected origin must be rejected before tab access or DOM injection');

  const insecureOfficialOrigin = await submitWithFakeChrome('chatgptPrompt', 'Private prompt', {
    expectedUrl: 'http://chatgpt.com/'
  });
  assert.deepStrictEqual(insecureOfficialOrigin, { ok: false, reason: 'unapproved-submit-origin' },
    'interactive strategies must allow only their official HTTPS origins');

  const redirectedObservations = {};
  const redirected = await submitWithFakeChrome('chatgptPrompt', 'Private prompt', {
    expectedUrl: 'https://chatgpt.com/',
    tabUrl: 'https://attacker.example/redirected',
    observations: redirectedObservations
  });
  assert.deepStrictEqual(redirected, { ok: false, reason: 'unexpected-tab-origin' });
  assert.strictEqual(redirectedObservations.tabGetCount, 1);
  assert.strictEqual(redirectedObservations.executeCount, 0,
    'a redirected tab must be rejected before prompt-bearing script injection');

  await withFakePromptDom(async (env) => {
    const observations = {};
    const navigatedDuringInjection = await submitWithFakeChrome('chatgptPrompt', 'Private prompt', {
      expectedUrl: 'https://chatgpt.com/',
      tabUrl: 'https://chatgpt.com/conversation',
      observations
    });
    assert.deepStrictEqual(navigatedDuringInjection, { ok: false, reason: 'unexpected-document-origin' });
    assert.strictEqual(observations.executeCount, 1);
    assert.strictEqual(env.editor.innerText, '',
      'the document-side check must run before the prompt is written');
  }, { documentOrigin: 'https://attacker.example' });

  const invalidExpected = await submitWithFakeChrome('chatgptPrompt', 'Private prompt', {
    expectedUrl: 'chrome://newtab/'
  });
  assert.deepStrictEqual(invalidExpected, { ok: false, reason: 'invalid-expected-origin' });

  const alternatePort = await submitWithFakeChrome('chatgptPrompt', 'Private prompt', {
    expectedUrl: 'https://chatgpt.com/',
    tabUrl: 'https://chatgpt.com:444/conversation'
  });
  assert.deepStrictEqual(alternatePort, { ok: false, reason: 'unexpected-tab-origin' },
    'origin validation must include the effective port');

  const urlOnlyObservations = {};
  const officialUrlOnly = await submitWithFakeChrome('qianwenQuery', 'Private prompt', {
    expectedUrl: 'https://www.qianwen.com/?q=Private%20prompt',
    observations: urlOnlyObservations
  });
  assert.deepStrictEqual(officialUrlOnly, { ok: true, method: 'url' });
  assert.strictEqual(urlOnlyObservations.tabGetCount, 0);
  assert.strictEqual(urlOnlyObservations.executeCount, 0,
    'an approved URL-only strategy must not inject a script');

  const maliciousUrlOnlyObservations = {};
  const maliciousUrlOnly = await submitWithFakeChrome('qianwenQuery', 'Private prompt', {
    expectedUrl: 'https://attacker.example/?q=Private%20prompt',
    observations: maliciousUrlOnlyObservations
  });
  assert.deepStrictEqual(maliciousUrlOnly, { ok: false, reason: 'unapproved-submit-origin' });
  assert.strictEqual(maliciousUrlOnlyObservations.tabGetCount, 0);
  assert.strictEqual(maliciousUrlOnlyObservations.executeCount, 0);

  console.log('ai provider submit tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
