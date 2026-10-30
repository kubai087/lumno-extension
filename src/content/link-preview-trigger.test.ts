import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkPreviewEnabled, localPrimary } from '../domain/settings';
import { loadLinkPreviewTrigger } from '../../tests/fakes/link-preview-trigger';

const actions = (messages: unknown[]) => messages.map((message) => (message && typeof message === 'object' ? Reflect.get(message, 'action') : ''));

afterEach(() => {
  vi.useRealTimers();
  document.head.replaceChildren();
});

describe('Shift+click on a link', () => {
  it('opens a preview and keeps the whole press from the page and from Chrome', async () => {
    const page = await loadLinkPreviewTrigger();
    const prevented = page.press('out');

    // So sites cannot open it in a tab as well.
    expect(page.claimed).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    // The preview replaces both the selection extension and Chrome's new window.
    expect(prevented).toEqual(['mousedown', 'click']);
    expect(page.sent()).toEqual([
      { action: 'linkPreviewPrepare', url: 'https://other.example/page' },
      { action: 'linkPreviewOpen', url: 'https://other.example/page', origin: { x: 30, y: 40 } }
    ]);
  });

  it('steps aside, for good, once its extension went away', async () => {
    const page = await loadLinkPreviewTrigger();
    // What Chrome leaves to a content script whose extension was reloaded.
    Reflect.deleteProperty(page.fake.chrome.runtime, 'id');

    expect(page.press('out')).toEqual([]);
    expect(page.claimed).toEqual([]);
    expect(page.sent()).toEqual([]);
    expect(page.added).toEqual([]);
  });

  it('cancels a press released away from the link, or with Shift let go before the click', async () => {
    const page = await loadLinkPreviewTrigger();
    page.press('out');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(actions(page.sent())).not.toContain('linkPreviewCancel');

    page.clearSent();
    page.press('out', { skip: ['click'] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(actions(page.sent())).toEqual(['linkPreviewPrepare', 'linkPreviewCancel']);

    page.clearSent();
    page.press('out', { shiftOnClick: false });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(actions(page.sent())).toEqual(['linkPreviewPrepare', 'linkPreviewCancel']);
  });

  it('leaves other presses, jumps, downloads and non-web links to the page', async () => {
    const page = await loadLinkPreviewTrigger();

    expect(page.press('out', { shiftKey: false })).toEqual([]);
    expect(page.press('out', { metaKey: true })).toEqual([]);
    expect(page.press('out', { isTrusted: false })).toEqual([]);
    expect(page.press('hash')).toEqual([]);
    expect(page.press('file')).toEqual([]);
    expect(page.press('mail')).toEqual([]);
    expect(page.sent()).toEqual([]);
    expect(page.claimed).toEqual([]);
  });

  it('previews a clickable address shown as text, and the address a scripted link shows', async () => {
    const page = await loadLinkPreviewTrigger({
      body: `
        <span id="shown" role="link">https://lumno.kubai.design</span>
        <a id="scripted" href="javascript:void(0)"><span id="scripted-text">www.example.org/a</span></a>
        <span id="plain">https://plain.example/text</span>
        <span id="name" role="link">README.md</span>
        <span id="sentence" role="link">see https://other.example/x</span>`
    });
    page.press('shown');
    expect(page.sent()[0]).toMatchObject({ url: 'https://lumno.kubai.design/' });
    page.clearSent();
    page.press('scripted-text');
    expect(page.sent()[0]).toMatchObject({ url: 'https://www.example.org/a' });
    page.clearSent();

    ['plain', 'name', 'sentence'].forEach((id) => expect(page.press(id)).toEqual([]));
    expect(page.sent()).toEqual([]);
  });

  describe('on an X post', () => {
    const post = `
      <article data-testid="tweet">
        <div id="post-body">Tide is now available<div role="button"><span id="like">1</span></div></div>
        <a href="/albertuvw/status/123"><time>38m</time></a>
        <div role="link"><span id="quote">Unfold. Naturally.</span><a href="/tide_fm_app/status/99"><time>51m</time></a></div>
      </article>`;

    it('previews the post from anywhere in it but its buttons', async () => {
      const timeline = await loadLinkPreviewTrigger({ url: 'https://x.com/home', body: post });
      timeline.press('post-body');

      expect(timeline.sent()[0]).toMatchObject({ url: 'https://x.com/albertuvw/status/123' });
      timeline.clearSent();
      expect(timeline.press('like')).toEqual([]);
    });

    it('has nothing to preview on the post’s own page, or off X', async () => {
      expect((await loadLinkPreviewTrigger({ url: 'https://x.com/albertuvw/status/123', body: post })).press('post-body')).toEqual([]);
      expect((await loadLinkPreviewTrigger({ body: post })).press('post-body')).toEqual([]);
    });
  });

  it('cancels the navigations a page starts under the preview, but not Back, Forward or reload', async () => {
    const navigateListeners: ((event: object) => void)[] = [];
    const navigation = {
      canGoBack: false,
      addEventListener(type: string, listener: (event: object) => void) {
        if (type === 'navigate') navigateListeners.push(listener);
      },
      removeEventListener() {}
    };
    const navigate = (navigationType: string) => {
      let cancelled = false;
      navigateListeners.forEach((listener) => listener({ navigationType, cancelable: true, preventDefault: () => { cancelled = true; } }));
      return cancelled;
    };
    const page = await loadLinkPreviewTrigger({ navigation });

    expect(navigate('push')).toBe(false);
    page.press('out');
    expect(navigate('push')).toBe(true);
    expect(navigate('replace')).toBe(true);
    expect(navigate('traverse')).toBe(false);
    expect(navigate('reload')).toBe(false);
  });

  it('follows the link preview switch without a reload, and the local value where settings stay local', async () => {
    const page = await loadLinkPreviewTrigger({ sync: { [linkPreviewEnabled.key]: false } });
    await vi.waitFor(() => expect(page.fake.chrome.storage.sync.get).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(page.press('out')).toEqual([]);
    expect(page.sent()).toEqual([]);
    expect(page.claimed).toEqual([]);
    page.fake.storage.sync.externalSet({ [linkPreviewEnabled.key]: true });
    expect(page.press('out')).toEqual(['mousedown', 'click']);

    const local = await loadLinkPreviewTrigger({
      sync: { [linkPreviewEnabled.key]: true },
      local: { [linkPreviewEnabled.key]: false, [localPrimary.key]: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(local.press('out')).toEqual([]);
    expect(linkPreviewEnabled.parse(undefined)).toBe(true);
  });
});

describe('Shift held over a link', () => {
  it('starts the page loading before the press, which the press then takes over', async () => {
    vi.useFakeTimers();
    const page = await loadLinkPreviewTrigger();
    page.fire('pointerover', 'out', { shiftKey: false });
    await vi.advanceTimersByTimeAsync(200);
    expect(page.sent()).toEqual([]);

    page.fire('keydown', null, { key: 'Shift' });
    await vi.advanceTimersByTimeAsync(200);
    expect(page.sent()).toEqual([{ action: 'linkPreviewPrepare', url: 'https://other.example/page', hover: true }]);
    page.clearSent();
    page.press('out');
    await vi.advanceTimersByTimeAsync(5);
    expect(actions(page.sent())).toEqual(['linkPreviewPrepare', 'linkPreviewOpen']);
    page.fire('keyup', null, { key: 'Shift', shiftKey: false });
    expect(actions(page.sent())).not.toContain('linkPreviewCancel');
  });

  it('cancels when Shift is let go before the press', async () => {
    vi.useFakeTimers();
    const page = await loadLinkPreviewTrigger();
    page.fire('pointerover', 'out');
    await vi.advanceTimersByTimeAsync(200);
    page.fire('keyup', null, { key: 'Shift', shiftKey: false });

    expect(actions(page.sent())).toEqual(['linkPreviewPrepare', 'linkPreviewCancel']);
  });

  it('keeps the link through a moment off it, and cancels once the pointer left it', async () => {
    vi.useFakeTimers();
    const page = await loadLinkPreviewTrigger();
    page.fire('pointerover', 'out');
    await vi.advanceTimersByTimeAsync(200);
    page.fire('pointerover', 'hash');
    await vi.advanceTimersByTimeAsync(50);

    expect(page.sent()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(300);
    expect(actions(page.sent())).toEqual(['linkPreviewPrepare', 'linkPreviewCancel']);
  });

  it('prepares nothing for a capital letter typed, or a pointer passing over with Shift held', async () => {
    vi.useFakeTimers();
    const typing = await loadLinkPreviewTrigger();
    typing.fire('pointerover', 'out', { shiftKey: false });
    typing.fire('keydown', null, { key: 'Shift' });
    typing.fire('keydown', null, { key: 'A' });
    await vi.advanceTimersByTimeAsync(200);
    expect(typing.sent()).toEqual([]);

    const passing = await loadLinkPreviewTrigger();
    passing.fire('pointerover', 'out');
    await vi.advanceTimersByTimeAsync(50);
    passing.fire('pointerover', 'hash');
    await vi.advanceTimersByTimeAsync(200);
    expect(passing.sent()).toEqual([]);
  });
});

describe("the page inside the preview's frame", () => {
  const surfaceMessages = (messages: unknown[], type: string) => messages.filter((message) =>
    message && typeof message === 'object' && Reflect.get(message, 'type') === type);

  it('reports in to the surface and the worker, and starts no previews of its own', async () => {
    const page = await loadLinkPreviewTrigger({ previewFrame: true });

    expect(page.parentMessages[0]).toMatchObject({ source: 'lumno-link-preview-frame', type: 'alive' });
    expect(page.sent()).toEqual([{ action: 'linkPreviewFrameCommitted' }]);
  });

  it('passes on the secret only from the surface above it', async () => {
    const page = await loadLinkPreviewTrigger({ previewFrame: true });
    const fromSource = (source: unknown, data: object) => page.added
      .filter((entry) => entry.target === 'window' && entry.type === 'message')
      .forEach((entry) => typeof entry.listener === 'function' && Reflect.apply(entry.listener, window, [{ source, data }]));
    fromSource(window.parent, { source: 'lumno-link-preview-surface', type: 'bind', secret: 'abc' });
    fromSource(window, { source: 'lumno-link-preview-surface', type: 'bind', secret: 'page' });

    expect(page.sent().slice(1)).toEqual([{ action: 'linkPreviewFrameBind', secret: 'abc' }]);
  });

  it("styles the page so scrolling stops at its edge and its scrollbar clears the window's corners", async () => {
    await loadLinkPreviewTrigger({ previewFrame: true });
    const styles = Array.from(document.querySelectorAll('style'), (style) => style.textContent || '').join('\n');

    expect(styles).toMatch(/:root\s*\{\s*overscroll-behavior:\s*contain/);
    expect(styles).toMatch(/::-webkit-scrollbar-track\s*\{[^}]*margin:\s*\d+px/);
    // Chromium draws the scrollbar parts, other browsers a thin standard bar.
    expect(styles).toMatch(/scrollbar-width:\s*auto/);
    expect(styles).toMatch(/scrollbar-width:\s*thin/);
    document.querySelectorAll('style').forEach((style) => style.remove());
  });

  it('opens a link Shift+clicked inside it in the preview itself', async () => {
    const page = await loadLinkPreviewTrigger({ previewFrame: true, body: '<a id="next" href="https://docs.example.test/next">next</a>' });

    expect(page.press('next')).toEqual(['mousedown', 'click']);
    expect(page.sent().filter((message) => actions([message])[0] !== 'linkPreviewFrameCommitted')).toEqual([]);
    expect(page.assign).toHaveBeenCalledWith('https://docs.example.test/next');
  });

  it("reports the page's background where it settles, not a color it passes through", async () => {
    vi.useFakeTimers();
    document.body.style.backgroundColor = 'rgb(13, 17, 23)';
    const page = await loadLinkPreviewTrigger({ previewFrame: true });
    const backgrounds = () => surfaceMessages(page.parentMessages, 'background').map((message) => Reflect.get(Object(message), 'color'));
    await vi.advanceTimersByTimeAsync(320);

    expect(backgrounds()).toEqual(['rgb(13, 17, 23)']);
    document.body.style.backgroundColor = 'rgb(0, 0, 0)';
    await vi.advanceTimersByTimeAsync(60);
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    await vi.advanceTimersByTimeAsync(320);
    // X starts black.
    expect(backgrounds()).toEqual(['rgb(13, 17, 23)', 'rgb(255, 255, 255)']);
    document.body.removeAttribute('style');
  });

  it('passes Escape up even when the page claims it, but not when it closes an open modal of the page', async () => {
    vi.useFakeTimers();
    const page = await loadLinkPreviewTrigger({ previewFrame: true });
    const escapes = () => surfaceMessages(page.parentMessages, 'escape').length;
    // The page prevents every Escape.
    const pressEscape = async () => {
      page.fire('keydown', null, { key: 'Escape', defaultPrevented: true });
      await vi.advanceTimersByTimeAsync(5);
    };

    await pressEscape();
    expect(escapes()).toBe(1);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    Object.defineProperty(dialog, 'getClientRects', { value: () => [{}] });
    document.body.append(dialog);
    await pressEscape();
    expect(escapes()).toBe(1);
  });
});
