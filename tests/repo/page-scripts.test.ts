// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCss, readPageSource } from '../fakes/css';
import { BUILD_DIR, readRepoJson, readRepoText, recordField, requireRoute } from './repository';

// How the extension pages load their scripts and what the built scripts
// carry. Run npm run build first.

const PAGES = [
  { page: 'newtab.html', entry: 'newtab', preloads: ['newtab-preload', 'cjk-font-faces', 'wallpaper-effect-preload'] },
  { page: 'src/options/options.html', entry: 'options', preloads: ['options-preload', 'cjk-font-faces'] },
  { page: 'src/onboarding/onboarding.html', entry: 'onboarding', preloads: ['onboarding-preload', 'cjk-font-faces'] },
  { page: 'src/popup/popup.html', entry: 'popup', preloads: ['cjk-font-faces', 'popup-preload'] }
];

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function readRoute(entry: string): string {
  return requireRoute([`${entry}.js`]).map((file) => readFileSync(join(BUILD_DIR, file), 'utf8')).join('\n');
}

function listScripts(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listScripts(file);
    }
    return entry.name.endsWith('.js') ? [file] : [];
  });
}

describe('page scripts', () => {
  // Each page loads its classic scripts, then one module entry once its
  // markup is parsed; nothing comes from outside the extension.
  it.each(PAGES)('loads $page through its preloads and one module entry', ({ page, entry, preloads }) => {
    const scripts = Array.from(parseHtml(readPageSource(page)).scripts);

    expect(scripts.filter((script) => script.type === 'module').map((script) => script.getAttribute('src'))).toEqual([`../../build/${entry}.js`]);
    expect(scripts.filter((script) => script.type !== 'module').map((script) => script.getAttribute('src')))
      .toEqual(preloads.map((name) => `../../build/${name}.js`));
    expect(scripts.filter((script) => /^https?:\/\//i.test(script.getAttribute('src') || ''))).toEqual([]);
  });

  // Every page shares React's runtime chunk; only the pages that host the tab
  // switcher carry its view.
  it.each(PAGES)('builds $entry on the shared React runtime chunk', ({ entry }) => {
    expect(requireRoute([`${entry}.js`])).toContain('chunks/react-runtime.js');
  });

  it('carries the in-page tab switcher view only on the pages that host it', () => {
    expect(readRoute('newtab')).toContain('overlay-tab-switcher');
    expect(readRoute('options')).toContain('overlay-tab-switcher');
    expect(readRoute('popup')).not.toContain('overlay-tab-switcher');
  });

  // The built scripts are production builds and safe under the extension CSP.
  it('builds production scripts that evaluate no code from strings', () => {
    const scripts = listScripts(BUILD_DIR).map((file) => ({ name: relative(BUILD_DIR, file), source: readFileSync(file, 'utf8') }));

    expect(scripts.filter(({ source }) => source.includes('process.env.NODE_ENV')).map(({ name }) => name)).toEqual([]);
    expect(scripts.filter(({ source }) => /\beval\(|new Function\b/.test(source)).map(({ name }) => name)).toEqual([]);
  });

  it('leaves the Options tabs React draws empty in the markup', () => {
    const doc = parseHtml(readPageSource('src/options/options.html'));

    ['account', 'shortcuts', 'blacklist', 'labs'].forEach((tab) => {
      const host = doc.querySelector(`[data-content="${tab}"]`);
      expect(host, `Options should have a ${tab} tab`).not.toBeNull();
      expect(host ? host.children.length : -1).toBe(0);
    });
  });

  it('builds by copying the static files, then building every entry', () => {
    const scripts = recordField(readRepoJson('package.json'), 'scripts');

    expect(scripts.build).toBe('npm run build:static && npm run build:entries');
    expect(scripts['build:entries']).toBe('node scripts/build/build.js');
  });

  // The test runner names change as the suites merge; what the commands run
  // in order does not.
  it('verifies with the tests and the same static checks as npm run check', () => {
    const scripts = recordField(readRepoJson('package.json'), 'scripts');
    const script = (name: string) => (typeof scripts[name] === 'string' ? String(scripts[name]) : '');

    expect(script('test')).toMatch(/^npm run build && /);
    expect(script('check')).toContain('npm run build');
    expect(script('check')).toContain('check:static');
    expect(script('verify')).toContain('npm test');
    expect(script('verify')).toContain('check:static');
  });

  it('declares the React runtime dependencies', () => {
    const dependencies = recordField(readRepoJson('package.json'), 'dependencies');

    expect(typeof dependencies.react).toBe('string');
    expect(typeof dependencies['react-dom']).toBe('string');
  });

  it('keeps the Overlay query mark in its themed colors', () => {
    const mark = parseCss(readRepoText('src/overlay/suggestions-view.css')).entries
      .find((entry) => entry.selectors.some((selector) => selector.endsWith('.x-ov-suggestion-mark')) && entry.style.getPropertyValue('background'));

    expect(mark ? [mark.style.getPropertyValue('background').trim(), mark.style.getPropertyValue('color').trim()] : null)
      .toEqual(['var(--x-ext-mark-bg, #CFE8FF)', 'var(--x-ext-mark-text, #1E3A8A)']);
  });
});
