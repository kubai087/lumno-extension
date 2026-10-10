const assert = require('assert');
const fs = require('fs');

const communityLinks = require('../src/shared/community-links.js');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

(async () => {
  assert.strictEqual(
    communityLinks.COMMUNITY_LINKS_URL,
    'https://lumno.kubai.design/community-links.json',
    'all community surfaces should share one remote configuration endpoint'
  );
  assert.strictEqual(
    communityLinks.normalizeHttpsUrl('http://example.com/qr.webp'),
    '',
    'remote community URLs should reject insecure HTTP values'
  );

  const normalized = communityLinks.normalizeLinksPayload({
    links: {
      chrome_rating: 'https://example.com/review',
      wechat_qr: 'https://cdn.example.com/latest-qr.webp'
    },
    community_by_locale: {
      zh_CN: 'wechat',
      en: 'discord'
    }
  });
  assert.strictEqual(
    normalized.wechatQr,
    'https://cdn.example.com/latest-qr.webp',
    'the loader should accept the remote QR URL aliases used by the endpoint'
  );
  assert.strictEqual(
    communityLinks.getCommunityChannel(normalized, 'zh-CN'),
    'wechat',
    'Simplified Chinese should use the shared WeChat destination'
  );
  assert.strictEqual(
    communityLinks.getCommunityChannel(normalized, 'zh_TW'),
    'wechat',
    'Traditional Chinese should use the shared WeChat destination'
  );
  assert.strictEqual(
    communityLinks.getCommunityChannel(normalized, 'zh-HK'),
    'wechat',
    'Traditional Chinese regional locales should use the shared WeChat destination'
  );
  assert.strictEqual(
    communityLinks.getCommunityChannel(normalized, 'zh-SG'),
    'wechat',
    'Simplified Chinese regional locales should use the shared WeChat destination'
  );
  assert.strictEqual(
    communityLinks.getCommunityChannel(normalized, 'en-US'),
    'x',
    'all non-Chinese locales should use X (an older "discord" value from the website maps to X)'
  );
  assert.strictEqual(
    communityLinks.getCommunityUrl(normalized, 'zh-TW'),
    'https://cdn.example.com/latest-qr.webp',
    'Traditional Chinese should resolve the dynamic QR URL'
  );
  assert.strictEqual(
    communityLinks.getCommunityUrl(normalized, 'ja'),
    communityLinks.FALLBACK_LINKS.x,
    'Japanese should resolve the author on X'
  );
  const overriddenCommunity = communityLinks.normalizeLinksPayload({
    links: {
      x: 'https://x.example/someone'
    },
    community_by_locale: {
      zh_TW: 'x'
    }
  });
  assert.strictEqual(
    communityLinks.getCommunityChannel(overriddenCommunity, 'zh-HK'),
    'wechat',
    'a stale remote locale map must not route Traditional Chinese users away from WeChat'
  );
  assert.strictEqual(
    communityLinks.getCommunityUrl(overriddenCommunity, 'zh-HK'),
    communityLinks.FALLBACK_LINKS.wechatQr,
    'Traditional Chinese should still resolve the WeChat QR URL when remote routing is stale'
  );

  const chromeStoreId = 'nggfkkbmogmadfoikakkfegkoilfcfao';
  const edgeStoreId = communityLinks.EDGE_ADDONS_EXTENSION_ID;
  assert.strictEqual(edgeStoreId, 'pfbklkaefmfamjpibfiapaiihlddhchc');
  assert.strictEqual(
    communityLinks.getReviewUrl(communityLinks.FALLBACK_LINKS, chromeStoreId),
    communityLinks.FALLBACK_LINKS.chromeReview,
    'Chrome Web Store installs should review on the Chrome Web Store'
  );
  assert.strictEqual(
    communityLinks.getReviewUrl(communityLinks.FALLBACK_LINKS, edgeStoreId),
    'https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc',
    'Edge Add-ons installs should review on Edge Add-ons'
  );
  assert.strictEqual(
    communityLinks.getReviewUrl(null, ''),
    communityLinks.FALLBACK_LINKS.chromeReview,
    'unknown installs should keep the Chrome Web Store review destination'
  );
  const remoteReviews = communityLinks.normalizeLinksPayload({
    links: {
      chrome_review: 'https://example.com/chrome-review',
      edge_review: 'https://example.com/edge-review'
    }
  });
  assert.strictEqual(
    communityLinks.getReviewUrl(remoteReviews, chromeStoreId),
    'https://example.com/chrome-review'
  );
  assert.strictEqual(
    communityLinks.getReviewUrl(remoteReviews, edgeStoreId),
    'https://example.com/edge-review',
    'the remote configuration should be able to override the Edge review URL'
  );
  assert.strictEqual(
    communityLinks.normalizeLinksPayload({ links: { edgeReview: 'http://example.com' } }).edgeReview,
    communityLinks.FALLBACK_LINKS.edgeReview,
    'insecure remote Edge review URLs should fall back'
  );
  assert.strictEqual(
    communityLinks.getStoreListing(chromeStoreId).url,
    'https://chromewebstore.google.com/detail/lumno-%E8%81%9A%E7%84%A6%E6%90%9C%E7%B4%A2%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5/nggfkkbmogmadfoikakkfegkoilfcfao?utm_source=item-share-cb',
    'Chrome Web Store installs should open the Chrome Web Store listing'
  );
  assert.deepStrictEqual(
    communityLinks.getStoreListing(edgeStoreId),
    {
      id: 'edge',
      name: 'Microsoft Edge Add-ons',
      host: 'microsoftedge.microsoft.com',
      url: 'https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc'
    },
    'Edge Add-ons installs should open the Edge Add-ons listing'
  );
  for (const [file, pattern] of [
    ['src/newtab/newtab.js', /openExternalNewTabUrl\(COMMUNITY_LINKS\.getStoreListing\(\)\.url, event\)/],
    ['src/onboarding/onboarding.js', /openExternalTab\(COMMUNITY_LINKS\.getStoreListing\(\)\.url, disposition\)/]
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, pattern, `${file} should open the listing for the install channel`);
    assert(!source.includes('nggfkkbmogmadfoikakkfegkoilfcfao'), `${file} should not hardcode the Chrome listing`);
  }

  const previousChrome = globalThis.chrome;
  globalThis.chrome = { runtime: { id: edgeStoreId } };
  try {
    assert.strictEqual(
      communityLinks.getReviewUrl(remoteReviews),
      'https://example.com/edge-review',
      'the review destination should default to the running extension ID'
    );
    assert.strictEqual(communityLinks.getStoreListing().id, 'edge');
  } finally {
    globalThis.chrome = previousChrome;
  }

  const requests = [];
  let qrRevision = 1;
  const loader = communityLinks.createLoader({
    fetchImpl(url, init) {
      requests.push({ url, init });
      return Promise.resolve({
        ok: true,
        json() {
          return Promise.resolve({
            links: {
              wechatQr: `https://cdn.example.com/qr-v${qrRevision}.webp`
            }
          });
        }
      });
    },
    windowObj: {
      clearTimeout() {},
      setTimeout() {
        return 1;
      }
    }
  });

  const first = await loader.load();
  assert.strictEqual(first.wechatQr, 'https://cdn.example.com/qr-v1.webp');
  assert.strictEqual(requests[0].url, communityLinks.COMMUNITY_LINKS_URL);
  assert.strictEqual(requests[0].init.cache, 'no-store');

  qrRevision = 2;
  const cached = await loader.load();
  assert.strictEqual(cached.wechatQr, 'https://cdn.example.com/qr-v1.webp');
  assert.strictEqual(requests.length, 1, 'normal reads should share the page-level cache');

  const refreshed = await loader.load({ force: true });
  assert.strictEqual(refreshed.wechatQr, 'https://cdn.example.com/qr-v2.webp');
  assert.strictEqual(requests.length, 2, 'forced refresh should fetch the latest remote QR URL');

  let failedRequests = 0;
  const failingLoader = communityLinks.createLoader({
    fetchImpl() {
      failedRequests += 1;
      return Promise.reject(new Error('offline'));
    }
  });
  assert.deepStrictEqual(
    await failingLoader.load(),
    communityLinks.FALLBACK_LINKS,
    'remote failures should use the one shared fallback set'
  );
  await failingLoader.load();
  assert.strictEqual(
    failedRequests,
    1,
    'a failed load should cache the fallback instead of retrying for every consumer'
  );
  await failingLoader.load({ force: true });
  assert.strictEqual(
    failedRequests,
    2,
    'a forced refresh should still retry after a cached failure'
  );

  const newtabSource = readNewtabRuntimeSource();
  const newtabHtml = readPageSource('newtab.html');
  const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
  const optionsHtml = readPageSource('src/options/options.html');
  const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
  const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
  assert(
    !newtabSource.includes('qrcode-20260730.webp') &&
      !optionsSource.includes('qrcode-20260730.webp') &&
      !overlaySource.includes('qrcode-20260730.webp'),
    'feature surfaces should not duplicate the fallback QR URL outside the shared module'
  );
  assert(
    newtabHtml.indexOf('../shared/community-links.js') <
      newtabHtml.indexOf('../shared/engagement-notice.js'),
    'newtab should load community links before the engagement runtime'
  );
  assert(
    optionsHtml.indexOf('../shared/community-links.js') <
      optionsHtml.indexOf('../shared/react-page-bootstrap.js'),
    'Options should load community links before its page entry bootstrap'
  );
  assert(
    backgroundSource.indexOf("'src/shared/community-links.js'") <
      backgroundSource.indexOf("'src/shared/engagement-notice.js'"),
    'overlay injection should load community links before engagement actions'
  );

  {
    // Firefox installs carry Gecko IDs and have no addons.mozilla.org listing yet.
    const geckoId = 'lumno@kubai087';
    assert.strictEqual(communityLinks.isFirefoxInstall(geckoId), true);
    assert.strictEqual(communityLinks.isFirefoxInstall('{3f2a1b4c-0d5e-4f6a-8b7c-9d0e1f2a3b4c}'), true);
    assert.strictEqual(communityLinks.isFirefoxInstall(chromeStoreId), false);
    assert.strictEqual(communityLinks.getReviewUrl(communityLinks.FALLBACK_LINKS, geckoId), '',
      'Firefox installs offer no review page until a listing exists');
    assert.strictEqual(communityLinks.getStoreListing(geckoId).url, 'https://lumno.kubai.design/',
      'store entry points fall back to the website on Firefox');
  }

  console.log('community links tests passed');
})();
