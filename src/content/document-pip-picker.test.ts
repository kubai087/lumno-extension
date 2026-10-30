import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContentChrome } from '../../tests/fakes/content-chrome';
import type { ContentChrome } from '../../tests/fakes/content-chrome';
import { trackPageListeners } from '../../tests/fakes/content-page';
import { required } from '../../tests/fakes/dom';

// The web clip picker on an article page, with a Document Picture-in-Picture
// API whose floating window is an iframe's window.
interface ClipPage {
  fake: ContentChrome;
  events: string[];
  pipWindows: Window[];
  scrolledTo: string[];
  attachShadow: ReturnType<typeof spyOnAttachShadow>;
  toggle(): unknown;
}

let removeListeners: (() => void) | null = null;

function spyOnAttachShadow() {
  return vi.spyOn(Element.prototype, 'attachShadow');
}

function pointAt(id: string): void {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.getElementById(id) });
}

async function openPage(): Promise<ClipPage> {
  document.title = 'Article';
  const article = new DOMParser().parseFromString(`<main><section id="card"><h2 id="headline">Live score</h2><p id="score">1 : 0</p>
      <a id="script-link" href="#">Expand</a>
      <a id="anchor-link" href="#score">Jump to score</a>
      <a id="other-link" href="https://other.example.test/story">Story</a>
    </section></main>`, 'text/html');
  document.body.replaceChildren(...Array.from(article.body.children, (node) => document.importNode(node, true)));
  removeListeners = trackPageListeners();
  const events: string[] = [];
  const pipWindows: Window[] = [];
  const scrolledTo: string[] = [];
  const attachShadow = spyOnAttachShadow();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 10, y: 10, width: 400, height: 200 }));
  pointAt('score');
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('documentPictureInPicture', {
    requestWindow: () => {
      events.push('requestWindow');
      const frame = document.createElement('iframe');
      document.documentElement.appendChild(frame);
      const pip = required(frame.contentWindow, 'the floating window');
      Object.defineProperty(pip, 'close', { configurable: true, value: () => { events.push('pipClose'); } });
      pipWindows.push(pip);
      return Promise.resolve(pip);
    }
  });
  const fake = createContentChrome({
    replies: { pipRequestOwnership: () => ({ ok: true, granted: true, token: 'owner-1' }) }
  });
  const sendMessage = fake.chrome.runtime.sendMessage;
  fake.chrome.runtime.sendMessage = (message, callback) => {
    if (typeof message === 'object' && message !== null && 'action' in message) events.push(`message:${String(message.action)}`);
    if (sendMessage) sendMessage(message, callback);
  };
  vi.stubGlobal('chrome', fake.chrome);
  vi.resetModules();
  const picker = await import('./document-pip-picker');
  return { fake, events, pipWindows, scrolledTo, attachShadow, toggle: () => picker.run({ type: 'toggle' }) };
}

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function pipDocument(page: ClipPage): Document {
  return required(page.pipWindows[0], 'the floating window').document;
}

async function openClip(): Promise<ClipPage> {
  const page = await openPage();
  expect(page.toggle()).toEqual({ ok: true, state: 'started' });
  document.getElementById('score')?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 50 }));
  press('ArrowUp');
  press('Enter');
  await vi.advanceTimersByTimeAsync(50);
  return page;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  if (removeListeners) removeListeners();
  removeListeners = null;
  Reflect.deleteProperty(document, 'elementFromPoint');
  document.querySelectorAll('iframe').forEach((frame) => frame.remove());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('document PiP picker', () => {
  it('shows its hint through the shared Toast in a closed shadow root', async () => {
    const page = await openPage();
    page.toggle();
    const index = page.attachShadow.mock.results.findIndex((result) => result.type === 'return' &&
      result.value.querySelector('.x-lumno-toast') !== null);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(page.attachShadow.mock.calls[index][0].mode).toBe('closed');
    const result = page.attachShadow.mock.results[index];
    const root = result.type === 'return' ? result.value : null;
    expect(root?.querySelector('link[rel="stylesheet"][href="chrome-extension://lumno-test/src/shared/ui/toast.css"]')).not.toBeNull();
  });

  it('opens the picked element in the floating window before any round trip', async () => {
    const page = await openClip();
    // A message to the background first would spend the click's activation.
    expect(page.events[0]).toBe('requestWindow');
    expect(page.events).toContain('message:pipRequestOwnership');
    expect(pipDocument(page).body.textContent).toContain('1 : 0');
  });

  it('keeps the copy in sync with the page', async () => {
    const page = await openClip();
    const score = required(document.getElementById('score')?.firstChild, '#score text');
    score.textContent = '2 : 0';
    await vi.advanceTimersByTimeAsync(200);
    expect(pipDocument(page).body.textContent).toContain('2 : 0');
    document.getElementById('headline')?.setAttribute('data-state', 'final');
    await vi.advanceTimersByTimeAsync(200);
    expect(pipDocument(page).querySelector('[data-state="final"]')).not.toBeNull();
  });

  it('keeps links in the copy from navigating the floating window', async () => {
    const page = await openClip();
    const pip = pipDocument(page);
    const scrollTarget = required(pip.getElementById('score'), 'the copied #score');
    scrollTarget.scrollIntoView = () => { page.scrolledTo.push(scrollTarget.id); };
    const click = (id: string): MouseEvent => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      required(pip.getElementById(id), `the copied #${id}`).dispatchEvent(event);
      return event;
    };
    const before = page.fake.messages.length;

    expect(click('script-link').defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(10);
    // An href="#" link does not open the page again in a new tab.
    expect(page.fake.messages).toHaveLength(before);

    click('anchor-link');
    await vi.advanceTimersByTimeAsync(10);
    expect(page.fake.messages).toHaveLength(before);
    expect(page.scrolledTo).toEqual(['score']);

    click('other-link');
    await vi.advanceTimersByTimeAsync(10);
    expect(page.fake.messages.slice(before)).toEqual([
      { action: 'createTab', url: 'https://other.example.test/story', disposition: 'newTab' }
    ]);
  });

  it('closes the clip and hands ownership back when toggled again', async () => {
    const page = await openClip();
    expect(page.toggle()).toEqual({ ok: true, state: 'closed' });
    expect(page.events).toContain('pipClose');
    await vi.advanceTimersByTimeAsync(10);
    expect(page.fake.messages).toContainEqual({ action: 'pipReleaseOwnership', token: 'owner-1' });
  });

  it('ends the selection on Escape and refuses an element with video', async () => {
    const page = await openPage();
    page.toggle();
    press('Escape');
    expect(page.toggle()).toEqual({ ok: true, state: 'started' });
    const card = required(document.getElementById('card'), '#card');
    card.appendChild(document.createElement('video'));
    pointAt('card');
    card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 50 }));
    press('Enter');
    await vi.advanceTimersByTimeAsync(20);
    expect(page.pipWindows).toEqual([]);
  });
});
