const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const sandbox = {
  console,
  URL
};
sandbox.globalThis = sandbox;

vm.runInNewContext(fs.readFileSync('src/shared/favicon-utils.js', 'utf8'), sandbox, {
  filename: 'src/shared/favicon-utils.js'
});

{
  // Firefox's cached icons (open tabs, top sites) stand in for _favicon.
  const index = sandbox.LumnoFaviconUtils.createBrowserIconIndex();
  index.add('https://kubai087.feishu.cn/wiki/abc#section', 'https://lf-scm-cn.feishucdn.com/favicon.ico');
  index.add('https://code.0http.com/', 'data:image/png;base64,QUJD');
  index.add('https://code.0http.com/custom', 'chrome://global/skin/icons/defaultFavicon.svg');
  index.add('moz-extension://uuid/newtab.html', 'data:image/png;base64,QUJD');
  assert.strictEqual(index.get('https://kubai087.feishu.cn/wiki/abc'), 'https://lf-scm-cn.feishucdn.com/favicon.ico',
    'an exact page matches regardless of its fragment');
  assert.strictEqual(index.get('https://kubai087.feishu.cn/docx/other'), 'https://lf-scm-cn.feishucdn.com/favicon.ico',
    'another page on the same host falls back to the host icon');
  assert.strictEqual(index.get('https://code.0http.com/custom'), 'data:image/png;base64,QUJD',
    'privileged browser icon URLs are ignored');
  assert.strictEqual(index.get('https://unknown.example/'), '');
  assert.strictEqual(index.get('moz-extension://uuid/newtab.html'), '', 'only web pages are indexed');
  index.add('https://www.code.0http.com/', 'data:image/png;base64,TkVX');
  assert.strictEqual(index.get('https://code.0http.com/elsewhere'), 'data:image/png;base64,TkVX',
    'the latest icon for a host wins, so open tabs override top sites');
}

const utils = sandbox.LumnoFaviconUtils;
assert.ok(utils, 'LumnoFaviconUtils should be exported');

assert.strictEqual(utils.normalizeFaviconHost('www.Example.com'), 'example.com');
assert.strictEqual(utils.normalizeFaviconHost('app.feishu.cn'), 'feishu.cn');

assert.strictEqual(utils.isFaviconProxyUrl('https://www.google.com/s2/favicons?domain=example.com'), true);
assert.strictEqual(utils.isFaviconProxyUrl('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&fallbackToHost=0'), true);
assert.strictEqual(utils.isFaviconProxyUrl('https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fexample.com%2F'), true);
assert.strictEqual(utils.isFaviconProxyUrl('https://example.com/favicon.ico'), false);
assert.strictEqual(utils.isFaviconProxyUrl('https://favicon.is/example.com?larger=true'), true);
assert.strictEqual(utils.getPageUrlFromFaviconProxyUrl('https://favicon.is/example.com?larger=true&url=https://wrong.example/'),
  'https://example.com/', 'Favicon.is target matching must use its domain path, not an arbitrary query parameter');
for (const spoof of ['https://favicon.is.evil.test/example.com', 'http://favicon.is/example.com',
  'https://favicon.is/https://example.com/', 'https://favicon.is/example.com%2Fprivate', 'https://favicon.is/']) {
  assert.strictEqual(utils.isFaviconIsUrl(spoof), false, 'only the documented HTTPS domain endpoint is valid');
}
assert.strictEqual(
  utils.isSafeVirtualFaviconRequestUrl('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&fallbackToHost=0'),
  true
);
assert.strictEqual(utils.isSafeVirtualFaviconRequestUrl('chrome://favicon2/?pageUrl=https%3A%2F%2Fexample.com%2F'), true);
assert.strictEqual(
  utils.isSafeVirtualFaviconRequestUrl('https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fexample.com%2F'),
  false
);
assert.strictEqual(utils.isSafeVirtualFaviconRequestUrl('https://example.com/favicon.ico'), false);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy('https://foo.example.com/favicon.ico', false),
  false,
  'strict favicon mode should reject direct target-site HTTP(S) icons'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.example.com%2F',
    false
  ),
  true,
  'disabled enhanced fetching should keep approved third-party favicon proxies'
);
assert.strictEqual(utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
  'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.example.com%2F', false,
  { allowThirdPartyFetch: false }
), false, 'site exclusions should still reject third-party services');
assert.strictEqual(utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
  'https://cdn.example.com/icon.png', false, { allowRemoteImage: true }
), false, 'disabled enhanced fetching must reject even explicitly configured website images');
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F&fallbackToHost=0',
    false,
    { ownExtensionId: 'abc' }
  ),
  true,
  'strict favicon mode should keep Lumno-owned _favicon endpoints'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://other/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F',
    false,
    { ownExtensionId: 'abc' }
  ),
  false,
  'strict favicon mode should reject other extensions\' _favicon endpoints'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://other/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F',
    true,
    { ownExtensionId: 'abc' }
  ),
  false,
  'enhanced favicon mode should still reject other extensions\' _favicon endpoints'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy('data:image/png;base64,c2FmZQ=='),
  true,
  'strict favicon mode should fail closed before the setting loads while keeping data URLs'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://abc/assets/images/lumno.png',
    false,
    { ownExtensionId: 'abc' }
  ),
  true,
  'strict favicon mode should keep Lumno-owned extension assets'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://abc/assets/images/site-search/tile-gg.png',
    false,
    { ownExtensionId: 'abc' }
  ),
  true,
  'strict favicon mode should keep bundled site-search tile artwork'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://abc/assets/images/site-search/tile-ddg.png',
    false,
    { ownExtensionId: 'abc' }
  ),
  true,
  'strict favicon mode should keep the shared bundled site-search PNG tiles'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://other/assets/images/site-search/tile-ddg.png',
    true,
    { ownExtensionId: 'abc' }
  ),
  false,
  'enhanced favicon mode should reject another extension\'s site-search artwork'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://abc/assets/images/site-search/duckduckgo.html',
    true,
    { ownExtensionId: 'abc' }
  ),
  false,
  'enhanced favicon mode should only allow image artwork from the bundled provider directory'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://other/assets/images/icon.png',
    false,
    { ownExtensionId: 'abc' }
  ),
  false,
  'strict favicon mode should reject other extension assets'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://abc/src/options/options.html',
    false,
    { ownExtensionId: 'abc' }
  ),
  false,
  'strict favicon mode should reject arbitrary own-extension paths outside approved favicon assets'
);
assert.strictEqual(
  utils.isFaviconSourceAllowedByEnhancedFetchPolicy(
    'chrome-extension://abc/src/options/options.html',
    true,
    { ownExtensionId: 'abc' }
  ),
  false,
  'enhanced favicon mode should reject arbitrary own-extension paths outside approved favicon assets'
);

const decisionLogs = [];
const logFaviconDecision = utils.createFaviconDecisionLogger({
  surface: 'test',
  consoleObj: {
    debug(prefix, payload) {
      decisionLogs.push({ prefix, payload });
    }
  }
});
logFaviconDecision(
  'https://user:secret@foo.example.com/private/icon.png?token=secret',
  'exclusion',
  { pageUrl: 'https://foo.example.com/private?credential=secret', candidateKind: 'direct' }
);
logFaviconDecision(
  'https://foo.example.com/another-private-icon.png',
  'exclusion',
  { pageUrl: 'https://foo.example.com/private/child', candidateKind: 'direct' }
);
logFaviconDecision(
  'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.example.com%2Fprivate',
  'exclusion',
  { pageUrl: 'https://foo.example.com/private', candidateKind: 'third-party-proxy' }
);
assert.strictEqual(decisionLogs.length, 1, 'favicon decision logs should dedupe identical surface/host/reason decisions');
assert.strictEqual(decisionLogs[0].prefix, '[Lumno][favicon]');
assert.deepStrictEqual(JSON.parse(JSON.stringify(decisionLogs[0].payload)), {
  surface: 'test',
  candidateKind: 'direct',
  hostname: 'foo.example.com',
  decision: 'blocked',
  reason: 'exclusion'
});
assert.strictEqual(JSON.stringify(decisionLogs).includes('secret'), false, 'favicon logs must redact URL paths, queries, and credentials');

assert.strictEqual(
  utils.getExtensionFaviconUrl('https://example.com/a b', {
    getRuntimeUrl: (path) => `chrome-extension://abc${path}`
  }),
  'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fa+b&size=128&fallbackToHost=0'
);
assert.strictEqual(utils.getExtensionFaviconUrl('chrome://extensions/', {
  getRuntimeUrl: (path) => `chrome-extension://abc${path}`
}), '');
assert.strictEqual(
  utils.getGstaticFaviconUrl('https://example.com/a b'),
  'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fexample.com%2Fa+b&size=128'
);
assert.strictEqual(
  utils.getChromeFaviconUrl('chrome://newtab/'),
  'chrome://favicon2/?pageUrl=chrome%3A%2F%2Fnewtab%2F&size=128'
);
assert.strictEqual(
  utils.getChromeFaviconUrl('http://192.168.1.8/dashboard'),
  '',
  'web pages must not use chrome://favicon2 when the exact extension endpoint is unavailable'
);
assert.strictEqual(
  utils.getChromeFaviconUrl('http://192.168.1.8/dashboard', {
    getRuntimeUrl: (path) => `chrome-extension://abc${path}`
  }),
  'chrome-extension://abc/_favicon/?pageUrl=http%3A%2F%2F192.168.1.8%2Fdashboard&size=128&fallbackToHost=0'
);
const browserPageFaviconUrl = utils.getBrowserPageFaviconUrl('chrome://extensions/', {
  getRuntimeUrl: (path) => `chrome-extension://abc${path}`
});
assert.strictEqual(
  browserPageFaviconUrl,
  'chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128'
);
assert.strictEqual(browserPageFaviconUrl.startsWith('data:'), false);
assert.strictEqual(
  utils.getBrowserPageFaviconUrl('chrome://extensions/'),
  'chrome://favicon2/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128'
);
assert.strictEqual(utils.getBrowserPageFaviconUrl('https://example.com/'), '');
assert.strictEqual(typeof utils.createFaviconUrlResolver, 'function');
const resolver = utils.createFaviconUrlResolver({
  getRuntimeUrl: (path) => `chrome-extension://abc${path}`,
  shouldBlockFaviconForHost: (host) => ['extensions', '127.0.0.1'].includes(String(host || '').toLowerCase())
});
let strictEnhancedFetchState;
const strictResolver = utils.createFaviconUrlResolver({
  getRuntimeUrl: (path) => `chrome-extension://abc${path}`,
  isEnhancedFaviconFetchEnabled: () => strictEnhancedFetchState
});
const strictPlanBeforeSettingsLoad = strictResolver.buildFaviconCandidatePlan({
  pageUrl: 'https://foo.example.com/',
  primaryUrl: 'https://foo.example.com/favicon.ico'
});
assert.strictEqual(
  strictPlanBeforeSettingsLoad.map((candidate) => candidate.url).join('\n'),
  'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F&size=128&fallbackToHost=0',
  'favicon candidate resolution should fail closed before settings load without direct or gstatic sources'
);
assert.strictEqual(
  strictResolver.getSafeFaviconCandidateUrl(
    'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F&fallbackToHost=0',
    'https://foo.example.com/',
    'browser-cache'
  ),
  'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F&fallbackToHost=0',
  'strict resolver should retain Lumno-owned _favicon sources'
);
assert.strictEqual(
  strictResolver.getSafeFaviconCandidateUrl(
    'chrome-extension://abc/assets/images/site-search/tile-ddg.png',
    'chrome-extension://abc/assets/images/site-search/tile-ddg.png',
    'bundled-provider'
  ),
  'chrome-extension://abc/assets/images/site-search/tile-ddg.png',
  'strict resolver should retain bundled site-search artwork'
);
assert.strictEqual(
  strictResolver.getSafeFaviconCandidateUrl(
    'chrome-extension://other/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F',
    'https://foo.example.com/',
    'browser-cache'
  ),
  '',
  'strict resolver should turn other-extension _favicon sources into generic fallback'
);
strictEnhancedFetchState = true;
const automaticPageUrl = 'https://foo.example.com/account';
const automaticIconUrl = 'https://foo.example.com/favicon.ico?unread=3';
const automaticBrowserUrl = strictResolver.getExtensionFaviconUrl(automaticPageUrl);
const staleRootBrowserUrl = strictResolver.getExtensionFaviconUrl('https://foo.example.com/');
assert.strictEqual(strictResolver.getSafeFaviconCandidateUrl(staleRootBrowserUrl, automaticPageUrl), '',
  'the shared resolver must reject root-page browser artwork for a different page');
assert.strictEqual(strictResolver.resolveFaviconSource(staleRootBrowserUrl, automaticPageUrl), automaticBrowserUrl,
  'rendering must reacquire the exact page instead of accepting a stale root-page source');
const nestedFaviconPage = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
const differentFaviconPages = [
  'https://chrome.google.com/',
  'https://chrome.google.com/webstore/',
  'https://chrome.google.com/webstore/devconsole?hl=en',
  'https://chrome.google.com/webstore/devconsole/?hl=zh-CN',
  'https://chrome.google.com/webstore%2Fdevconsole?hl=zh-CN',
  'http://chrome.google.com/webstore/devconsole?hl=zh-CN',
  'https://chrome.google.com:8443/webstore/devconsole?hl=zh-CN',
  'https://www.chrome.google.com/webstore/devconsole?hl=zh-CN'
];
for (const getSource of [
  (page) => strictResolver.getExtensionFaviconUrl(page),
  (page) => strictResolver.getChromeFaviconUrl(page),
  (page) => strictResolver.getGstaticFaviconUrl(page)
]) {
  differentFaviconPages.forEach((page) => {
    assert.strictEqual(strictResolver.getSafeFaviconCandidateUrl(getSource(page), nestedFaviconPage), '',
      'different paths, parameters, schemes, ports and subdomains must not share proxy artwork');
  });
  assert.ok(strictResolver.getSafeFaviconCandidateUrl(getSource(`${nestedFaviconPage}#intro`), nestedFaviconPage),
    'fragments on the same document may reuse its icon');
}
const oldChromeSource = `chrome://favicon2/?url=${encodeURIComponent(nestedFaviconPage)}&fallbackToHost=1`;
const normalizedChromeSource = new URL(strictResolver.getSafeFaviconCandidateUrl(oldChromeSource, nestedFaviconPage));
assert.strictEqual(normalizedChromeSource.protocol, 'chrome-extension:',
  'legacy web-page chrome://favicon2 sources must be replaced by the exact extension endpoint');
assert.strictEqual(normalizedChromeSource.searchParams.get('pageUrl'), nestedFaviconPage);
assert.strictEqual(normalizedChromeSource.searchParams.has('url'), false);
assert.strictEqual(normalizedChromeSource.searchParams.get('fallbackToHost'), '0',
  'legacy Chrome virtual URLs must use exact-page matching as well');
const overriddenResolver = utils.createFaviconUrlResolver({
  getRuntimeUrl: (path) => `chrome-extension://abc${path}`,
  getExtensionFaviconUrl: () => staleRootBrowserUrl,
  getChromeFaviconUrl: () => strictResolver.getChromeFaviconUrl('https://foo.example.com/'),
  getGstaticFaviconUrl: () => strictResolver.getGstaticFaviconUrl('https://foo.example.com/')
});
for (const name of ['getExtensionFaviconUrl', 'getChromeFaviconUrl', 'getGstaticFaviconUrl']) {
  assert.strictEqual(utils.getPageUrlFromFaviconProxyUrl(overriddenResolver[name](automaticPageUrl)), automaticPageUrl,
    'custom callbacks must not collapse a requested page to its origin');
}
const customProviderIcon = 'https://cdn.example.com/custom-search.png';
assert.strictEqual(strictResolver.resolveFaviconSource(automaticIconUrl, automaticPageUrl), automaticBrowserUrl,
  'tab icon URLs should resolve through Chrome even with enhanced fetching enabled');
assert.strictEqual(strictResolver.getSafeFaviconCandidateUrl(automaticIconUrl, automaticPageUrl), '',
  'website icon URLs must not be used for automatic loading or theme extraction');
assert.strictEqual(strictResolver.getProviderFaviconUrl(automaticPageUrl, customProviderIcon), customProviderIcon,
  'explicit custom provider artwork should remain available with enhanced fetching enabled');
const automaticPlan = strictResolver.buildFaviconCandidatePlan({
  pageUrl: automaticPageUrl,
  primaryUrl: automaticIconUrl,
  persistedUrl: automaticIconUrl,
  persistedDataUrl: 'data:image/png;base64,Y2FjaGVk'
});
assert.strictEqual(automaticPlan[0].url, 'data:image/png;base64,Y2FjaGVk', 'cached image bytes should come first');
assert.strictEqual(automaticPlan[1].url, automaticBrowserUrl, 'Chrome should precede third-party sources');
assert.strictEqual(automaticPlan.some((candidate) => candidate.url === automaticIconUrl), false,
  'old persisted website icon URLs must not enter the automatic source plan');
assert.ok(automaticPlan[2].url.includes('gstatic.cn/faviconV2'), 'enhanced mode should retain a proxy fallback');
const stableShortcutPlan = strictResolver.buildFaviconCandidatePlan({
  pageUrl: automaticPageUrl,
  sourceProfile: 'shortcut',
  skipPersisted: true,
  primaryUrl: automaticBrowserUrl,
  pageSpecificUrl: 'data:image/png;base64,c25hcHNob3Q='
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(stableShortcutPlan.map((candidate) => candidate.url))),
  ['data:image/png;base64,c25hcHNob3Q='], 'shortcut rendering must use saved images without live browser or remote fallbacks');
assert.strictEqual(strictResolver.buildFaviconCandidatePlan({
  pageUrl: automaticPageUrl, sourceProfile: 'shortcut', skipPersisted: true
}).length, 0, 'a shortcut without saved artwork should show a placeholder while its image is acquired');
const bundledShortcutIcon = 'chrome-extension://abc/assets/images/site-search/tile-xhs.png';
assert.strictEqual(strictResolver.getShortcutFaviconCandidateUrl(automaticPageUrl, bundledShortcutIcon), bundledShortcutIcon);
assert.strictEqual(strictResolver.getShortcutFaviconCandidateUrl(automaticPageUrl, automaticBrowserUrl), '',
  'shortcut artwork must not derive from the live Chrome cache');
const stableFetchUrl = strictResolver.getShortcutFaviconFetchUrl(`${automaticPageUrl}?unread=3#section`);
assert.strictEqual(new URL(stableFetchUrl).searchParams.get('url'), 'https://foo.example.com/account?unread=3',
  'shortcut acquisition must preserve the full page path and query, removing only the fragment');
assert.strictEqual(new URL(automaticBrowserUrl).searchParams.get('fallbackToHost'), '0',
  'browser-cache requests must disable matching an unrelated icon from the same host');
assert.deepStrictEqual(Array.from(strictResolver.getShortcutFaviconFetchCandidates(automaticPageUrl), (item) => item.kind),
  ['browser-cache', 'proxy'], 'exact-page Chrome artwork must precede third-party artwork');
const faviconIsCandidates = strictResolver.getShortcutFaviconFetchCandidates(`${automaticPageUrl}?private=1#section`, 'favicon-is');
assert.strictEqual(faviconIsCandidates.length, 1);
assert.strictEqual(faviconIsCandidates[0].url, 'https://favicon.is/foo.example.com?larger=true');
assert.strictEqual(strictResolver.getSafeFaviconCandidateUrl(faviconIsCandidates[0].url, automaticPageUrl), '',
  'an automatic candidate must not relax exact-page matching for a domain icon');
assert.strictEqual(strictResolver.getSafeFaviconCandidateUrl(faviconIsCandidates[0].url, automaticPageUrl,
  'shortcut-snapshot', { allowDomainProxy: true }), faviconIsCandidates[0].url);
assert.strictEqual(strictResolver.getSafeFaviconCandidateUrl('https://favicon.is/other.example.com?larger=true',
  automaticPageUrl, 'shortcut-snapshot', { allowDomainProxy: true }), '', 'explicit domain matching must still reject other hosts');
assert.strictEqual(strictResolver.getSafeFaviconCandidateUrl(staleRootBrowserUrl, automaticPageUrl,
  'shortcut-snapshot', { allowDomainProxy: true }), '', 'domain matching must not weaken Chrome exact-page matching');
assert.strictEqual(strictResolver.getShortcutFaviconFetchCandidates('chrome://settings/', 'favicon-is').length, 0);
const blockedDomainResolver = utils.createFaviconUrlResolver({ shouldBlockFaviconForHost: host => host === 'foo.example.com' });
assert.strictEqual(blockedDomainResolver.getShortcutFaviconFetchCandidates(automaticPageUrl, 'favicon-is').length, 0,
  'Favicon.is must respect hostname blocks');
strictEnhancedFetchState = false;
assert.strictEqual(strictResolver.getShortcutFaviconFetchCandidates(automaticPageUrl, 'favicon-is').length, 1,
  'Favicon.is remains available with enhanced fetching disabled');
assert.ok(strictResolver.getShortcutFaviconFetchUrl(automaticPageUrl).startsWith('https://t2.gstatic.cn/'),
  'approved remote shortcut acquisition remains available with enhanced fetching disabled');
assert.deepStrictEqual(Array.from(strictResolver.getShortcutFaviconFetchCandidates(automaticPageUrl), (item) => item.url),
  [automaticBrowserUrl, strictResolver.getShortcutFaviconFetchUrl(automaticPageUrl)],
  'disabled enhanced fetching should prefer Chrome and retain the approved service fallback');
assert.strictEqual(strictResolver.getShortcutFaviconCandidateUrl(automaticPageUrl, bundledShortcutIcon), bundledShortcutIcon,
  'strict mode should retain fixed bundled shortcut artwork');
assert.strictEqual(strictResolver.getProviderFaviconUrl(automaticPageUrl, customProviderIcon), automaticBrowserUrl,
  'custom remote artwork must respect the enhanced-fetch switch');
assert.strictEqual(strictResolver.getProviderFaviconUrl(automaticPageUrl, 'chrome-extension://abc/assets/images/site-search/tile-ddg.png'),
  'chrome-extension://abc/assets/images/site-search/tile-ddg.png', 'bundled artwork should remain available with enhanced fetching disabled');
assert.strictEqual(strictResolver.resolveFaviconSource('data:image/png;base64,Y2FjaGVk', automaticPageUrl),
  'data:image/png;base64,Y2FjaGVk', 'local tab image bytes should remain usable');
strictEnhancedFetchState = true;
for (const spoofedProxy of [
  'https://example.com/gstatic.cn/faviconV2',
  'https://gstatic.cn.example.com/faviconV2',
  'https://example.com/?icon=https://www.google.com/s2/favicons',
  'https://t2.gstatic.cn/other.png'
]) {
  assert.strictEqual(utils.isFaviconProxyUrl(spoofedProxy), false, 'proxy identification must use the actual host and path');
  assert.strictEqual(utils.isFaviconSourceAllowedByEnhancedFetchPolicy(spoofedProxy, true), false,
    'arbitrary website URLs must not masquerade as an approved third-party source');
}
assert.ok(
  strictResolver.buildFaviconCandidatePlan({
    pageUrl: 'https://foo.example.com/',
    primaryUrl: 'https://foo.example.com/favicon.ico'
  }).some((candidate) => candidate.url.includes('gstatic.cn/faviconV2')),
  'enhanced mode should preserve the existing gstatic fallback behavior'
);
const excludedResolver = utils.createFaviconUrlResolver({
  getRuntimeUrl: (path) => `chrome-extension://abc${path}`,
  isEnhancedFaviconFetchEnabled: (pageUrl) => pageUrl !== 'https://foo.example.com/private',
  getStrictFaviconReason: (pageUrl) => pageUrl === 'https://foo.example.com/private' ? 'exclusion' : ''
});
assert.strictEqual(excludedResolver.getShortcutFaviconFetchUrl('https://foo.example.com/private'), '',
  'origin-only shortcut acquisition must still enforce full-page exclusions');
assert.strictEqual(excludedResolver.getShortcutFaviconFetchCandidates('https://foo.example.com/private', 'favicon-is').length, 0,
  'Favicon.is domain requests must still enforce full-page exclusions');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(excludedResolver.buildFaviconCandidatePlan({
    pageUrl: 'https://foo.example.com/private',
    primaryUrl: 'https://foo.example.com/favicon.ico'
  }).map((candidate) => candidate.url))),
  ['chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2Fprivate&size=128&fallbackToHost=0'],
  'a path-specific exclusion should block direct and gstatic candidates while keeping browser cache'
);
assert.ok(
  excludedResolver.buildFaviconCandidatePlan({
    pageUrl: 'https://foo.example.com/public',
    primaryUrl: 'https://foo.example.com/favicon.ico'
  }).some((candidate) => candidate.url.includes('gstatic.cn/faviconV2')),
  'a nonexcluded path on the same hostname should preserve enhanced candidates'
);
assert.strictEqual(
  resolver.getExtensionFaviconUrl('https://example.com/docs'),
  'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=128&fallbackToHost=0'
);
assert.strictEqual(
  resolver.getPageFaviconCandidateUrl('https://example.com/docs'),
  'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=128&fallbackToHost=0',
  'HTTP pages should prefer the extension _favicon candidate'
);
assert.strictEqual(
  utils.getFaviconPersistCacheKey('https://Example.com/docs?mode=compact#section', 'example.com'),
  'page:https://example.com/docs?mode=compact',
  'persisted favicon caches should isolate HTTP pages while ignoring fragments'
);
assert.strictEqual(
  utils.getFaviconPersistCacheKey('chrome://extensions/', 'extensions'),
  'extensions',
  'non-web pages should retain the existing fallback cache key'
);
assert.strictEqual(
  resolver.getPageFaviconCandidateUrl('chrome://extensions/'),
  'chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128',
  'browser-internal pages should use the browser-page _favicon candidate'
);
const browserPageRenderCandidates = resolver.getPageFaviconRenderCandidates('chrome://extensions/', '');
assert.strictEqual(
  browserPageRenderCandidates.primaryUrl,
  'chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128',
  'browser-internal render candidates should prefer _favicon'
);
assert.strictEqual(
  browserPageRenderCandidates.browserUrl,
  'chrome://favicon2/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128',
  'browser-internal render candidates should keep chrome://favicon2 as fallback'
);
assert.strictEqual(
  resolver.getPageFaviconCandidateUrl('chrome-extension://abc/src/options/options.html'),
  'chrome-extension://abc/assets/images/lumno.png',
  'own extension options page should force the Lumno icon'
);
assert.strictEqual(
  resolver.getPageFaviconCandidateUrl('chrome-extension://abc/newtab.html'),
  'chrome-extension://abc/assets/images/lumno.png',
  'own extension newtab page should force the Lumno icon'
);
assert.notStrictEqual(
  resolver.getPageFaviconCandidateUrl('chrome-extension://other/src/options/options.html'),
  'chrome-extension://abc/assets/images/lumno.png',
  'other extension pages should not use the Lumno icon'
);
assert.strictEqual(
  resolver.getPageFaviconCandidateUrl('chrome-extension://other/src/options/options.html'),
  '',
  'other extension pages should use a generic UI fallback instead of chrome://favicon2'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(resolver.getPageFaviconRenderCandidates(
    'chrome-extension://other/src/options/options.html',
    'chrome://favicon2/?pageUrl=chrome-extension%3A%2F%2Fother%2Fsrc%2Foptions%2Foptions.html'
  ))),
  { primaryUrl: '', browserUrl: '' },
  'other extension render candidates should not expose chrome://favicon2'
);
assert.strictEqual(
  resolver.isBlockedFaviconUrl('chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128'),
  false,
  'browser-internal favicon candidates must not be blocked by the synthetic host name'
);
assert.strictEqual(
  resolver.getSafeFaviconCandidateUrl('chrome-extension://abc/_favicon/?pageUrl=http%3A%2F%2F127.0.0.1%2F&size=128&fallbackToHost=0'),
  '',
  'local HTTP favicon candidates should still be blocked when the caller blocks their host'
);
const plan = resolver.buildFaviconCandidatePlan({
  primaryUrl: 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=128&fallbackToHost=0',
  browserUrl: 'chrome://favicon2/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=128',
  pageUrl: 'https://example.com/docs'
});
assert.strictEqual(
  plan.map((candidate) => candidate.kind).join(','),
  'primary,gstatic',
  'candidate plans should dedupe the exact extension source after replacing chrome://favicon2'
);
assert.strictEqual(resolver.getFaviconProxyCheckKind(plan[0]), 'extension');
assert.strictEqual(resolver.getFaviconProxyCheckKind(plan[1]), 'gstatic');
const pageSpecificPlan = resolver.buildFaviconCandidatePlan({
  pageUrl: 'https://x.com/home',
  pageSpecificUrl: 'data:image/png;base64,eA==',
  persistedDataUrl: 'data:image/jpeg;base64,c3RhbGU=',
  persistedUrl: 'https://x.com/stale.ico',
  primaryUrl: 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fx.com%2Fhome&size=128&fallbackToHost=0',
  skipPersisted: true
});
assert.strictEqual(
  pageSpecificPlan.map((candidate) => candidate.kind).join(','),
  'page-specific,primary,gstatic',
  'page-specific icons should lead browser and proxy fallbacks without reading shared host cache entries'
);
assert.strictEqual(
  pageSpecificPlan[0].url,
  'data:image/png;base64,eA==',
  'the full-page icon should remain the first render candidate'
);
assert.strictEqual(utils.getChromeFaviconUrl(''), '');
assert.strictEqual(
  utils.getPageUrlFromFaviconProxyUrl('https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fwww.lovart.ai%2Fhome&size=128'),
  'https://www.lovart.ai/home'
);
assert.strictEqual(
  utils.getPageUrlFromFaviconProxyUrl('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fwww.lovart.ai%2Fhome&size=128&fallbackToHost=0'),
  'https://www.lovart.ai/home'
);
assert.strictEqual(
  utils.getCanonicalPageUrlForFavicon('https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fwww.lovart.ai%2Fhome&size=128'),
  'https://www.lovart.ai/home'
);
assert.strictEqual(
  utils.getCanonicalPageUrlForFavicon('https://example.com/docs'),
  'https://example.com/docs'
);
assert.strictEqual(
  utils.getCanonicalFaviconHost('https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fwww.lovart.ai%2Fhome&size=128'),
  'lovart.ai'
);

assert.strictEqual(utils.shouldBlockFaviconForHost('localhost'), false);
assert.strictEqual(utils.shouldBlockFaviconForHost('192.168.1.8'), false);
assert.strictEqual(utils.shouldBlockFaviconForHost('service.internal'), false);
assert.strictEqual(utils.shouldBlockFaviconForHost('example.com'), false);
assert.strictEqual(
  typeof utils.shouldAvoidDirectFaviconForHost,
  'function',
  'favicon utils should expose a direct favicon avoidance predicate'
);
assert.strictEqual(utils.shouldAvoidDirectFaviconForHost('localhost'), true);
assert.strictEqual(utils.shouldAvoidDirectFaviconForHost('192.168.1.8'), true);
assert.strictEqual(utils.shouldAvoidDirectFaviconForHost('10.1.2.3'), true);
assert.strictEqual(utils.shouldAvoidDirectFaviconForHost('service.internal'), true);
assert.strictEqual(utils.shouldAvoidDirectFaviconForHost('example.com'), false);
const localHostPolicy = utils.getFaviconHostPolicy('192.168.1.8');
assert.strictEqual(localHostPolicy.hardBlocked, false);
assert.strictEqual(localHostPolicy.avoidDirect, true);
assert.strictEqual(utils.shouldBlockDirectFaviconHost('service.internal'), true);
const proxyLocalPolicy = utils.getFaviconUrlPolicy('https://t2.gstatic.cn/faviconV2?url=http%3A%2F%2F192.168.1.8%2F&size=128');
assert.strictEqual(proxyLocalPolicy.hardBlocked, false);
assert.strictEqual(proxyLocalPolicy.avoidDirect, false);

assert.strictEqual(utils.isBlockedLocalFaviconUrl('https://127.0.0.1/favicon.ico'), true);
assert.strictEqual(utils.isBlockedLocalFaviconUrl('http://192.168.1.8/favicon.ico'), true);
assert.strictEqual(utils.isBlockedLocalFaviconUrl('https://service.internal/favicon.svg'), true);
assert.strictEqual(utils.isBlockedLocalFaviconUrl('https://example.com/icon.png?pageUrl=http%3A%2F%2F192.168.1.8%2F'), true);
assert.strictEqual(utils.isBlockedLocalFaviconUrl('chrome-extension://abc/assets/images/lumno.png'), false);
assert.strictEqual(
  utils.isBlockedLocalFaviconUrl('chrome://favicon2/?url=http%3A%2F%2F192.168.1.8%2F'),
  false
);
assert.strictEqual(utils.isBlockedLocalFaviconUrl('chrome://favicon2/?url=localhost'), false);
assert.strictEqual(
  utils.isBlockedLocalFaviconUrl('chrome://favicon2/?url=https%3A%2F%2Fexample.com%2F'),
  false
);
assert.strictEqual(
  utils.isBlockedLocalFaviconUrl('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&size=128&fallbackToHost=0'),
  false
);
assert.strictEqual(
  utils.isBlockedLocalFaviconUrl('chrome-extension://abc/_favicon/?pageUrl=http%3A%2F%2F192.168.1.8%2F&size=128&fallbackToHost=0'),
  false
);
assert.strictEqual(
  utils.isBlockedLocalFaviconUrl('https://t2.gstatic.cn/faviconV2?url=http%3A%2F%2F192.168.1.8%2F&size=128'),
  false
);
assert.strictEqual(utils.isBlockedLocalFaviconUrl('https://example.com/favicon.ico'), false);

assert.strictEqual(utils.hasThemeTokenInUrl('https://example.com/favicon-dark.svg', 'dark'), true);
assert.strictEqual(utils.shouldSkipThemeUpgradeCandidate('https://example.com/favicon-light.svg', 'dark', ''), true);
assert.strictEqual(utils.shouldSkipThemeUpgradeCandidate('https://example.com/favicon.svg', 'dark', 'https://example.com/favicon-dark.svg'), true);

const darkGithubCandidates = utils.getKnownThemedFaviconCandidateUrls('github.com', 'dark');
assert.strictEqual(darkGithubCandidates[0], 'https://github.githubassets.com/favicons/favicon-dark.svg');
assert.strictEqual(utils.hostHasExplicitDarkFavicon('gist.github.com'), true);

const autoGithubScores = utils.getKnownThemedFaviconCandidateScores('github.com', '');
assert.strictEqual(autoGithubScores.map((candidate) => candidate.score).join(','), '52,52,36');

const darkRootCandidates = utils.getRootFaviconCandidateScores('www.Example.com', 'dark');
assert.strictEqual(darkRootCandidates[0].url, 'https://example.com/favicon-dark.svg');
assert.strictEqual(darkRootCandidates.map((candidate) => candidate.score).join(','), '34,28,16,24,16');

const darkRootCandidateUrls = utils.getRootFaviconCandidateUrls('www.Example.com', 'dark');
assert.strictEqual(darkRootCandidateUrls.slice(0, 5).join('\n'), [
  'https://example.com/favicon-dark.svg',
  'https://example.com/favicon.svg',
  'https://example.com/favicon.png',
  'https://example.com/favicon.ico',
  'https://example.com/favicon-32x32.png'
].join('\n'));
assert.ok(darkRootCandidateUrls.includes('https://example.com/apple-touch-icon-precomposed.png'));

const htmlIconCandidates = utils.parseHtmlIconCandidateScores(`
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="32x32" media="(prefers-color-scheme: dark)" data-base-href="/assets/favicon">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
`, 'https://example.com/page', 'dark');
assert.strictEqual(htmlIconCandidates[0].url, 'https://example.com/favicon.svg');
assert.strictEqual(htmlIconCandidates[0].score, 88);
assert.ok(htmlIconCandidates.some((candidate) => candidate.url === 'https://example.com/favicon-dark.svg' && candidate.score === 102));
assert.ok(htmlIconCandidates.some((candidate) => candidate.url === 'https://example.com/assets/favicon-dark.svg'));

assert.strictEqual(
  utils.getThemeFaviconCandidateUrls([
    'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128&fallbackToHost=0',
    'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128',
    'chrome://favicon2/?url=https%3A%2F%2Fmp.weixin.qq.com%2F',
    'https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png',
    'https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png'
  ]).join('\n'),
  [
    'https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png',
    'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128&fallbackToHost=0',
    'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128'
  ].join('\n')
);

assert.strictEqual(utils.parseCssThemeColor('#0f8').join(','), '0,255,136');
assert.strictEqual(utils.parseCssThemeColor('rgba(10, 20, 30, 0.5)').join(','), '10,20,30');
assert.strictEqual(utils.parseCssThemeColor('transparent'), null);
assert.strictEqual(utils.isNeutralThemeColor([255, 255, 255]), true);
assert.strictEqual(utils.isNeutralThemeColor([31, 35, 39]), true);
assert.strictEqual(utils.isNeutralThemeColor([234, 100, 217]), false);
assert.strictEqual(utils.isPlaceholderFaviconColor([95, 99, 104]), true);
assert.strictEqual(utils.isPlaceholderFaviconColor([100, 103, 110]), true);
assert.strictEqual(utils.isPlaceholderFaviconColor([154, 160, 166]), true);
assert.strictEqual(utils.isPlaceholderFaviconColor([36, 41, 46]), false);
assert.strictEqual(utils.isPlaceholderFaviconColor([255, 36, 66]), false);
assert.strictEqual(utils.isPlaceholderFaviconColor(null), false);

const themeColorCandidates = utils.parseHtmlThemeColorCandidates(`
  <meta name="theme-color" content="#112233" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <link rel="manifest" href="/site.webmanifest">
`, 'https://example.com/docs/page', 'dark');
assert.strictEqual(themeColorCandidates[0].accentRgb.join(','), '17,34,51');
assert.strictEqual(themeColorCandidates[0].score, 108);
assert.ok(themeColorCandidates.some((candidate) => candidate.manifestUrl === 'https://example.com/site.webmanifest'));
assert.strictEqual(utils.pickBestThemeColorCandidate(themeColorCandidates).accentRgb.join(','), '17,34,51');

const dribbbleThemeCandidates = utils.parseHtmlThemeColorCandidates(`
  <meta name="theme-color" content="#FFFFFF">
  <link href="https://cdn.dribbble.com/assets/dribbble-vector-ball.svg" rel="mask-icon" color="#EA64D9">
  <link href="https://cdn.dribbble.com/assets/favicon.svg" rel="icon" type="image/svg+xml">
`, 'https://dribbble.com/', 'light');
const dribbbleBestTheme = utils.pickBestThemeColorCandidate(dribbbleThemeCandidates);
assert.strictEqual(dribbbleBestTheme.source, 'mask-icon');
assert.strictEqual(dribbbleBestTheme.accentRgb.join(','), '234,100,217');
assert.strictEqual(dribbbleBestTheme.confidence, 'color');
assert.strictEqual(
  dribbbleThemeCandidates.find((candidate) => candidate.source === 'meta').confidence,
  'neutral'
);

vm.runInNewContext(fs.readFileSync('src/newtab/favicon-theme.js', 'utf8'), sandbox, {
  filename: 'src/newtab/favicon-theme.js'
});
const faviconTheme = sandbox.LumnoNewtabFaviconTheme;
assert.ok(faviconTheme, 'LumnoNewtabFaviconTheme should be exported');
assert.strictEqual(
  faviconTheme.getBrandAccentForHost('dribbble.com').join(','),
  '234,100,217',
  'Dribbble should have an immediate pink brand accent'
);
assert.strictEqual(
  faviconTheme.getBrandAccentForHost('cdn.dribbble.com').join(','),
  '234,100,217',
  'Dribbble subdomains should inherit the pink brand accent'
);
assert.strictEqual(
  faviconTheme.getBrandAccentForUrl('https://dribbble.com/shots/popular').join(','),
  '234,100,217',
  'Dribbble URLs should resolve to the pink brand accent before theme-color cache fallback'
);
assert.strictEqual(
  faviconTheme.getBrandAccentForHost('app.dodopayments.com').join(','),
  faviconTheme.getBrandAccentForHost('checkout.dodopayments.com').join(','),
  'Dodo Payments subdomains should inherit one shared brand accent'
);
assert.strictEqual(
  faviconTheme.getBrandAccentForHost('customer.dodopayments.com').join(','),
  faviconTheme.getBrandAccentForHost('dodopayments.com').join(','),
  'Dodo Payments customer and root domains should not render with separate colors'
);
assert.strictEqual(
  faviconTheme.buildTheme([255, 255, 255]).accentRgb.join(','),
  faviconTheme.defaultAccentColor.join(','),
  'pure white theme colors should render with the shared blue fallback accent'
);
assert.strictEqual(
  faviconTheme.buildTheme([248, 250, 252]).accentRgb.join(','),
  faviconTheme.defaultAccentColor.join(','),
  'near-white fallback theme colors should render with the shared blue fallback accent'
);

vm.runInNewContext(fs.readFileSync('src/shared/favicon-cache.js', 'utf8'), sandbox, {
  filename: 'src/shared/favicon-cache.js'
});

async function testFaviconCacheThemeCompatibility() {
  const now = Date.now();
  const storageKey = '_x_extension_site_theme_cache_2026_unique_';
  const data = {
    [storageKey]: {
      version: 1,
      entries: {
        'dribbble.com': {
          accentRgb: [255, 255, 255],
          source: 'meta',
          updatedAt: now
        }
      },
      updatedAt: now
    }
  };
  const storageArea = {
    get(keys, callback) {
      const result = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        result[key] = data[key];
      });
      callback(result);
    },
    set(value, callback) {
      Object.assign(data, value || {});
      if (callback) {
        callback();
      }
    }
  };
  const runtime = sandbox.LumnoFaviconCache.createFaviconCache({
    storageArea,
    windowObj: {
      setTimeout(callback) {
        callback();
        return 0;
      },
      clearTimeout() {}
    },
    normalizeFaviconHost: utils.normalizeFaviconHost
  });

  await runtime.ensureCachesReady();
  const oldEntry = runtime.getPersistedThemeEntry('www.dribbble.com');
  assert.strictEqual(oldEntry.source, 'meta');
  assert.strictEqual(oldEntry.confidence, 'neutral');
  assert.strictEqual(oldEntry.neutral, true);

  assert.strictEqual(runtime.setPersistedThemeEntry('dribbble.com', {
    accentRgb: [234, 100, 217],
    source: 'mask-icon',
    confidence: 'color',
    neutral: false
  }), true);

  const nextEntry = runtime.getPersistedThemeEntry('dribbble.com');
  assert.strictEqual(nextEntry.source, 'mask-icon');
  assert.strictEqual(nextEntry.confidence, 'color');
  assert.strictEqual(nextEntry.neutral, false);
}

testFaviconCacheThemeCompatibility()
  .then(() => {
    console.log('favicon utils ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
