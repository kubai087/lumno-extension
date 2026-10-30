import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaviconFallback, FolderPreviewFaviconFallback } from '../react/favicon-fallback';
import { createFallbackIconPresenter } from './favicon-view-core';
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
