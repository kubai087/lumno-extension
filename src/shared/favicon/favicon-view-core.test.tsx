import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaviconFallback, FolderPreviewFaviconFallback } from '../react/favicon-fallback';
import { createFallbackIconPresenter, createFaviconViewCore } from './favicon-view-core';
import { getElement, getElements, getTag, getTags } from '../../../tests/fakes/dom';

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

function render(children: ReactNode): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const nextRoot = createRoot(host);
  root = nextRoot;
  act(() => nextRoot.render(children));
  return host;
}

function createPresenter(timers: Array<() => void> = []) {
  const shown = new Map<HTMLImageElement, boolean>();
  const presenter = createFallbackIconPresenter({
    fallbackClassName: '_x_extension_favicon_fallback_2024_unique_',
    getFallbackSibling: (img) => img.classList.contains('x-nt-folder-preview-favicon')
      ? img.previousElementSibling
      : img.nextElementSibling,
    styleFallbackNode: (_img, node) => node.style.setProperty('--x-nt-favicon-fallback-width', '22px'),
    setImageVisible: (img, visible) => shown.set(img, visible),
    clearCandidateTimer: vi.fn(),
    setTimer: (callback) => timers.push(callback)
  });
  return { presenter, shown };
}

describe('favicon fallback presenter', () => {
  it('shows and hides the fallback a view draws after its image', () => {
    const host = render(
      <span>
        <img alt="" />
        <FaviconFallback tone="bookmark" />
      </span>
    );
    const img = getTag(host, 'img', 'img');
    const node = getElement(host, '.x-nt-favicon-fallback');
    const { presenter, shown } = createPresenter();
    expect(node.dataset.visible).toBe('false');

    presenter.showPendingFallbackIcon(img);
    expect(node.dataset.visible).toBe('true');
    expect(node.style.getPropertyValue('--x-nt-favicon-fallback-width')).toBe('22px');
    expect(img.getAttribute('data-favicon-placeholder')).toBe('true');
    expect(shown.get(img)).toBe(false);

    presenter.showResolvedFavicon(img);
    expect(node.dataset.visible).toBe('false');
    expect(img.hasAttribute('data-favicon-placeholder')).toBe(false);
    expect(shown.get(img)).toBe(true);

    presenter.applyFallbackIcon(img);
    expect(node.dataset.visible).toBe('true');
    expect(img.getAttribute('data-fallback-icon')).toBe('true');
    presenter.hideFallbackIconNode(img);
    expect(node.dataset.visible).toBe('false');
  });

  it('pairs each folder preview with the fallback drawn before it', () => {
    const host = render(
      <span>
        <FolderPreviewFaviconFallback />
        <img alt="" className="x-nt-folder-preview-favicon" />
        <FolderPreviewFaviconFallback />
        <img alt="" className="x-nt-folder-preview-favicon" />
      </span>
    );
    const [, second] = getTags(host, 'img', 'img');
    const nodes = getElements(host, '.x-nt-folder-preview-favicon--fallback');
    createPresenter().presenter.applyFallbackIcon(second);
    expect(nodes.map((node) => node.dataset.visible)).toEqual(['false', 'true']);
  });

  it('looks once more on the next task for an image its view has not drawn a fallback for yet', () => {
    const row = (withFallback: boolean) => (
      <span>
        <img alt="" />
        {withFallback ? <FaviconFallback /> : null}
      </span>
    );
    const host = render(row(false));
    const img = getTag(host, 'img', 'img');
    const timers: Array<() => void> = [];
    const { presenter } = createPresenter(timers);

    presenter.applyFallbackIcon(img);
    expect(timers).toHaveLength(1);
    act(() => root?.render(row(true)));
    timers[0]();
    expect(getElement(host, '.x-nt-favicon-fallback').dataset.visible).toBe('true');
  });
});

describe('favicon view caches', () => {
  it('keep only the newest icon data and preloaded images past their limits', () => {
    const faviconDataCache = new Map<string, string>();
    const iconPreloadCache = new Map<string, HTMLImageElement>();
    const core = createFaviconViewCore({
      chromeApi: null,
      requestFaviconData: () => null,
      faviconDataCache,
      iconPreloadCache,
      faviconDataCacheMaxEntries: 2,
      iconPreloadCacheMaxEntries: 2,
      getHostFromUrl: () => '',
      shouldBlockFaviconForHost: () => false,
      isBlockedLocalFaviconUrl: () => false
    });
    const urls = ['https://one.example/favicon.ico', 'https://two.example/favicon.ico', 'https://three.example/favicon.ico'];

    urls.forEach((url, index) => core.cacheFaviconData(url, `data:image/png;base64,${index}`));
    expect(Array.from(faviconDataCache.keys())).toEqual(urls.slice(1));

    urls.forEach((url) => core.preloadIcon(url));
    expect(Array.from(iconPreloadCache.keys())).toEqual(urls.slice(1));
  });
});

// An image that has loaded whatever it was given, as a cached icon does.
function loadedImage(): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'complete', { get: () => Boolean(img.getAttribute('src')) });
  Object.defineProperty(img, 'naturalWidth', { get: () => (img.getAttribute('src') ? 16 : 0) });
  Object.defineProperty(img, 'naturalHeight', { get: () => (img.getAttribute('src') ? 16 : 0) });
  return img;
}

describe('favicon data answers', () => {
  it('never replace the icon an image shows since it asked', async () => {
    const pending = new Map<string, (response: unknown) => void>();
    const core = createFaviconViewCore({
      chromeApi: {
        runtime: {
          sendMessage(message: unknown, callback?: (response: unknown) => void) {
            const url: unknown = message && typeof message === 'object' ? Reflect.get(message, 'url') : undefined;
            if (typeof url === 'string' && callback) pending.set(url, callback);
            return undefined;
          }
        }
      },
      getPersistCacheKey: () => 'light::futurecomm.cn'
    });
    const img = loadedImage();
    const proxyUrl = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fm2.futurecomm.cn%2F&size=128';
    const realUrl = 'https://m2.futurecomm.cn/favicon.ico';
    img.loading = 'lazy';

    expect(core.setFaviconSrcWithAnimation(img, proxyUrl)).toBe(true);
    expect(img.loading).toBe('eager');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('width')).toBe('128');
    expect(img.getAttribute('height')).toBe('128');
    core.attachFaviconData(img, proxyUrl, 'futurecomm.cn');
    expect(core.setFaviconSrcWithAnimation(img, realUrl)).toBe(true);
    expect(img.getAttribute('src')).toBe(realUrl);

    const answer = pending.get(proxyUrl);
    expect(answer).toEqual(expect.any(Function));
    if (answer) answer({ data: 'data:image/png;base64,ZmFrZS1wcm94eS1mYWxsYmFjaw==' });
    await Promise.resolve();
    expect(img.getAttribute('src')).toBe(realUrl);
  });

  // A failed live candidate (e.g. _favicon in Firefox) can stay the rendered
  // src after an interrupted reveal.
  it('swaps the remembered working icon back in and ends the blurred priming state', () => {
    const core = createFaviconViewCore({ chromeApi: null });
    const img = loadedImage();
    const working = 'data:image/png;base64,d29ya2luZy1pY29u';
    img.setAttribute('data-favicon-current-src', working);
    img.setAttribute('data-favicon-has-appeared', 'true');
    img.setAttribute('data-favicon-load-state', 'priming');
    img.src = 'moz-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F';

    expect(core.restoreWorkingFaviconOrFallback(img, working)).toBe(true);
    expect(img.getAttribute('src')).toBe(working);
    expect(img.getAttribute('data-favicon-load-state')).toBe('loaded');
  });
});
