const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const sandbox = {
  console,
  URL
};
sandbox.globalThis = sandbox;

for (const file of ['src/shared/browser-profile.js', 'src/shared/url-guards.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}

const guards = sandbox.LumnoUrlGuards;
assert.ok(guards, 'LumnoUrlGuards should be exported');

assert.strictEqual(guards.isBrowserExtensionProtocol('chrome-extension:'), true);
assert.strictEqual(guards.isRestrictedUrl('https://addons.mozilla.org/firefox/'), false,
  'Chromium may run the overlay on the Firefox add-ons site');
sandbox.chrome = { runtime: { getURL: () => 'moz-extension://uuid/' } };
assert.strictEqual(guards.isRestrictedUrl('https://addons.mozilla.org/firefox/'), true,
  'Firefox blocks content scripts on its own add-ons site');
delete sandbox.chrome;
assert.strictEqual(guards.isBrowserExtensionProtocol('https:'), false);

assert.strictEqual(guards.isBrowserNewtabUrl('chrome://newtab/'), true);
assert.strictEqual(guards.isBrowserNewtabUrl('chrome://new-tab-page/'), true);
assert.strictEqual(guards.isBrowserNewtabUrl('edge://newtab/'), true);
assert.strictEqual(guards.isBrowserNewtabUrl('chrome://extensions/'), false);
assert.strictEqual(guards.isBrowserInternalUrl('chrome://extensions/'), true);
assert.strictEqual(guards.isBrowserInternalUrl('about:blank'), true);
assert.strictEqual(guards.isBrowserInternalUrl('https://example.com/'), false);

const newtabJs = readNewtabRuntimeSource();
assert.ok(
  newtabJs.includes('isBrowserNewtabUrl(url)'),
  'newtab recent-site filtering should use the precise browser newtab guard'
);
assert.ok(
  newtabJs.includes('shouldPrioritizeTabUrl: isBrowserPageRecentUrl'),
  'newtab recent-site merging should prioritize non-newtab browser pages from open tabs'
);

assert.strictEqual(guards.isRestrictedUrl('chrome://extensions/'), true);
assert.strictEqual(guards.isRestrictedUrl('chrome-extension://abc/newtab.html'), true);
assert.strictEqual(guards.isRestrictedUrl('https://chromewebstore.google.com/detail/example/abc'), true);
assert.strictEqual(guards.isRestrictedUrl('https://chrome.google.com/webstore/detail/example/abc'), true);
assert.strictEqual(guards.isRestrictedUrl('https://microsoftedge.microsoft.com/addons/detail/example/abc'), true);
assert.strictEqual(guards.isRestrictedUrl('https://example.com/release/'), false);

assert.strictEqual(guards.canOpenOverlayOnUrl('file:///Users/kevinxu/test.html'), true);
assert.strictEqual(guards.canOpenOverlayOnUrl('https://x.com/home'), true);
assert.strictEqual(guards.canOpenOverlayOnUrl('https://chromewebstore.google.com/detail/example/abc'), false);

assert.strictEqual(guards.canFetchPageForFavicon('https://example.com/'), true);
assert.strictEqual(guards.canFetchPageForFavicon('https://chromewebstore.google.com/detail/example/abc'), false);
assert.strictEqual(guards.canFetchPageForFavicon('https://chrome.google.com/webstore/devconsole/abc'), false);
assert.strictEqual(guards.canFetchPageForFavicon('file:///Users/kevinxu/test.html'), false);

console.log('url guards ok');
