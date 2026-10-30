import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualSurface, type VisualSurfaceRenderModel } from './visual-surface';
import { getElements, required } from '../../../tests/fakes/dom';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

let roots: Root[] = [];

// Draws each model as a fresh demo in a stage, the way a new slide does,
// and reports whether a surface was drawn.
function createFixture() {
  const stage = document.createElement('div');
  stage.id = 'onboarding-visual-stage';
  document.body.appendChild(stage);
  const root = createRoot(stage);
  roots.push(root);
  let renders = 0;
  const controller = {
    render(model: VisualSurfaceRenderModel): boolean {
      renders += 1;
      flushSync(() => root.render(<VisualSurface key={renders} model={model} />));
      return stage.childElementCount > 0;
    },
    clear(): void {
      flushSync(() => root.render(null));
    }
  };
  return { controller, stage };
}

function createModel(
  overrides: Partial<VisualSurfaceRenderModel> = {}
): VisualSurfaceRenderModel {
  return {
    ariaLabel: 'Lumno',
    bookmarkFocus: {
      hoverLeadMs: 1040,
      hoverStartMs: 3200,
      hoverStepMs: 1600,
      hoverWrapStepMs: 1600,
      openLabel: 'Open',
      overlayAriaLabel: 'Lumno overlay demo',
      panelId: 'onboarding-overlay-demo',
      query: 'extension',
      reducedMotion: false,
      removeHistoryLabel: 'Remove history item',
      results: [],
      searchAriaLabel: 'Search Lumno demo',
      settingsLabel: 'Settings'
    },
    butterflyDValues: 'flutter;rest;flutter',
    butterflyRestPath: 'M4 17 L10 20 Z',
    featureAwards: [],
    featureCards: [],
    homepagePipArtSrc: '/assets/onboarding-auto-pip.svg',
    kind: 'lumno-web-wordmark-surface',
    newtabPreview: {
      ariaLabel: 'Lumno new tab preview',
      bookmarkManagerLabel: 'Open bookmark manager',
      bookmarks: [
        {
          previewUrls: [
            'https://developer.chrome.com/',
            'https://github.com/'
          ],
          title: 'Workbench',
          type: 'folder'
        }
      ],
      bookmarksSectionTitle: 'Bookmarks',
      hoverHoldMs: 1200,
      hoverMoveMs: 520,
      hoverSettleMs: 1140,
      hoverStartMs: 1500,
      nextLabelTemplate: '{label}, next',
      openItemAriaTemplate: 'Open {title}',
      previousLabelTemplate: '{label}, previous',
      query: '',
      recentSectionTitle: 'Recent',
      recentSites: [
        {
          accentRgb: [66, 133, 244],
          siteName: 'Chrome Web Store',
          title: 'Lumno extension',
          url: 'https://chromewebstore.google.com/',
          urlText: 'chromewebstore.google.com'
        }
      ],
      reducedMotion: false,
      searchAriaLabel: 'Lumno new tab search preview',
      searchPlaceholder: 'Search or enter URL…',
      sectionModeBookmarksLabel: 'Bookmarks display mode',
      sectionModeRecentLabel: 'Recent display mode',
      settingsLabel: 'Settings',
      visitLabel: 'Visit',
      wordmarkSrc: '/assets/lumno-wordmark.svg'
    },
    newtabFiltersArtSrc: '/assets/onboarding-newtab-filters.webp',
    siteSearchCases: [],
    siteSearchDemoAriaLabel: 'Site search demo',
    siteSearchOpenLabel: 'Open',
    siteSearchSettingsLabel: 'Settings',
    siteSearchTabHintTemplate: 'Search with {provider}',
    wordmarkSrc: '/assets/lumno-web-textlogo.svg',
    ...overrides
  };
}

afterEach(() => {
  act(() => {
    roots.forEach((root) => root.unmount());
  });
  roots = [];
  document.body.textContent = '';
  vi.useRealTimers();
});

describe('Onboarding visual surface', () => {
  it('renders the Lumno wordmark and both SVG wing animations', () => {
    const { controller, stage } = createFixture();
    let handled = false;
    act(() => {
      handled = controller.render(createModel());
    });

    expect(handled).toBe(true);
    const surface = queryHtmlElement(stage, '.lumno-web-wordmark-surface');
    expect(surface?.dataset.visualSurface).toBe(
      'onboarding-lumno-wordmark-surface'
    );
    expect(surface?.getAttribute('aria-label')).toBe('Lumno');
    expect(
      (surface ? queryHtmlTag(surface, '.logo-wordmark', 'img') : null)?.getAttribute(
        'src'
      )
    ).toBe('/assets/lumno-web-textlogo.svg');
    expect(surface?.querySelectorAll('.logo-butterfly')).toHaveLength(2);
    expect(surface?.querySelectorAll('animate')).toHaveLength(2);
    expect(surface?.querySelectorAll('animateTransform')).toHaveLength(1);
    expect(
      surface?.querySelector('animate')?.getAttribute('values')
    ).toBe('flutter;rest;flutter');
    expect(surface?.querySelector('.seo-wordmark-text')?.textContent).toBe(
      'Lumno'
    );
  });

  it('returns unsupported scenes to the legacy renderer', () => {
    const { controller, stage } = createFixture();
    let handled = true;
    act(() => {
      controller.render(createModel());
      handled = controller.render(
        createModel({ kind: 'generic-visual-surface' })
      );
    });

    expect(handled).toBe(false);
    expect(stage.childElementCount).toBe(0);
  });

  it('renders the localized newtab preview and owns its hover loop', () => {
    vi.useFakeTimers();
    const { controller, stage } = createFixture();
    act(() => {
      controller.render(createModel({
        kind: 'newtab-preview-surface'
      }));
    });

    const surface = queryHtmlElement(stage, '.newtab-preview-surface');
    expect(surface?.dataset.visualSurface).toBe(
      'onboarding-newtab-preview-surface'
    );
    expect(surface?.dataset.previewHover).toBe('idle');
    expect(surface?.getAttribute('aria-label')).toBe(
      'Lumno new tab preview'
    );
    expect(
      surface?.querySelectorAll('.browser-window-clip')
    ).toHaveLength(2);
    const search = (surface ? queryHtmlTag(surface, '#_x_extension_newtab_search_input_2024_unique_', 'input') : null);
    expect(search?.readOnly).toBe(true);
    expect(search?.placeholder).toBe('Search or enter URL…');
    expect(
      surface?.querySelectorAll('.x-nt-bookmark-card')
    ).toHaveLength(1);
    expect(
      surface?.querySelectorAll('.x-nt-recent-card')
    ).toHaveLength(1);
    expect(
      surface?.querySelectorAll('[data-folder-layer]')
    ).toHaveLength(3);
    expect(
      (surface ? queryHtmlElement(surface, '.x-nt-recent-card') : null)
        ?.style.getPropertyValue('--x-nt-recent-card-color')
    ).toBe('rgb(221, 233, 253)');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(surface?.dataset.previewHover).toBe('recent');
    expect(
      surface?.querySelector('.x-nt-recent-card--hover')
    ).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1720);
    });
    expect(surface?.dataset.previewHover).toBe('bookmark');
    expect(
      surface?.querySelector('.x-nt-bookmark-card--hover')
    ).not.toBeNull();

    act(() => {
      controller.clear();
    });
    expect(stage.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the newtab preview idle when motion is reduced', () => {
    vi.useFakeTimers();
    const { controller, stage } = createFixture();
    const model = createModel({
      kind: 'newtab-preview-surface'
    });
    act(() => {
      controller.render({
        ...model,
        newtabPreview: {
          ...required(model.newtabPreview, 'model.newtabPreview'),
          reducedMotion: true
        }
      });
    });

    expect(
      queryHtmlElement(stage, '.newtab-preview-surface')
        ?.dataset.previewHover
    ).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('renders localized feature awards, cards, delays, and artwork variants', () => {
    const { controller, stage } = createFixture();
    act(() => {
      controller.render(createModel({
        featureAwards: [
          { lines: ['Open source', 'Privacy safe'] },
          { lines: ['Free forever'] }
        ],
        featureCardAriaJoiner: ' — ',
        featureCards: [
          {
            art: 'homepage-pip',
            body: 'Starts when switching tabs',
            title: 'Automatic PiP',
            tone: 'pip'
          },
          {
            art: 'newtab-filters',
            body: 'Wallpapers and filters',
            title: 'Custom new tab',
            tone: 'newtab'
          },
          {
            art: 'placeholder',
            artSize: { width: 240, height: 96 },
            title: 'Coming soon'
          }
        ],
        kind: 'feature-cards-surface',
        practicalFeaturesAriaLabel: 'Practical features',
        principlesAriaLabel: 'Product principles'
      }));
    });

    const surface = queryHtmlElement(stage, '.feature-cards-surface');
    expect(surface?.dataset.visualSurface).toBe(
      'onboarding-feature-cards-surface'
    );
    expect(surface?.getAttribute('aria-label')).toBe('Practical features');
    expect(
      surface?.querySelector('.feature-cards-surface__awards')
        ?.getAttribute('aria-label')
    ).toBe('Product principles');
    expect(surface?.querySelectorAll('.feature-award')).toHaveLength(2);
    expect(surface?.querySelectorAll('.feature-award__wheat')).toHaveLength(4);
    const cards = (surface ? getElements(surface, '.feature-card') : []);
    expect(cards).toHaveLength(3);
    expect(cards?.[0]?.getAttribute('aria-label')).toBe(
      'Automatic PiP — Starts when switching tabs'
    );
    expect(cards?.[1]?.style.getPropertyValue('--feature-card-delay')).toBe(
      '350ms'
    );
    expect(
      (surface ? queryHtmlTag(surface, '[data-art="homepage-pip"] img', 'img') : null)?.getAttribute('src')
    ).toBe('/assets/onboarding-auto-pip.svg');
    expect(
      (surface ? queryHtmlTag(surface, '[data-art="newtab-filters"] img', 'img') : null)?.getAttribute('src')
    ).toBe('/assets/onboarding-newtab-filters.webp');
    const blank = (surface ? queryHtmlElement(surface, '[data-art="blank"]') : null);
    expect(blank?.dataset.artWidth).toBe('240');
    expect(blank?.dataset.artHeight).toBe('96');
  });

  it('draws nothing once cleared', () => {
    const { controller, stage } = createFixture();
    act(() => {
      controller.render(createModel());
      controller.clear();
    });

    expect(stage.childElementCount).toBe(0);
    expect(stage.querySelector('[data-visual-surface]')).toBeNull();
  });

  it('renders themed site-search cases, typing tokens, and query highlights', () => {
    const { controller, stage } = createFixture();
    act(() => {
      controller.render(createModel({
        kind: 'site-search-demo-surface',
        siteSearchCases: [
          {
            actionLabel: 'Search GitHub',
            favicon: '/assets/github.png',
            iconName: 'ri-github-fill',
            kind: 'site',
            label: 'Site search',
            modeLabel: 'GitHub',
            prefixLabel: 'GitHub',
            promptQuery: 'lumno',
            promptWidth: '8ch',
            resultDetail: 'github.com',
            resultTag: 'Site',
            resultTitle: 'Search GitHub for lumno',
            theme: {
              accentRgb: [36, 41, 46],
              buttonBg: [240, 241, 242],
              buttonBorder: [180, 181, 182],
              buttonText: [36, 41, 46],
              highlightBg: [224, 226, 228],
              highlightBorder: [160, 162, 164],
              keyBg: [248, 249, 250],
              keyBorder: [120, 122, 124],
              keyText: '#111827',
              markBg: [230, 232, 234],
              markText: '#111827'
            },
            triggerQuery: 'github'
          },
          {
            actionLabel: 'Open ChatGPT',
            iconName: 'ri-sparkling-2-line',
            kind: 'ai',
            label: 'AI',
            modeLabel: 'ChatGPT',
            promptQuery: 'Review this PR',
            resultTitle: 'Ask ChatGPT to Review this PR',
            theme: { accentRgb: [16, 163, 127] },
            triggerQuery: 'chatgpt'
          }
        ],
        siteSearchDemoAriaLabel: 'Lumno site-search demo',
        siteSearchSettingsLabel: 'Demo settings',
        siteSearchTabHintTemplate: 'Use {provider} to search'
      }));
    });

    const surface = queryHtmlElement(stage, '.site-search-demo-surface');
    expect(surface?.dataset.visualSurface).toBe(
      'onboarding-site-search-demo-surface'
    );
    expect(surface?.getAttribute('aria-label')).toBe(
      'Lumno site-search demo'
    );
    const cards = (surface ? getElements(surface, '.site-search-demo-card') : []);
    expect(cards).toHaveLength(2);
    expect(cards?.[1]?.style.getPropertyValue('--case-delay')).toBe('760ms');
    expect(
      cards?.[0]?.style.getPropertyValue('--site-search-demo-accent')
    ).toBe('rgb(36, 41, 46)');
    expect(cards?.[0]?.style.getPropertyValue('--x-ext-mark-text')).toBe(
      '#111827'
    );
    expect(
      cards?.[0]?.querySelectorAll(
        '.site-search-demo-query-token--trigger .onboarding-typing-char'
      )
    ).toHaveLength(6);
    expect(
      (cards?.[0] ? queryHtmlElement(cards?.[0], '.site-search-demo-query-token--prompt') : null)?.style.getPropertyValue('--typed-width')
    ).toBe('calc(8ch + var(--typed-width-buffer, 0.65em))');
    expect(cards?.[0]?.querySelector('mark')?.textContent).toBe('lumno');
    expect(
      cards?.[0]?.querySelector('.site-search-demo-tab-hint__label')
        ?.textContent
    ).toBe('Use GitHub to search');
    expect(
      cards?.[0]?.querySelector('.x-lumno-search-input__right-icon')
        ?.getAttribute('aria-label')
    ).toBe('Demo settings');
    expect(
      surface?.querySelector(
        '.site-search-demo-result .ri-arrow-right-line'
      )
    ).toBeNull();
    expect(
      cards?.[1]?.querySelector('.site-search-demo-mode-prefix__icon')
    ).not.toBeNull();
  });

  it('renders bookmark focus UI and owns the result highlight loop', () => {
    vi.useFakeTimers();
    const { controller, stage } = createFixture();
    act(() => {
      controller.render(createModel({
        bookmarkFocus: {
          hoverLeadMs: 1040,
          hoverStartMs: 3200,
          hoverStepMs: 1600,
          hoverWrapStepMs: 1600,
          openLabel: 'Open',
          overlayAriaLabel: 'Overlay demo',
          panelId: 'overlay-demo-panel',
          query: 'extension',
          reducedMotion: false,
          removeHistoryLabel: 'Remove this history item',
          results: [
            {
              actionTagLabel: 'New tab',
              favicon: '/assets/store.png',
              sourceTag: 'Top site',
              title: 'Chrome extension store',
              type: 'topSite',
              visitButtonLabel: 'Open'
            },
            {
              detail: 'Bookmarks / Development',
              sourceTag: 'Bookmark',
              sourceTagKind: 'bookmark',
              title: 'Extension API reference',
              type: 'bookmark',
              visitButtonLabel: 'Open'
            },
            {
              historyDeletable: true,
              title: 'Extension documentation',
              type: 'history',
              visitButtonLabel: 'Open'
            }
          ],
          searchAriaLabel: 'Search demo',
          settingsLabel: 'Demo settings'
        },
        kind: 'bookmark-focus-surface'
      }));
    });

    const surface = queryHtmlElement(stage, '.bookmark-focus-ui');
    expect(surface?.dataset.visualSurface).toBe(
      'onboarding-bookmark-focus-surface'
    );
    expect(surface?.querySelectorAll('.surface-rail-dot')).toHaveLength(3);
    expect(surface?.querySelectorAll('.browser-page-row')).toHaveLength(4);
    expect(surface?.querySelectorAll('.lumno-overlay-result')).toHaveLength(3);
    expect(surface?.querySelector('.x-ov-action-tag__key')).toBeNull();
    expect(
      surface?.querySelector(
        '.lumno-overlay-result .ri-arrow-right-line'
      )
    ).toBeNull();
    expect(
      surface?.querySelectorAll('.lumno-overlay-query-text .onboarding-typing-char')
    ).toHaveLength(9);
    expect(
      surface?.querySelector('#overlay-demo-panel')?.getAttribute('aria-label')
    ).toBe('Overlay demo');
    const rows = () => (surface ? getElements(surface, '.lumno-overlay-result') : []);
    expect(rows()?.[0]?.dataset.active).toBe('false');

    act(() => {
      vi.advanceTimersByTime(3200);
    });
    expect(rows()?.[0]?.dataset.active).toBe('true');
    expect(
      rows()?.[0]?.querySelector('.x-ov-suggestion-action-tags')
        ?.getAttribute('data-visible')
    ).toBe('true');
    expect(
      rows()?.[0]?.querySelector('.x-ov-suggestion-visit-button')
        ?.getAttribute('data-visible')
    ).toBe('false');

    act(() => {
      vi.advanceTimersByTime(2640);
    });
    expect(rows()?.[0]?.dataset.active).toBe('false');
    expect(rows()?.[1]?.dataset.active).toBe('true');

    act(() => {
      controller.clear();
    });
    expect(stage.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pins the first bookmark-focus result when motion is reduced', () => {
    vi.useFakeTimers();
    const { controller, stage } = createFixture();
    act(() => {
      controller.render(createModel({
        bookmarkFocus: {
          hoverLeadMs: 1040,
          hoverStartMs: 3200,
          hoverStepMs: 1600,
          hoverWrapStepMs: 1600,
          openLabel: 'Open',
          overlayAriaLabel: 'Overlay demo',
          panelId: 'overlay-demo-panel',
          query: 'extension',
          reducedMotion: true,
          removeHistoryLabel: 'Remove history',
          results: [
            { title: 'First', type: 'topSite' },
            { title: 'Second', type: 'bookmark' }
          ],
          searchAriaLabel: 'Search demo',
          settingsLabel: 'Settings'
        },
        kind: 'bookmark-focus-surface'
      }));
    });

    const rows = getElements(stage, '.lumno-overlay-result');
    expect(rows[0]?.dataset.active).toBe('true');
    expect(rows[1]?.dataset.active).toBe('false');
    expect(vi.getTimerCount()).toBe(0);
  });
});
