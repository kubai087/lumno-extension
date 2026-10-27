const assert = require('assert');
const settings = require('../../src/domain/settings/index.ts');
const { createNewtabPage } = require('../helpers/newtab-page');
const { createOnboardingPage } = require('../helpers/onboarding-page');
const { createOptionsPage } = require('../helpers/options-page');

const communityLinks = require('../../src/platform/community-links.ts');
const { getInjectedScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

(async () => {
  assert.strictEqual(
    communityLinks.COMMUNITY_LINKS_URL,
    'https://lumno.kubai.design/community-links.json',
    'all community surfaces should share one remote configuration endpoint'
  );
  assert.deepStrictEqual(
    ['zh-CN', 'zh_TW', 'ja', 'en', 'fr'].map((locale) => communityLinks.getHelpUrl(locale)),
    [
      'https://lumno.kubai.design/help/what-is-lumno/',
      'https://lumno.kubai.design/zh-tw/help/what-is-lumno/',
      'https://lumno.kubai.design/ja/help/what-is-lumno/',
      'https://lumno.kubai.design/en/help/what-is-lumno/',
      'https://lumno.kubai.design/en/help/what-is-lumno/'
    ],
    'help center links should follow the UI language and start at the first article'
  );
  assert.strictEqual(
    communityLinks.getHelpUrl('zh-CN', 'newtab-wallpaper'),
    'https://lumno.kubai.design/help/newtab-wallpaper/',
    'surfaces can deep link to a specific help article'
  );
  assert.strictEqual(
    communityLinks.getHelpUrl('en', 'tab-switcher', 'ctrl-tab'),
    'https://lumno.kubai.design/en/help/tab-switcher/#ctrl-tab',
    'surfaces can deep link to a section of a help article'
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
  // New Tab's wordmark and onboarding's rating button open the listing of
  // the store the extension was installed from.
  {
    const edgeListing = communityLinks.getStoreListing(edgeStoreId).url;
    const newtab = await createNewtabPage({ setup(window) { window.chrome.runtime.id = edgeStoreId; } });
    await newtab.settle(300);
    const wordmark = newtab.document.querySelector('[aria-label="Lumno Microsoft Edge Add-ons"]');
    assert.ok(wordmark, 'the New Tab wordmark should name the install channel');
    newtab.click(wordmark);
    await newtab.settle(80);
    assert.ok(newtab.messages.some((message) => message.action === 'createTab' && message.url === edgeListing),
      'the New Tab wordmark should open the listing for the install channel');
    newtab.close();

    const onboarding = await createOnboardingPage({ runtimeId: edgeStoreId });
    onboarding.document.dispatchEvent(new onboarding.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await onboarding.settle(400);
    await onboarding.click(onboarding.document.querySelector('[data-action="openChromeWebStore"]'));
    await onboarding.settle(50);
    assert.ok(onboarding.messages.some((message) => message.action === 'createTab' && message.url === edgeListing),
      'onboarding should open the listing for the install channel');
    onboarding.close();
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

  // Surfaces take the QR code from the shared links, so a remote update
  // reaches them (here Settings' WeChat group dialog).
  {
    const remoteQr = 'https://lumno.kubai.design/qr-remote.webp';
    const page = await createOptionsPage({
      sync: { [settings.language.key]: 'zh-CN' },
      setup(window) {
        const packaged = window.fetch;
        window.fetch = async (url, init) => {
          if (String(url) !== communityLinks.COMMUNITY_LINKS_URL) return packaged(url, init);
          const body = { links: { wechatQr: remoteQr } };
          return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
        };
      }
    });
    await page.settle(400);
    await page.click(page.byId('_x_extension_feedback_support_2026_unique_').querySelector('[data-feedback-support="community"]'));
    await page.settle(200);
    const images = [];
    const collect = (root) => {
      root.querySelectorAll('img').forEach((image) => images.push(image.getAttribute('src')));
      root.querySelectorAll('*').forEach((element) => element.shadowRoot && collect(element.shadowRoot));
    };
    collect(page.document);
    assert.ok(images.includes(remoteQr), 'the WeChat dialog should show the QR code from the shared links');
    assert.ok(!images.includes(communityLinks.FALLBACK_LINKS.wechatQr), 'instead of the bundled fallback');
    page.close();
  }
  assert(
    runsBefore(getPageScripts('newtab.html'), 'src/domain/community-links.ts', 'src/shared/engagement-notice.ts'),
    'newtab should load community links before the engagement runtime'
  );
  assert(
    runsBefore(getPageScripts('src/options/options.html'), 'src/domain/community-links.ts', 'src/options/app/main.ts'),
    'Options should load community links before its page entry'
  );
  assert(
    runsBefore(getInjectedScripts('overlay'), 'src/domain/community-links.ts', 'src/shared/engagement-notice.ts'),
    'overlay injection should load community links before engagement actions'
  );

  {
    // Firefox installs carry Gecko IDs and come from Firefox Add-ons.
    const geckoId = 'lumno@kubai087';
    assert.strictEqual(communityLinks.isFirefoxInstall(geckoId), true);
    assert.strictEqual(communityLinks.isFirefoxInstall('{3f2a1b4c-0d5e-4f6a-8b7c-9d0e1f2a3b4c}'), true);
    assert.strictEqual(communityLinks.isFirefoxInstall(chromeStoreId), false);
    assert.strictEqual(communityLinks.isFirefoxInstall(edgeStoreId), false);
    assert.strictEqual(
      communityLinks.getReviewUrl(communityLinks.FALLBACK_LINKS, geckoId),
      'https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/reviews/',
      'Firefox installs should review on Firefox Add-ons'
    );
    assert.deepStrictEqual(
      communityLinks.getStoreListing(geckoId),
      {
        id: 'firefox',
        name: 'Firefox Add-ons',
        host: 'addons.mozilla.org',
        url: 'https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/'
      },
      'Firefox installs should open the Firefox Add-ons listing'
    );
    assert.strictEqual(
      communityLinks.getReviewUrl(null, geckoId),
      communityLinks.FALLBACK_LINKS.firefoxReview,
      'Firefox installs should keep the bundled review URL without loaded links'
    );
    assert.strictEqual(
      communityLinks.getReviewUrl(remoteReviews, geckoId),
      communityLinks.FALLBACK_LINKS.firefoxReview,
      'a remote file without a Firefox review URL should leave Firefox on the bundled one'
    );
    for (const key of ['firefoxReview', 'firefox_review', 'firefox_addons_review']) {
      assert.strictEqual(
        communityLinks.getReviewUrl(
          communityLinks.normalizeLinksPayload({ links: { [key]: 'https://example.com/firefox-review' } }),
          geckoId
        ),
        'https://example.com/firefox-review',
        `the remote configuration should be able to override the Firefox review URL via ${key}`
      );
    }
    assert.strictEqual(
      communityLinks.normalizeLinksPayload({ links: { firefoxReview: 'http://example.com' } }).firefoxReview,
      communityLinks.FALLBACK_LINKS.firefoxReview,
      'insecure remote Firefox review URLs should fall back'
    );

    globalThis.chrome = { runtime: { id: geckoId } };
    try {
      assert.strictEqual(
        communityLinks.getReviewUrl(communityLinks.FALLBACK_LINKS),
        communityLinks.FALLBACK_LINKS.firefoxReview,
        'a running Firefox install should resolve its own review page'
      );
      assert.strictEqual(communityLinks.getStoreListing().id, 'firefox');
    } finally {
      globalThis.chrome = previousChrome;
    }
  }

  console.log('community links tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
