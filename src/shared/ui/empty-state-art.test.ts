import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATE_ART_CSS,
  EMPTY_STATE_ART_NAMES,
  createEmptyStateArt,
  describeEmptyStateArt,
  ensureEmptyStateArtStyles,
  followEmptyStateArtTheme,
  resolveEmptyStateArtTheme
} from './empty-state-art';
import { expectSvg, getElementById, required } from '../../../tests/fakes/dom';

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('empty-state art drawings', () => {
  it('has every drawing the surfaces ask for', () => {
    ['blockedPage', 'noResults', 'noCommands', 'noTabs', 'emptyFolder', 'emptyList', 'loadFailed', 'nothing']
      .forEach((name) => expect(EMPTY_STATE_ART_NAMES).toContain(name));
  });

  it.each(EMPTY_STATE_ART_NAMES)('draws %s as a self-contained decorative svg', (name) => {
    const element = createEmptyStateArt(document, name, { id: 'art-test' });
    expect(element.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(element.getAttribute('class')).toBe(`lumno-empty-art lumno-empty-art--${name}`);
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.getAttribute('data-theme')).toBe('auto');
    expect(element.getAttribute('width')).toBe('160');
    expect(element.getAttribute('height')).toBe('120');
    // No raster images, links or requests, and no text of its own: the words
    // around it stay the only text in an empty state.
    expect(element.querySelector('image, use, a, foreignObject, style, text')).toBeNull();
    expect(element.textContent).toBe('');
    // Without the stylesheet it still draws, in the light palette.
    element.querySelectorAll('[class^="p-"]').forEach((node) => {
      const painted = ['fill', 'stroke', 'stop-color', 'flood-color'].some((attribute) => node.hasAttribute(attribute));
      expect(painted, `${node.getAttribute('class')} carries its light colors`).toBe(true);
    });
    element.querySelectorAll('[filter], [fill^="url("]').forEach((node) => {
      const reference = (node.getAttribute('filter') || node.getAttribute('fill') || '').slice(5, -1);
      expect(element.querySelector(`[id="${reference}"]`), `defines ${reference} itself`).not.toBeNull();
    });

    // The description React renders is the drawing the element is built from.
    const [tag, attributes] = describeEmptyStateArt(name, { id: 'art-test' });
    expect(tag).toBe('svg');
    expect(attributes.class).toBe(element.getAttribute('class'));
  });

  it('never gives two illustrations on one page the same id', () => {
    expect(createEmptyStateArt(document, 'noResults').id).not.toBe(createEmptyStateArt(document, 'noResults').id);
  });

  it('labels, sizes and themes a drawing on request', () => {
    const labeled = createEmptyStateArt(document, 'blockedPage', { size: 200, theme: 'dark', label: 'Blocked <page>' });
    expect(labeled.getAttribute('role')).toBe('img');
    expect(labeled.getAttribute('aria-label')).toBe('Blocked <page>');
    expect(labeled.getAttribute('aria-hidden')).toBeNull();
    expect(labeled.getAttribute('data-theme')).toBe('dark');
    expect(labeled.getAttribute('width')).toBe('200');
    expect(labeled.getAttribute('height')).toBe('150');
    const unknownTheme = expectSvg(Reflect.apply(createEmptyStateArt, undefined, [document, 'nothing', { theme: 'sepia' }]));
    expect(unknownTheme.getAttribute('data-theme')).toBe('auto');
  });

  it('refuses a name that is not a drawing', () => {
    expect(() => Reflect.apply(createEmptyStateArt, undefined, [document, 'toString'])).toThrow(/Unknown empty-state art/);
    expect(() => Reflect.apply(describeEmptyStateArt, undefined, ['missing'])).toThrow(/Unknown empty-state art/);
  });
});

describe('empty-state art stylesheet', () => {
  it('carries the dark palette and a re-pointable accent', () => {
    expect(EMPTY_STATE_ART_CSS).toContain('.lumno-empty-art[data-theme="dark"]');
    expect(EMPTY_STATE_ART_CSS).toContain('var(--lumno-art-accent, #3462ad)');
  });

  it('adds the stylesheet once per document and once per shadow root', () => {
    expect(ensureEmptyStateArtStyles(createEmptyStateArt(document, 'noResults'))).toBe(false);

    document.body.append(createEmptyStateArt(document, 'noResults'), createEmptyStateArt(document, 'emptyFolder'));
    document.body.querySelectorAll('svg').forEach((svg) => expect(ensureEmptyStateArtStyles(svg)).toBe(true));
    expect(document.head.querySelectorAll('style[data-lumno-empty-art-style]')).toHaveLength(1);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    const inShadow = createEmptyStateArt(document, 'blockedPage');
    shadow.appendChild(inShadow);
    ensureEmptyStateArtStyles(inShadow);
    ensureEmptyStateArtStyles(inShadow);
    expect(shadow.querySelectorAll('style[data-lumno-empty-art-style]')).toHaveLength(1);
  });
});

describe('empty-state art theme', () => {
  function element(tag: string, attributes: Record<string, string>, ...children: HTMLElement[]): HTMLElement {
    const node = document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    node.append(...children);
    return node;
  }

  function placeScopes(): void {
    document.body.append(
      element('div', { 'data-theme': 'dark' },
        element('span', { id: 'dark' }),
        element('div', { 'data-glass-ink-theme': 'dark', 'data-theme': 'light' }, element('span', { id: 'glass' })),
        element('div', { 'data-wallpaper-ink': 'dark' }, element('span', { id: 'ink' }))),
      element('span', { id: 'none' })
    );
  }

  it('takes the theme of the nearest page, glass panel or wallpaper ink', () => {
    placeScopes();
    expect(resolveEmptyStateArtTheme(getElementById('dark'))).toBe('dark');
    expect(resolveEmptyStateArtTheme(getElementById('glass'))).toBe('dark');
    // Wallpaper ink counts only while a wallpaper is on.
    expect(resolveEmptyStateArtTheme(getElementById('ink'))).toBe('dark');
    expect(resolveEmptyStateArtTheme(getElementById('none'))).toBe('auto');
    document.body.setAttribute('data-wallpaper-active', 'true');
    // Dark ink means a light wallpaper, so light art.
    expect(resolveEmptyStateArtTheme(getElementById('ink'))).toBe('light');
    document.body.removeAttribute('data-wallpaper-active');
  });

  it('follows a new wallpaper ink until stopped', async () => {
    placeScopes();
    document.body.setAttribute('data-wallpaper-active', 'true');
    const svg = createEmptyStateArt(document, 'emptyFolder');
    const ink = getElementById('ink');
    ink.appendChild(svg);
    const stop = followEmptyStateArtTheme(svg);
    expect(svg.getAttribute('data-theme')).toBe('light');
    const scope = required(ink.parentElement, 'ink scope');
    scope.setAttribute('data-wallpaper-ink', 'light');
    await nextTask();
    expect(svg.getAttribute('data-theme')).toBe('dark');
    stop();
    scope.setAttribute('data-wallpaper-ink', 'dark');
    await nextTask();
    expect(svg.getAttribute('data-theme')).toBe('dark');
    document.body.removeAttribute('data-wallpaper-active');
  });
});
