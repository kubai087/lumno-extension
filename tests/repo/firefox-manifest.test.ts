// scripts/build/firefox-manifest.js, which makes the Firefox package's
// manifest from the Chrome one.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';

interface FirefoxManifest {
  permissions: string[];
  background: { scripts: string[] };
}

type ToFirefoxManifest = (chromeManifest: unknown, options: { lazyBackgroundDeps: string[]; importShim: string }) => FirefoxManifest;

function isConverter(value: unknown): value is ToFirefoxManifest {
  return typeof value === 'function';
}

const script: unknown = createRequire(import.meta.url)('../../scripts/build/firefox-manifest.js');
const convert = typeof script === 'object' && script !== null && 'toFirefoxManifest' in script &&
  isConverter(script.toFirefoxManifest) ? script.toFirefoxManifest : null;

function toFirefox(lazyBackgroundDeps: string[]): FirefoxManifest {
  if (!convert) {
    throw new Error('scripts/build/firefox-manifest.js exports no toFirefoxManifest.');
  }
  return convert(manifest, { lazyBackgroundDeps, importShim: 'build/firefox-import-shim.js' });
}

describe('the Firefox manifest', () => {
  // Firefox lets an extension set the web's colour scheme through
  // browserSettings, which it asks for at install; Chromium has no such API.
  it('asks for browserSettings, which the Chromium package does not', () => {
    expect(manifest.permissions).not.toContain('browserSettings');
    expect(toFirefox([]).permissions).toContain('browserSettings');
  });

  // Firefox event pages have no importScripts: the shim, then the scripts the
  // service worker imports on first use, run before the background bundle.
  it('runs the import shim and the lazily loaded scripts before the background bundle', () => {
    expect(toFirefox(['build/pinyin-data.js']).background.scripts)
      .toEqual(['build/firefox-import-shim.js', 'build/pinyin-data.js', manifest.background.service_worker]);
  });
});
