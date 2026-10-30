import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { constants, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, routeFiles } from './repository';

// Two checks guard what each surface loads, as npm run build writes it to the
// development extension's build/ folder (dist/chrome/build/; build before
// running this test):
//
// 1. Growth: one change (a PR, or a push to main) may not grow a route by more
//    than GROWTH_LIMIT_KIB over its base commit. Both sides are measured on the
//    same machine with the same zlib, so the check is exact everywhere. A
//    change that is meant to be bigger says so with a `Bundle-Growth: <why>`
//    trailer in one of its commit messages, and raises the route's ceiling in
//    the same change.
// 2. Ceilings: absolute limits a little above the sizes measured when they
//    were set, which catch slow drift.
//
// A route is every script a surface loads before it can run: its classic
// scripts and its module entry with every chunk that entry imports.
//
// The growth check measures a checkout of the base commit with its scripts
// built, named by LUMNO_BUNDLE_BASE_DIR. The base commit itself, whose later
// commit messages may carry the trailer, comes from LUMNO_BUNDLE_BASE, else
// the merge base with origin/main. CI sets both; without a built base, or
// with a base built before this layout, only the ceilings are checked.

const BUILD_DIRECTORY = 'dist/chrome/build';

const ROUTES: Record<string, string[]> = {
  'the New Tab page': ['newtab-preload.js', 'cjk-font-faces.js', 'wallpaper-effect-preload.js', 'newtab.js'],
  'the Options page': ['options-preload.js', 'cjk-font-faces.js', 'options.js'],
  'the onboarding page': ['onboarding-preload.js', 'cjk-font-faces.js', 'onboarding.js'],
  // The toolbar popup opens on every click.
  'the toolbar popup': ['cjk-font-faces.js', 'popup-preload.js', 'popup.js'],
  // Injected into web pages; the onboarding page loads the overlay for its demo too.
  'the injected overlay': ['injected/icon-font-preload.js', 'injected/overlay.js'],
  'the injected tab switcher': ['injected/icon-font-preload.js', 'injected/tab-switcher.js'],
  'the service worker': ['background.js']
};

interface Size {
  uncompressed: number;
  gzip: number;
}

const KINDS: ReadonlyArray<keyof Size> = ['uncompressed', 'gzip'];

// KiB, set from the sizes measured under Node 22 when the build moved to one
// Vite configuration.
const CEILINGS: Record<string, Size> = {
  'the New Tab page': { uncompressed: 1875, gzip: 565 },
  'the Options page': { uncompressed: 810, gzip: 240 },
  'the onboarding page': { uncompressed: 415, gzip: 125 },
  'the toolbar popup': { uncompressed: 320, gzip: 100 },
  'the injected overlay': { uncompressed: 875, gzip: 260 },
  'the injected tab switcher': { uncompressed: 265, gzip: 85 },
  'the service worker': { uncompressed: 570, gzip: 180 }
};

const GROWTH_LIMIT_KIB: Size = { uncompressed: 12, gzip: 4 };
const GROWTH_TRAILER = /^Bundle-Growth:\s*\S/im;

const kibibytes = (bytes: number) => `${(bytes / 1024).toFixed(2)} KiB`;
const gzipSize = (source: Buffer) => gzipSync(source, { level: constants.Z_BEST_COMPRESSION }).length;

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024
    });
  } catch {
    return null;
  }
}

function measure(buildDir: string): Map<string, Size> {
  const sizes = new Map<string, Size>();
  Object.entries(ROUTES).forEach(([route, files]) => {
    const loaded = routeFiles(buildDir, files);
    if (!loaded) {
      return;
    }
    const sources = loaded.map((file) => readFileSync(join(buildDir, file)));
    sizes.set(route, {
      uncompressed: sources.reduce((total, source) => total + source.length, 0),
      gzip: sources.reduce((total, source) => total + gzipSize(source), 0)
    });
  });
  return sizes;
}

function resolveBase(): string | null {
  const requested = process.env.LUMNO_BUNDLE_BASE;
  if (requested) {
    const sha = git(['rev-parse', '--verify', `${requested}^{commit}`]);
    if (!sha) {
      throw new Error(`LUMNO_BUNDLE_BASE=${requested} is not a commit in this checkout`);
    }
    return sha.trim();
  }
  const mergeBase = git(['merge-base', 'HEAD', 'origin/main']);
  return mergeBase ? mergeBase.trim() : null;
}

describe('bundle budgets', () => {
  const head = measure(join(REPO_ROOT, BUILD_DIRECTORY));

  it('measures every route of the build', () => {
    expect(Array.from(head.keys()), 'Run npm run build before checking the bundle budgets').toEqual(Object.keys(ROUTES));
  });

  it('keeps every route under its ceiling', () => {
    const over = Array.from(head).flatMap(([route, size]) => KINDS
      .filter((kind) => size[kind] > CEILINGS[route][kind] * 1024)
      .map((kind) => `${route} (${kind}) is ${kibibytes(size[kind])}; its ceiling is ${CEILINGS[route][kind]} KiB`));
    head.forEach((size, route) => {
      console.log(`  ${route}: ${kibibytes(size.uncompressed)} / ${kibibytes(size.gzip)} gzip`);
    });

    expect(over).toEqual([]);
  });

  it('grows no route past the limit of one change over its built base', () => {
    const baseDir = process.env.LUMNO_BUNDLE_BASE_DIR;
    const base = baseDir ? resolveBase() : null;
    const baseSizes = base && baseDir ? measure(join(baseDir, BUILD_DIRECTORY)) : new Map<string, Size>();
    if (!base || baseSizes.size === 0) {
      console.log('No built base in this layout for the bundle growth check; checked the ceilings only.');
      return;
    }
    const growthAccepted = GROWTH_TRAILER.test(git(['log', '--format=%B', `${base}..HEAD`]) || '');
    const report: string[] = [];
    const failures: string[] = [];
    head.forEach((size, route) => {
      const baseSize = baseSizes.get(route);
      if (!baseSize) {
        return;
      }
      KINDS.forEach((kind) => {
        const growth = size[kind] - baseSize[kind];
        report.push(`  ${route} (${kind}): ${growth >= 0 ? '+' : ''}${kibibytes(growth)}`);
        if (growth > GROWTH_LIMIT_KIB[kind] * 1024 && !growthAccepted) {
          failures.push(`${route} (${kind}) grew ${kibibytes(growth)} over ${base.slice(0, 8)}; ` +
            `one change may add ${GROWTH_LIMIT_KIB[kind]} KiB. If that is intended, add a ` +
            '"Bundle-Growth: <why>" trailer to a commit message');
        }
      });
    });
    console.log(`Bundle growth over ${base.slice(0, 8)}${growthAccepted ? ' (accepted by a Bundle-Growth trailer)' : ''}:\n${report.join('\n')}`);

    expect(failures).toEqual([]);
  });
});
