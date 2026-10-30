import { afterEach, describe, expect, it, vi } from 'vitest';
import { run as runPromptSubmit } from './ai-prompt-submit';
import { getStrategyConfig } from '../domain/ai-prompt-strategy';

// A provider's chat page reduced to what the prompt submitter reads: an
// editor in a composer, a send button that shows once Enter was pressed (or
// always), and the page's own timing, counted in the submitter's sleeps.

interface PromptPageOptions {
  documentOrigin?: string;
  sendButtonAlwaysVisible?: boolean;
  // The editor takes typed text a moment later, with this suffix.
  deferInsertedText?: boolean;
  insertedTextSuffix?: string;
  onSleep?(page: PromptPage): void;
  onClick?(button: FakeElement, page: PromptPage): void;
}

interface PromptPage {
  editor: FakeElement;
  sendButton: FakeElement;
  activeElement: FakeElement | null;
  enterPressed: boolean;
  sleepsAfterEnter: number;
  totalSleeps: number;
  editorWrites: number;
  pendingInsert: { element: FakeElement; text: string } | null;
  isSendButtonVisible(): boolean;
}

class FakeEvent {
  readonly type: string;
  readonly key: string;

  constructor(type: string, init: { key?: string } = {}) {
    this.type = type;
    this.key = init.key || '';
  }
}

class FakeElement {
  readonly name: string;
  readonly page: () => PromptPage;
  parentElement: FakeElement | null = null;
  className = '';
  disabled = false;
  clickCount = 0;
  attributes: Record<string, string> = {};
  text = '';

  constructor(name: string, page: () => PromptPage) {
    this.name = name;
    this.page = page;
  }

  get innerText(): string {
    return this.text;
  }

  set innerText(value: string) {
    this.page().editorWrites += 1;
    this.text = String(value || '');
  }

  get textContent(): string {
    return this.text;
  }

  set textContent(value: string) {
    this.text = String(value || '');
  }

  get innerHTML(): string {
    return this.text;
  }

  set innerHTML(value: string) {
    this.page().editorWrites += 1;
    this.text = String(value || '').replace(/<[^>]*>/g, '');
  }

  getAttribute(name: string): string {
    return this.attributes[name] || '';
  }

  focus(): void {
    this.page().activeElement = this;
  }

  dispatchEvent(event: FakeEvent): boolean {
    if (this.name === 'editor' && event.type === 'keydown' && event.key === 'Enter') {
      this.page().enterPressed = true;
    }
    return true;
  }

  getBoundingClientRect() {
    if (this.name === 'sendButton') {
      return this.page().isSendButtonVisible()
        ? { width: 40, height: 40, top: 92, right: 290, bottom: 132, left: 250 }
        : { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
    }
    return { width: 280, height: 64, top: 80, right: 300, bottom: 144, left: 20 };
  }

  querySelectorAll(selector: string): FakeElement[] {
    return selector === 'button,[role="button"]' ? [this.page().sendButton] : [];
  }

  click(): void {
    this.clickCount += 1;
  }
}

// Puts the page in place of the document, window and timers the submitter
// runs against; each of its sleeps passes at once and counts.
function installPromptPage(options: PromptPageOptions = {}): PromptPage {
  const read = () => page;
  const editor = new FakeElement('editor', read);
  const composer = new FakeElement('composer', read);
  const root = new FakeElement('root', read);
  const sendButton = new FakeElement('sendButton', read);
  const page: PromptPage = {
    editor,
    sendButton,
    activeElement: null,
    enterPressed: false,
    sleepsAfterEnter: 0,
    totalSleeps: 0,
    editorWrites: 0,
    pendingInsert: null,
    isSendButtonVisible() {
      return options.sendButtonAlwaysVisible === true || (page.enterPressed && page.sleepsAfterEnter > 0);
    }
  };
  editor.attributes.role = 'textbox';
  editor.parentElement = composer;
  composer.parentElement = root;
  const click = sendButton.click.bind(sendButton);
  sendButton.click = () => {
    click();
    if (options.onClick) options.onClick(sendButton, page);
  };
  const isEditorSelector = (selector: string) => selector.includes('ql-editor') ||
    selector.includes('[contenteditable="true"][role="textbox"]') ||
    selector.includes('div[role="textbox"][contenteditable="true"]');

  vi.stubGlobal('Event', FakeEvent);
  vi.stubGlobal('KeyboardEvent', FakeEvent);
  vi.stubGlobal('InputEvent', FakeEvent);
  vi.stubGlobal('HTMLTextAreaElement', class HTMLTextAreaElement {});
  vi.stubGlobal('HTMLInputElement', class HTMLInputElement {});
  vi.stubGlobal('setTimeout', (done: () => void) => {
    page.totalSleeps += 1;
    if (page.pendingInsert) {
      page.pendingInsert.element.innerText = page.pendingInsert.text;
      page.pendingInsert = null;
    }
    if (options.onSleep) options.onSleep(page);
    if (page.enterPressed) page.sleepsAfterEnter += 1;
    void Promise.resolve().then(done);
    return 1;
  });
  vi.stubGlobal('window', {
    location: { origin: options.documentOrigin || 'https://chatgpt.com' },
    getComputedStyle(element: FakeElement) {
      const visible = element.name !== 'sendButton' || page.isSendButtonVisible();
      return { display: visible ? 'block' : 'none', visibility: visible ? 'visible' : 'hidden', pointerEvents: 'auto', opacity: '1' };
    },
    getSelection: () => ({ removeAllRanges() {}, addRange() {} })
  });
  vi.stubGlobal('document', {
    querySelectorAll(selector: string) {
      if (isEditorSelector(selector)) return [editor];
      return selector === 'button[data-testid="send-button"]' ? [sendButton] : [];
    },
    createRange: () => ({ selectNodeContents() {} }),
    execCommand(command: string, _showUi: boolean, value: string) {
      if (command !== 'insertText' || !page.activeElement) return false;
      const text = value + (options.insertedTextSuffix || '');
      if (options.deferInsertedText) {
        page.pendingInsert = { element: page.activeElement, text };
      } else {
        page.activeElement.innerText = text;
      }
      return true;
    }
  });
  return page;
}

// Runs the submitter as the worker injects it into a tab at expectedUrl.
function submit(strategy: string, prompt: string, expectedUrl = 'https://chatgpt.com/') {
  return runPromptSubmit({
    type: 'submit',
    allowedOrigin: new URL(expectedUrl).origin,
    prompt: prompt.trim(),
    strategy: getStrategyConfig(strategy)
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitting a prompt in an AI provider page', () => {
  it("presses Enter on Gemini and clicks the send button once it shows", async () => {
    const page = installPromptPage({ documentOrigin: 'https://gemini.google.com' });
    const result = await submit('geminiPrompt', 'Explain Lumno', 'https://gemini.google.com/app');

    expect(result).toMatchObject({ ok: true, method: 'enter-button' });
    expect(page.sendButton.clickCount).toBe(1);
  });

  it('leaves a prompt ChatGPT prefilled from ?q= as it is, so its web search pill is not sent alone', async () => {
    const page = installPromptPage({
      sendButtonAlwaysVisible: true,
      onSleep(current) {
        // ChatGPT applies ?q= after hydration, next to the web search pill.
        if (current.totalSleeps === 3) current.editor.text = '网页搜索 这个插件支持和tasks插件联动吗？ https://github.com/example/repo';
      }
    });
    const result = await submit('chatgptPrompt', '这个插件支持和tasks插件联动吗？\nhttps://github.com/example/repo',
      'https://chatgpt.com/?hints=search&ref=ext&q=x');

    expect(result).toEqual({ ok: true, method: 'prefill-button' });
    expect(page.editorWrites).toBe(0);
    expect(page.sendButton.clickCount).toBe(1);
  });

  it('fills ChatGPT itself when the page ignores ?q=', async () => {
    const page = installPromptPage({ sendButtonAlwaysVisible: true });
    const result = await submit('chatgptPrompt', 'Explain Lumno', 'https://chatgpt.com/?q=Explain%20Lumno');

    expect(result).toEqual({ ok: true, method: 'button' });
    expect(page.editor.innerText).toBe('Explain Lumno');
    expect(page.sendButton.clickCount).toBe(1);
  });

  it('clicks send on Qwen Chat again while the prompt is still in the composer', async () => {
    const page = installPromptPage({
      documentOrigin: 'https://chat.qwen.ai',
      sendButtonAlwaysVisible: true,
      onClick(button, current) {
        // A freshly loaded Qwen Chat ignores the first sends, then clears the composer.
        if (button.clickCount === 3) current.editor.text = '';
      }
    });
    const result = await submit('qwenChatPrompt', 'Explain Lumno', 'https://chat.qwen.ai/');

    expect(result).toEqual({ ok: true, method: 'enter-button' });
    expect(page.sendButton.clickCount).toBe(3);
    expect(page.editor.innerText).toBe('');
  });

  it("counts Copilot's late, padded typed text as filled and does not overwrite its editor", async () => {
    const page = installPromptPage({ documentOrigin: 'https://copilot.com', deferInsertedText: true, insertedTextSuffix: '​‌' });
    const result = await submit('copilotPrompt', 'Explain Lumno', 'https://copilot.com/chat');

    expect(result.ok).toBe(true);
    expect(page.editorWrites).toBe(1);
  });

  it('checks the document origin in the page before writing the prompt', async () => {
    const page = installPromptPage({ documentOrigin: 'https://attacker.example' });
    const result = await submit('chatgptPrompt', 'Private prompt');

    expect(result).toEqual({ ok: false, reason: 'unexpected-document-origin' });
    expect(page.editor.innerText).toBe('');
  });
});
