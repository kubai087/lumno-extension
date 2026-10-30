import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT, entryOutputPath, extensionIdFromManifestKey, isRecord, readBuildEntries, readRepoJson, readRepoText, recordField, repoPath, stringField } from './repository';

// The store package scripts/build/package-store.js writes to dist/.

const EXPECTED_DEV_EXTENSION_ID = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';
// Bundles run to a few MB, past execFileSync's 1 MB default.
const ARCHIVE_READ_MAX_BUFFER = 64 * 1024 * 1024;

const manifest = readRepoJson('manifest.json');
const version = stringField(manifest, 'version');
const zipPath = repoPath(`dist/lumno-store-v${version}.zip`);

// An entry's text, or the archive's entry names without one.
function readArchive(entry?: string): string {
  const run = (command: string, args: string[]) => execFileSync(command, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: ARCHIVE_READ_MAX_BUFFER });
  if (process.platform !== 'win32') {
    return entry ? run('unzip', ['-p', zipPath, entry]) : run('zipinfo', ['-1', zipPath]);
  }
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const command = entry
    ? `$reader = [System.IO.StreamReader]::new($archive.GetEntry(${quote(entry)}).Open()); try { [Console]::Write($reader.ReadToEnd()) } finally { $reader.Dispose() }`
    : '$archive.Entries | ForEach-Object { $_.FullName }';
  return run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem; " +
    `$archive = [System.IO.Compression.ZipFile]::OpenRead(${quote(zipPath)}); try { ${command} } finally { $archive.Dispose() }`
  ]);
}

describe('store package', () => {
  let entries: string[] = [];
  let packagedManifest: Record<string, unknown> = {};

  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/build/package-store.js'], { cwd: REPO_ROOT, stdio: 'pipe' });
    entries = readArchive().split(/\r?\n/).filter(Boolean);
    const parsed: unknown = JSON.parse(readArchive('manifest.json'));
    packagedManifest = isRecord(parsed) ? parsed : {};
  }, 180000);

  it('builds from a source manifest that keeps the development extension ID', () => {
    expect(extensionIdFromManifestKey(manifest.key)).toBe(EXPECTED_DEV_EXTENSION_ID);
  });

  it('leaves out README images, the old React output folder and repository tooling', () => {
    expect(entries.filter((entry) => entry.startsWith('assets/images/readme/'))).toEqual([]);
    expect(entries.filter((entry) => entry.startsWith('src/react/'))).toEqual([]);
    expect(entries.filter((entry) => /^(?:supabase|docs|scripts|tests)\//.test(entry))).toEqual([]);
    expect(entries).not.toContain('src/package.json');
  });

  it('carries the license files', () => {
    expect(entries).toEqual(expect.arrayContaining(['LICENSE', 'THIRD_PARTY_NOTICES.md', 'build/third-party-licenses.md']));
  });

  it('ships every script only inside its bundle', () => {
    expect(entries.filter((entry) => /^src\/.*\.(?:tsx?|m?js)$/.test(entry))).toEqual([]);
    [
      'src/newtab/app/main.ts',
      'src/options/app/main.ts',
      'src/overlay/app/main.ts',
      'src/content/selection-quick-actions.ts',
      'src/background/background.ts',
      'src/content/youtube-auto-pip-page.js'
    ].forEach((file) => expect(entries).not.toContain(file));
  });

  // Every entry ships, minified, in place of the files it is built from, and
  // so does every chunk the page entries share.
  it('ships every entry and shared chunk minified, without source maps', () => {
    const built = readBuildEntries().map(entryOutputPath)
      .concat(entries.filter((entry) => /^build\/(?:injected\/)?chunks\/.+\.js$/.test(entry)));

    expect(entries).toContain('build/chunks/react-runtime.js');
    built.forEach((bundlePath) => {
      expect(entries).toContain(bundlePath);
      expect(entries).not.toContain(`${bundlePath}.map`);
      const packaged = readArchive(bundlePath);
      // An unminified bundle names each file it joins in a comment.
      expect(/^\s*\/\/ src\//m.test(packaged), `store ${bundlePath} should be minified`).toBe(false);
      expect(packaged).not.toContain('sourceMappingURL');
    });
  });

  it('ships the scripts loaded by URL or registered by the worker', () => {
    expect(entries).toEqual(expect.arrayContaining(['build/han-variants.js', 'build/pip-page-bridge.js']));
  });

  it('packages the store manifest: the built worker, no development key, the source version', () => {
    expect(recordField(packagedManifest, 'background').service_worker).toBe('build/background.js');
    expect(Object.hasOwn(packagedManifest, 'key')).toBe(false);
    expect(packagedManifest.version).toBe(version);
  });

  it.each([
    ['newtab.html', 'newtab'],
    ['src/options/options.html', 'options'],
    ['src/onboarding/onboarding.html', 'onboarding'],
    ['src/popup/popup.html', 'popup']
  ])('ships %s as written, loading its page entry as a module', (page, entry) => {
    const sourceHtml = readRepoText(page);

    expect(readArchive(page)).toBe(sourceHtml);
    expect(sourceHtml).toContain(`<script type="module" src="../../build/${entry}.js"></script>`);
  });

  it('keeps the wallpaper effect preload as the first body script of newtab.html', () => {
    expect(readArchive('newtab.html')).toMatch(/<body\b[^>]*>\s*<script src="\.\.\/\.\.\/build\/wallpaper-effect-preload\.js"><\/script>/);
  });
});
