const assert = require('assert');
const siteDisplayName = require('../../src/domain/site-display-name.ts');
const settings = require('../../src/domain/settings/index.ts');
const { createNewtabPage } = require('../helpers/newtab-page');
const { getPageScripts, runsBefore } = require('../helpers/runtime-scripts');


assert.strictEqual(
  siteDisplayName.getSiteDisplayName('www.github.com', 'Repository'),
  'GitHub',
  'known brands should use their stable display names'
);
assert.strictEqual(
  siteDisplayName.getSiteDisplayName('docs.github.com', 'Documentation'),
  'GitHub',
  'known brand names should apply to subdomains'
);
assert.strictEqual(
  siteDisplayName.getSiteDisplayName('weibo.com', 'Home'),
  'Weibo',
  'shared brand defaults should remain locale-neutral'
);
assert.strictEqual(
  siteDisplayName.getSiteDisplayName('login.example.co.uk', 'Example Account | Sign in'),
  'Sign in',
  'noisy subdomains should prefer a concise title candidate'
);
assert.strictEqual(
  siteDisplayName.getSiteDisplayName('product.example.com.cn', 'Example Product'),
  'Example',
  'multi-part public suffixes should keep the registrable host label'
);
assert.strictEqual(
  siteDisplayName.getSiteDisplayName('', 'Fallback Title'),
  'Fallback Title',
  'missing hosts should fall back to the page title'
);
assert.strictEqual(
  siteDisplayName.getSiteDisplayName('mp.weixin.qq.com', 'Article', {
    getBrandName(host, fallback) {
      return host === 'mp.weixin.qq.com' ? 'WeChat Official' : fallback;
    }
  }),
  'WeChat Official',
  'callers should be able to localize a known brand without rebuilding the brand map'
);

assert.ok(
  getPageScripts('newtab.html').includes('src/domain/site-display-name.ts'),
  'newtab should load the shared site display-name resolver'
);
assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/domain/site-display-name.ts', 'src/newtab/app/main.ts'),
  'the shared resolver should load before the newtab runtime entry'
);
// New Tab names recent sites with the shared resolver.
async function testRecentSitesUseTheResolver() {
  const page = await createNewtabPage({
    sync: { [settings.recentCount.key]: 4, [settings.recentMode.key]: 'latest' },
    history: [
      { url: 'https://docs.github.com/en/get-started', title: 'Documentation', lastVisitTime: Date.now(), visitCount: 3 },
      { url: 'https://weibo.com/home', title: 'Home', lastVisitTime: Date.now() - 1000, visitCount: 3 }
    ]
  });
  await page.settle(400);
  // A recent card's icon is named after the site.
  const names = Array.from(page.document.querySelectorAll('.x-nt-recent-card img[alt]')).map((image) => image.getAttribute('alt'));
  assert.ok(names.includes('GitHub') && names.includes('Weibo'), `recent sites should use the shared brand names: ${names}`);
  page.close();
}

testRecentSitesUseTheResolver().then(() => {
  console.log('site display name tests passed');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
