// @vitest-environment jsdom
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCss, readLightTokens, readStylesheetSource } from '../fakes/css';
import { readRepoText, repoPath } from './repository';

const PAGES = ['newtab.html', 'src/options/options.html', 'src/onboarding/onboarding.html'];

const TOKEN_STYLESHEETS = [
  ...readdirSync(repoPath('src/shared')).filter((file) => file.endsWith('.css')).map((file) => `src/shared/${file}`),
  'src/options/options.css', 'src/options/webdav-options.css', 'src/newtab/newtab.css',
  'src/newtab/shortcuts/shortcut-dialog.css', 'src/newtab/bookmarks/folder-color-picker.css',
  'src/newtab/remote-content.css', 'src/onboarding/onboarding.css', 'src/overlay/suggestions-view.css'
];

// Stylesheets injected into web pages, which have no tokens there.
const INJECTED_STYLESHEETS = [
  'src/shared/ui/tooltip.css', 'src/shared/ui/menu-surface.css', 'src/shared/ui/toast.css',
  'src/shared/search/search-input.css', 'src/shared/ui/feature-hints.css', 'src/shared/ui/cursor-tooltip.css',
  'src/shared/ui/external-link-icon.css', 'src/overlay/suggestions-view.css'
];

describe('design tokens', () => {
  // Only font and icon CSS may precede them.
  it.each(PAGES)('loads the shared tokens in %s before any stylesheet that reads them', (page) => {
    const doc = new DOMParser().parseFromString(readRepoText(page), 'text/html');
    const sheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'), (link) => link.getAttribute('href') || '');
    const tokensIndex = sheets.indexOf('../shared/tokens.css');

    expect(tokensIndex).toBeGreaterThanOrEqual(0);
    sheets.slice(0, tokensIndex).forEach((href) => expect(href).toMatch(/^\.\.\/\.\.\/assets\//));
  });

  it.each(TOKEN_STYLESHEETS)('references only tokens that exist in %s', (file) => {
    const tokens = readLightTokens();
    const unknown = [...readStylesheetSource(file).matchAll(/var\((--lumno-[\w-]+)/g)].map((match) => match[1]).filter((name) => !tokens.has(name));

    expect(unknown).toEqual([]);
  });

  it.each(INJECTED_STYLESHEETS)('gives every token in %s a fallback for web pages', (file) => {
    expect(readStylesheetSource(file).match(/var\(--lumno-[\w-]+\)/g) || []).toEqual([]);
  });

  // Every page loads tokens.css first, so its page-wide rules reach every
  // component: reduced motion drops transitions and finishes animations at
  // once (they still end, so animationend fires), and keyboard focus always
  // shows a ring.
  describe('page-wide rules in tokens.css', () => {
    const tokensCss = parseCss(readStylesheetSource('src/shared/tokens.css'));
    const reducedMotion = tokensCss.entries.filter((entry) => entry.selectors.includes('*') &&
      entry.conditions.some((text) => /prefers-reduced-motion:\s*reduce/.test(text)));
    const declared = (name: string) => reducedMotion
      .map((entry) => [entry.style.getPropertyValue(name), entry.style.getPropertyPriority(name)])
      .find(([value]) => value);

    it('finishes every animation at once under reduced motion without removing it', () => {
      expect(reducedMotion.length).toBeGreaterThan(0);
      expect(declared('animation-duration')).toEqual(['0.01ms', 'important']);
    });

    it('drops every transition under reduced motion', () => {
      expect(declared('transition-duration')).toEqual(['0s', 'important']);
    });

    it('gives every control the shared focus ring', () => {
      expect(tokensCss.entries.some((entry) => entry.conditions.length === 0 &&
        entry.selectors.some((selector) => /^:where\(button, a\[href\].*:focus-visible$/.test(selector)) &&
        entry.style.getPropertyValue('outline').trim() === '2px solid var(--lumno-color-focus-ring)')).toBe(true);
    });
  });

  // Shared components are defined once; pages only resize them.
  describe('shared components', () => {
    const optionsCss = readStylesheetSource('src/options/options.css');
    const newtabCss = readStylesheetSource('src/newtab/newtab.css');

    it.each([['Options', optionsCss], ['New Tab', newtabCss]])('leave switch colors and knob rules to switch.css on %s', (_page, css) => {
      expect(css).not.toMatch(/--switch-track-on-bg|--switch-knob-shadow|switch-slider[^{]*::before\s*\{/);
    });

    it.each([['Options', optionsCss], ['New Tab', newtabCss]])('leave theme card check badges to choice-card.css on %s', (_page, css) => {
      expect(css).not.toMatch(/^(?:\._x_extension_theme_check_2026_unique_|\.x-nt-appearance-check)\s*\{[^}]*linear-gradient/m);
    });

    it('draw the Options toast from toast.css', () => {
      expect(optionsCss).not.toMatch(/^\._x_extension_toast_2024_unique_ \{[^}]*background:/m);
    });
  });
});
