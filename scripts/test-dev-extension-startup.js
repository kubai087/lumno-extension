const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(repoRoot, 'src/background/dev-extension-startup.js'),
  'utf8'
);

function loadRuntime() {
  const sandbox = { Promise };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'dev-extension-startup.js' });
  return sandbox.LumnoDevExtensionStartup;
}

async function run() {
  const runtime = loadRuntime();
  assert.strictEqual(runtime.isSameVersionReload({ reason: 'update', previousVersion: '0.9.22' }, '0.9.22'), true);
  assert.strictEqual(runtime.isSameVersionReload({ reason: 'update', previousVersion: '0.9.21' }, '0.9.22'), false);
  assert.strictEqual(runtime.isSameVersionReload({ reason: 'chrome_update', previousVersion: '0.9.22' }, '0.9.22'), false);
  assert.strictEqual(runtime.reloadDevelopmentExtensionOnStartup, undefined);
  assert.doesNotMatch(source, /runtime\.reload\s*\(/);

  const backgroundSource = fs.readFileSync(
    path.join(repoRoot, 'src/background/background.js'),
    'utf8'
  );
  assert.match(backgroundSource, /importScripts\(chrome\.runtime\.getURL\('src\/background\/dev-extension-startup\.js'\)\)/);
  assert.match(backgroundSource, /DEV_EXTENSION_STARTUP\.isSameVersionReload\(details, chrome\.runtime\.getManifest\(\)\.version\)/);
  assert.match(
    backgroundSource,
    /chrome\.runtime\.onStartup\.addListener\(\(\) => \{\s*prepareShortcutKeyObserversInOpenTabs\(\);\s*restoreBackgroundStateOnStartup\(\);\s*\}\)/
  );
  assert.doesNotMatch(backgroundSource, /reloadDevelopmentExtensionOnStartup/);
}

run().then(() => {
  console.log('development extension startup tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
