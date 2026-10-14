const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const zipPath = path.join(repoRoot, 'dist', `lumno-store-v${manifest.version}.zip`);
const expectedDevExtensionId = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';

function readArchive(entry) {
  if (process.platform !== 'win32') return execFileSync(entry ? 'unzip' : 'zipinfo', entry ? ['-p', zipPath, entry] : ['-1', zipPath], { cwd: repoRoot, encoding: 'utf8' });
  const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
  const command = entry
    ? `$reader = [System.IO.StreamReader]::new($archive.GetEntry(${quote(entry)}).Open()); try { [Console]::Write($reader.ReadToEnd()) } finally { $reader.Dispose() }`
    : '$archive.Entries | ForEach-Object { $_.FullName }';
  return execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem; " +
    `$archive = [System.IO.Compression.ZipFile]::OpenRead(${quote(zipPath)}); try { ${command} } finally { $archive.Dispose() }`
  ], { cwd: repoRoot, encoding: 'utf8' });
}

function getExtensionIdFromManifestKey(key) {
  const publicKey = Buffer.from(String(key || ''), 'base64');
  const digestPrefix = crypto.createHash('sha256').update(publicKey).digest().subarray(0, 16);
  return Array.from(digestPrefix)
    .flatMap((byte) => [byte >> 4, byte & 0x0f])
    .map((nibble) => String.fromCharCode('a'.charCodeAt(0) + nibble))
    .join('');
}

assert.strictEqual(
  getExtensionIdFromManifestKey(manifest.key),
  expectedDevExtensionId,
  'source manifest should keep the dedicated development extension ID stable'
);

execFileSync(process.execPath, ['scripts/package-store.js'], {
  cwd: repoRoot,
  stdio: 'pipe'
});

const entries = readArchive().split(/\r?\n/).filter(Boolean);
const packagedManifest = JSON.parse(readArchive('manifest.json'));
const readPackagedText = readArchive;

assert(
  entries.every((entry) => !entry.startsWith('assets/images/readme/')),
  'store package should not include README-only images'
);
assert(
  entries.includes('src/react/newtab-islands.js') &&
    entries.includes('src/react/options-islands.js') &&
    entries.includes('src/react/onboarding-islands.js') &&
    entries.includes('src/react/overlay-islands.js') &&
    entries.includes('src/react/react-shared.js') &&
    entries.includes('src/react/tab-switcher-shared.js') &&
    entries.includes('src/react/react-runtime.js') &&
    entries.includes('src/shared/react-page-bootstrap.js'),
  'store package should include both page entries, shared React chunks, and bootstrap'
);
const retiredRenderers = [
  'src/shared/search-input-ui.js',
  'src/newtab/bookmarks-topbar.js',
  'src/newtab/page-notice.js',
  'src/newtab/toast.js',
  'src/newtab/dock.js',
  'src/newtab/recent-sites-view.js',
  'src/newtab/bookmarks-view.js',
  'src/newtab/suggestions-view.js',
  'src/newtab/shortcut-dialog.js',
  'src/newtab/shortcuts-view.js',
  'src/overlay/input-ui.js',
  'src/overlay/shell.js'
];
assert(
  retiredRenderers.every((file) => !entries.includes(file)),
  'store package should not include retired UI renderers'
);
assert(
  entries.every((entry) => !entry.startsWith('react-src/')),
  'store package should not include React source or test files'
);
assert(
  entries.every((entry) => !/^(?:supabase|docs|scripts)\//.test(entry)),
  'store package should contain no backend, deployment, or repository tooling files'
);
const developmentOnlyFiles = [
  'src/background/codex-debug-bridge.js',
  'src/shared/codex-debug-surface.js'
];
assert(
  developmentOnlyFiles.every((file) => !entries.includes(file)),
  'store package should exclude development-only Codex debug scripts'
);
[
  'newtab.html',
  'src/options/options.html',
  'src/onboarding/onboarding.html'
].forEach((file) => {
  assert(
    !readPackagedText(file).includes('codex-debug-surface.js'),
    `${file} should not load the development-only debug surface in the store package`
  );
  assert(
    fs.readFileSync(path.join(repoRoot, file), 'utf8').includes('codex-debug-surface.js'),
    `${file} should retain the debug surface in development source`
  );
});
const packagedBackground = readPackagedText('src/background/background.js');
assert(
  !/codex-debug-(?:bridge|surface)\.js|LumnoCodexDebug|codexDebugBridge/.test(packagedBackground),
  'store background should not retain development-only debug bridge references'
);
assert(
  /codex-debug-bridge\.js/.test(fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8')),
  'development background should retain the Codex debug bridge'
);
assert(
  !Object.prototype.hasOwnProperty.call(packagedManifest, 'key'),
  'store package should not include the dedicated development key'
);
assert(
  !Object.prototype.hasOwnProperty.call(packagedManifest, 'externally_connectable'),
  'store package should not expose the development-only Codex debug connection'
);
assert.strictEqual(
  packagedManifest.version,
  manifest.version,
  'store package should preserve the source manifest version'
);

console.log('package store tests passed');
