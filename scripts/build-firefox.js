// Firefox spike: turns the Chrome store package into an unpacked Firefox build.
// Run `npm run package:store` first; output lands in dist/firefox/.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const storeZip = path.join(repoRoot, 'dist', `lumno-store-v${manifest.version}.zip`);
const outDir = path.join(repoRoot, 'dist', 'firefox');
const IMPORT_SHIM = 'src/background/firefox-import-shim.js';

if (!fs.existsSync(storeZip)) {
  console.error(`Missing ${path.relative(repoRoot, storeZip)}; run npm run package:store first.`);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const unzip = spawnSync('unzip', ['-q', storeZip, '-d', outDir], { stdio: 'inherit' });
if (unzip.status !== 0) {
  process.exit(unzip.status || 1);
}

const outPath = (value) => path.join(outDir, value);
const ffManifest = JSON.parse(fs.readFileSync(outPath('manifest.json'), 'utf8'));

// Firefox MV3 has no service-worker background and no importScripts in event
// pages, so the import list becomes the ordered background.scripts array.
const backgroundEntry = ffManifest.background.service_worker;
const backgroundSource = fs.readFileSync(outPath(backgroundEntry), 'utf8');
const importBlock = backgroundSource.match(/importScripts\(([\s\S]*?)\);/);
if (!importBlock) {
  throw new Error('Could not find the importScripts block in background.js.');
}
const backgroundDeps = [...importBlock[1].matchAll(/getURL\('([^']+)'\)/g)].map((match) => match[1]);
fs.writeFileSync(
  outPath(IMPORT_SHIM),
  '// Dependencies are listed in manifest background.scripts; Firefox event pages lack importScripts.\n' +
  'globalThis.importScripts = function importScripts() {};\n'
);
ffManifest.background = { scripts: [IMPORT_SHIM, ...backgroundDeps, backgroundEntry] };

ffManifest.browser_specific_settings = {
  gecko: {
    id: 'lumno@kubai087',
    strict_min_version: '140.0',
    data_collection_permissions: { required: ['none'] }
  }
};

// Chrome's defaults collide in Firefox-based browsers: Cmd/Ctrl+Shift+K and
// +C open DevTools, and Zen binds Cmd+Shift+K/L/C (K closes unpinned tabs).
// MacCtrl+Shift and Alt (as with the tab switcher) are free in both.
const FIREFOX_COMMAND_KEYS = {
  'show-search': { default: 'Alt+K', mac: 'MacCtrl+Shift+K' },
  'show-search-prefill': { default: 'Alt+L', mac: 'MacCtrl+Shift+L' },
  'show-search-prefill-v': { default: 'Alt+C', mac: 'MacCtrl+Shift+C' }
};
Object.entries(FIREFOX_COMMAND_KEYS).forEach(([name, suggestedKey]) => {
  if (!ffManifest.commands[name]) {
    throw new Error(`Manifest command ${name} is missing.`);
  }
  ffManifest.commands[name].suggested_key = suggestedKey;
});

// Auto picture-in-picture needs requestPictureInPicture on web pages, which
// Firefox does not offer; its per-site content scripts would only add work.
const AUTO_PIP_SCRIPTS = ['src/content/site-auto-pip.js', 'src/content/youtube-auto-pip.js'];
const contentScriptCount = ffManifest.content_scripts.length;
ffManifest.content_scripts = ffManifest.content_scripts.filter((entry) =>
  !entry.js.some((script) => AUTO_PIP_SCRIPTS.includes(script)));
if (contentScriptCount - ffManifest.content_scripts.length !== AUTO_PIP_SCRIPTS.length) {
  throw new Error('Expected one content_scripts entry per auto picture-in-picture script.');
}

// Chrome-only: the _favicon service and its permission.
ffManifest.permissions = ffManifest.permissions.filter((permission) => permission !== 'favicon');
// Lets the New Tab focus swap drop the replaced tab from recently closed.
ffManifest.permissions.push('sessions');
ffManifest.web_accessible_resources.forEach((entry) => {
  entry.resources = entry.resources.filter((resource) => resource !== '_favicon/*');
});

fs.writeFileSync(outPath('manifest.json'), `${JSON.stringify(ffManifest, null, 3)}\n`);

// Browser-specific copy lives in the locale files as "<key>__firefox"
// variants. They replace their base message here, so every reader
// (chrome.i18n, fetched messages.json, __MSG_ manifest strings) gets the
// Firefox wording with no runtime branching. Chromium packages ignore them.
const FIREFOX_VARIANT_SUFFIX = '__firefox';
let variantCount = 0;
fs.readdirSync(outPath('_locales')).forEach((locale) => {
  const file = outPath(`_locales/${locale}/messages.json`);
  const messages = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.keys(messages).filter((key) => key.endsWith(FIREFOX_VARIANT_SUFFIX)).forEach((variantKey) => {
    const baseKey = variantKey.slice(0, -FIREFOX_VARIANT_SUFFIX.length);
    if (!messages[baseKey]) {
      throw new Error(`${locale}: ${variantKey} has no base message ${baseKey}.`);
    }
    messages[baseKey] = messages[variantKey];
    delete messages[variantKey];
    variantCount += 1;
  });
  fs.writeFileSync(file, `${JSON.stringify(messages, null, 2)}\n`);
});
console.log(`Firefox build ready: ${path.relative(repoRoot, outDir)} (${backgroundDeps.length} background deps, ${variantCount} Firefox messages)`);
