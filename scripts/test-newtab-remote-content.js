const assert = require('node:assert/strict');
const remote = require('../src/newtab/remote-content.js');
const settings = require('../src/shared/settings.js');

function storage(initial = {}) {
  const values = structuredClone(initial);
  return {
    values,
    get(keys, callback) { callback(Object.fromEntries(keys.map((key) => [key, structuredClone(values[key])]))); },
    set(payload, callback) { Object.assign(values, structuredClone(payload)); callback(); }
  };
}
function response(data, status = 200) {
  return { ok: status === 200, status, json: async () => data };
}
function wallpaper(rawId = 'OHR.River_ZH-CN123', date = '20261002') {
  return { startdate: date, title: 'River', copyright: '© Photographer',
    copyrightlink: 'https://www.bing.com/search?q=river', urlbase: `/th?id=${rawId}`, wp: true };
}
function locks() {
  const tasks = new Map();
  return { request(name, task) {
    const pending = (tasks.get(name) || Promise.resolve()).catch(() => {}).then(task);
    tasks.set(name, pending);
    return pending;
  } };
}
const todayId = 'bing-20261002-OHR.River_ZH-CN123';
const yesterdayId = 'bing-20261001-OHR.Lake_ZH-CN456';

async function main() {
  assert.deepEqual(settings.normalizeNewtabQuotePrefs({ position: 'bogus', category: 'invalid' }),
    { enabled: false, position: 'search', category: 'literature', fontSize: 15 });
  assert.deepEqual(settings.normalizeNewtabQuotePrefs({ position: 'bottom', category: 'poetry', fontSize: 20 }),
    { enabled: false, position: 'bottom', category: 'poetry', fontSize: 20 }, 'A saved position alone must not turn quotes on');
  assert.deepEqual(settings.normalizeNewtabQuotePrefs({ enabled: true, position: 'bottom', category: 'poetry', fontSize: 20 }),
    { enabled: true, position: 'bottom', category: 'poetry', fontSize: 20 }, 'Existing enabled quotes should keep their preferences');
  assert.deepEqual(settings.normalizeNewtabQuotePrefs({ enabled: false, position: 'bottom', category: 'poetry', fontSize: 20 }),
    { enabled: false, position: 'bottom', category: 'poetry', fontSize: 20 }, 'Disabling must retain the selected position');
  assert.equal(settings.normalizeNewtabQuotePrefs({ fontSize: '' }).fontSize, 15);
  assert.equal(settings.normalizeNewtabQuotePrefs({ fontSize: null }).fontSize, 15);
  assert.equal(settings.normalizeNewtabQuotePrefs({ fontSize: 8 }).fontSize, 12);
  assert.equal(settings.normalizeNewtabQuotePrefs({ fontSize: '30' }).fontSize, 24);
  assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY));
  assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes(remote.QUOTE_CACHE_KEY));
  assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes(remote.BING_CACHE_KEY));
  assert.equal(remote.normalizeQuote({ hitokoto: '' }), null);
  assert.equal(remote.normalizeQuote({ hitokoto: 'x'.repeat(121) }), null);
  assert.equal(remote.normalizeQuote({ hitokoto: 'test', uuid: 'javascript:alert(1)' }).url, 'https://hitokoto.cn/');
  assert(!settings.CHROME_SYNC_STORAGE_KEYS.includes(remote.BING_DAILY_CACHE_KEY));
  assert.equal(remote.normalizeMarket('zh_CN'), 'zh-CN');
  assert.equal(remote.normalizeMarket('zh-Hant'), 'zh-TW');
  assert.equal(remote.normalizeMarket('ja'), 'ja-JP');
  assert.equal(remote.normalizeMarket('fr-FR'), 'en-US');
  assert.equal(remote.normalizeWallpaper({ ...wallpaper(), wp: false }), null);
  assert.equal(remote.normalizeWallpaper({ ...wallpaper(), startdate: '20260231' }), null);
  assert.equal(remote.normalizeWallpaper({ ...wallpaper(), urlbase: 'https://evil.test/th?id=OHR.River' }), null);
  assert.equal(remote.normalizeWallpaper({ ...wallpaper(), urlbase: '/th?id=OHR.River%26evil' }), null);
  assert.equal(remote.wallpaperFromId('bing-../../bad'), null);
  assert.equal(remote.normalizeWallpaper(wallpaper()).sourceUrl, 'https://www.bing.com/search?q=river');
  const image = remote.normalizeWallpaper(wallpaper());
  assert.equal(new URL(image.thumbnailUrl).searchParams.get('id'), new URL(image.imageUrl).searchParams.get('id'),
    'Thumbnails must resize an existing image, rather than request an unavailable resolution');
  assert.equal(remote.normalizeWallpaper({ ...wallpaper(), copyrightlink: 'javascript:alert(1)' }).sourceUrl, 'https://www.bing.com');

  let time = new Date(2026, 9, 2, 12).getTime();
  let calls = 0;
  const quoteStorage = storage();
  const quoteClient = remote.createClient({ storageArea: quoteStorage, now: () => time,
    fetch: async (url, options) => {
      calls += 1;
      assert.equal(options.credentials, 'omit');
      assert(url.includes('c=i'));
      return response({ hitokoto: `quote ${calls}`, from: 'book', from_who: 'author' });
    } });
  const [first, second] = await Promise.all([quoteClient.getQuote('poetry'), quoteClient.getQuote('poetry')]);
  assert.equal(calls, 1, 'Simultaneous tabs must not cause repeated requests within a client');
  assert.deepEqual(first, second);
  await quoteClient.getQuote('poetry');
  assert.equal(calls, 1, 'A daily quote should use the local cache');
  time += 24 * 60 * 60 * 1000;
  assert.equal((await quoteClient.getQuote('poetry')).text, 'quote 2');
  assert.equal(calls, 2, 'The next day should fetch a new quote');
  const offlineClient = remote.createClient({ storageArea: quoteStorage, now: () => time + 86400000,
    fetch: async () => { calls += 1; throw new Error('offline'); } });
  assert.equal((await offlineClient.getQuote('poetry')).text, 'quote 2');
  await offlineClient.getQuote('poetry');
  assert.equal(calls, 3, 'Failures should keep the last quote and enforce retry backoff');

  const rerollStorage = storage();
  const rerollTexts = ['same', 'same', 'fresh'];
  let rerollFetches = 0;
  const rerollClient = remote.createClient({ storageArea: rerollStorage, now: () => time,
    fetch: async () => {
      const text = rerollTexts[rerollFetches++];
      if (!text) throw new Error('offline');
      return response({ hitokoto: text });
    } });
  assert.equal((await rerollClient.getQuote('literature')).text, 'same');
  assert.equal((await rerollClient.getQuote('literature', { reroll: true })).text, 'fresh',
    'A reroll skips the daily cache and draws again when it repeats the current quote');
  assert.equal(rerollFetches, 3);
  assert.equal((await rerollClient.getQuote('literature')).text, 'fresh', 'The rerolled quote stays for the rest of the day');
  assert.equal(rerollFetches, 3);
  await assert.rejects(rerollClient.getQuote('literature', { reroll: true }), /offline/,
    'A failed reroll reports the failure instead of falling back');
  assert.equal(rerollStorage.values[remote.QUOTE_CACHE_KEY].literature.quote.text, 'fresh',
    'A failed reroll keeps the cached quote');
  const rerollTomorrow = remote.createClient({ storageArea: rerollStorage, now: () => time + 86400000,
    fetch: async () => response({ hitokoto: 'tomorrow' }) });
  assert.equal((await rerollTomorrow.getQuote('literature')).text, 'tomorrow', 'The next day replaces a rerolled quote');

  let catalogCalls = 0;
  let rateLimited = false;
  const catalogStorage = storage();
  const catalogClient = remote.createClient({ storageArea: catalogStorage, now: () => time, language: 'zh_CN',
    fetch: async (url, options) => {
      catalogCalls += 1;
      const target = new URL(url);
      assert.equal(target.origin, 'https://www.bing.com');
      assert.equal(target.pathname, '/HPImageArchive.aspx');
      assert.equal(target.searchParams.get('mkt'), 'zh-CN');
      assert.equal(target.searchParams.get('n'), '8');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
      return rateLimited ? response({}, 429) : response({ images: [wallpaper(), { ...wallpaper('OHR.Restricted'), wp: false }] });
    } });
  assert.equal((await catalogClient.getCatalog()).length, 1, 'Restricted and invalid images should be excluded');
  await catalogClient.getCatalog();
  assert.equal(catalogCalls, 1, 'Catalogs should be reused across page opens');
  time += 60 * 60 * 1000;
  await catalogClient.getCatalog();
  assert.equal(catalogCalls, 2, 'Recheck the source during the day to handle delayed publication');
  rateLimited = true;
  assert.equal((await catalogClient.getCatalog(true)).length, 1, 'Rate limits must preserve cached results');
  await catalogClient.getCatalog(true);
  assert.equal(catalogCalls, 3, 'Refresh must not bypass rate-limit backoff');

  const imageStorage = storage();
  const imageClient = remote.createClient({ storageArea: imageStorage, now: () => time,
    fetch: async () => { throw new Error('Wallpapers must not be downloaded'); } });
  imageClient.setPinnedIds([yesterdayId, 'monet-coastal-white']);
  const saved = await imageClient.ensureWallpaper(todayId);
  assert.equal(saved.imageUrl, 'https://www.bing.com/th?id=OHR.River_ZH-CN123_1920x1080.jpg&pid=hp',
    'A chosen wallpaper should be shown straight from Bing');
  assert(!('imageDataUrl' in saved));
  assert.equal(imageStorage.values[remote.BING_META_CACHE_KEY], undefined, 'Do not store details Bing never provided');
  imageStorage.values[remote.BING_CACHE_KEY] = { 'en-US': { items: [remote.normalizeWallpaper(wallpaper())] } };
  const restoredClient = remote.createClient({ storageArea: imageStorage, fetch: async () => { throw new Error('offline'); } });
  assert.equal((await restoredClient.restoreWallpaper(todayId)).name, 'River', 'Restore titles from the catalog cache');
  const metaClient = remote.createClient({ storageArea: storage({ [remote.BING_META_CACHE_KEY]: {
    [todayId]: { id: todayId, date: '20261002', name: 'Saved river', copyright: '', sourceUrl: 'https://www.bing.com' } } }) });
  assert.equal((await metaClient.restoreWallpaper(todayId)).name, 'Saved river',
    'Chosen photos keep their title after leaving the 8-day catalog');
  await restoredClient.ensureWallpaper(todayId);
  assert.equal(imageStorage.values[remote.BING_META_CACHE_KEY][todayId].name, 'River', 'Choosing a photo keeps its details');
  assert.equal((await remote.createClient({ storageArea: storage() }).restoreWallpaper(todayId)).imageUrl, saved.imageUrl,
    'A synced fixed wallpaper resolves from its ID alone');
  await assert.rejects(imageClient.ensureWallpaper('javascript:evil'), /Invalid wallpaper/);

  let sourceDate = '20261002';
  let offline = false;
  let dailyFetches = 0;
  const dailyStorage = storage();
  const sharedLocks = locks();
  const options = { storageArea: dailyStorage, now: () => time, locks: sharedLocks, language: 'zh-CN',
    fetch: async (url) => {
      if (offline) throw new Error('offline');
      assert(url.includes('HPImageArchive'), 'Only the catalog is fetched');
      dailyFetches += 1;
      return response({ images: [wallpaper('OHR.Daily_ZH-CN123', sourceDate)] });
    } };
  const tab1 = remote.createClient(options);
  const tab2 = remote.createClient(options);
  const [daily1, daily2] = await Promise.all([tab1.ensureWallpaper(remote.BING_DAILY_ID), tab2.ensureWallpaper(remote.BING_DAILY_ID)]);
  assert.equal(daily1.dailyId, daily2.dailyId);
  assert(daily1.imageUrl.includes('OHR.Daily_ZH-CN123'));
  assert.equal(dailyFetches, 1, 'Separate tabs should share the daily archive request');
  await tab1.ensureWallpaper(remote.BING_DAILY_ID);
  assert.equal(dailyFetches, 1);
  sourceDate = '20261003';
  time += 86400000;
  const nextDay = await tab1.ensureWallpaper(remote.BING_DAILY_ID);
  assert.equal(nextDay.date, '20261003', 'Switch once Bing actually publishes a newer image');
  sourceDate = '20261002';
  time += 3600001;
  assert.equal((await tab2.ensureWallpaper(remote.BING_DAILY_ID)).date, '20261003', 'Stale responses must not regress the daily image');
  offline = true;
  time += 86400000;
  const offlineTab = remote.createClient(options);
  assert.equal((await offlineTab.ensureWallpaper(remote.BING_DAILY_ID)).date, '20261003',
    'Reopening offline should keep the last daily photo');
  const fetchesAfterFailure = dailyFetches;
  offline = false;
  await remote.createClient(options).ensureWallpaper(remote.BING_DAILY_ID);
  assert.equal(dailyFetches, fetchesAfterFailure, 'Catalog backoff should survive page reopens');
  assert.equal(dailyStorage.values[remote.BING_DAILY_CACHE_KEY]['zh-CN'].id, nextDay.dailyId);

  assert.equal(remote.normalizeWallpaper({ ...wallpaper(), copyrightlink: '/search?q=river' }).sourceUrl,
    'https://www.bing.com/search?q=river', 'Relative credit links resolve against Bing');
  assert.equal(remote.normalizeWallpaper({ ...wallpaper(), copyrightlink: 'http://[' }).sourceUrl, 'https://www.bing.com',
    'A malformed credit link must not drop the photo');

  let limited = true;
  const limitedClient = remote.createClient({ storageArea: storage(), now: () => time, language: 'en-US',
    fetch: async () => limited ? response({}, 429) : response({ images: [wallpaper('OHR.Hill_EN-US1')] }) });
  await assert.rejects(limitedClient.ensureWallpaper(remote.BING_DAILY_ID));
  limited = false;
  time += 60001;
  assert(limitedClient.getWallpaper(remote.BING_DAILY_ID).imageUrl === undefined);
  await limitedClient.getCatalog(true);
  assert((await limitedClient.ensureWallpaper(remote.BING_DAILY_ID)).imageUrl.includes('OHR.Hill_EN-US1'),
    'Once the catalog loads after a rate limit, the daily photo resolves without a longer separate backoff');

  let refreshFetches = 0;
  let releaseFetch;
  const refreshClient = remote.createClient({ storageArea: storage(), now: () => time, language: 'en-US',
    fetch: async () => {
      refreshFetches += 1;
      if (refreshFetches === 1) await new Promise((resolve) => { releaseFetch = resolve; });
      return response({ images: [wallpaper('OHR.Hill_EN-US1')] });
    } });
  const plainLoad = refreshClient.getCatalog();
  await new Promise((resolve) => setImmediate(resolve));
  const refreshLoad = refreshClient.getCatalog(true);
  releaseFetch();
  await Promise.all([plainLoad, refreshLoad]);
  assert.equal(refreshFetches, 2, 'A refresh must not resolve with a pending plain load');

  const marketStorage = storage();
  const marketFetch = (rawId) => async () => response({ images: [wallpaper(rawId)] });
  await remote.createClient({ storageArea: marketStorage, now: () => time, language: 'en-US',
    fetch: marketFetch('OHR.Hill_EN-US1') }).getCatalog();
  let language = 'zh-CN';
  let releaseZh;
  const zhClient = remote.createClient({ storageArea: marketStorage, now: () => time, getLanguage: () => language,
    fetch: async (url) => {
      if (url.includes('zh-CN')) await new Promise((resolve) => { releaseZh = resolve; });
      return response({ images: [wallpaper(url.includes('zh-CN') ? 'OHR.River_ZH-CN123' : 'OHR.River_JA-JP123')] });
    } });
  const zhLoad = zhClient.getCatalog();
  await new Promise((resolve) => setImmediate(resolve));
  await remote.createClient({ storageArea: marketStorage, now: () => time, language: 'ja-JP',
    fetch: marketFetch('OHR.River_JA-JP123') }).getCatalog();
  releaseZh();
  await zhLoad;
  assert.deepEqual(Object.keys(marketStorage.values[remote.BING_CACHE_KEY]).sort(), ['en-US', 'ja-JP', 'zh-CN'],
    'Writing one market must not drop markets saved while its request was in flight');

  const zhDaily = await zhClient.ensureWallpaper(remote.BING_DAILY_ID);
  language = 'ja-JP';
  assert.equal((await zhClient.restoreWallpaper(remote.BING_DAILY_ID)).dailyId, zhDaily.dailyId,
    'A language change keeps the current photo until the new market resolves');
  const jaDaily = await zhClient.ensureWallpaper(remote.BING_DAILY_ID);
  assert.equal(jaDaily.date, zhDaily.date);
  assert(jaDaily.dailyId.includes('JA-JP'), 'The same date in another market still switches to that market');

  const catalog = require('../src/newtab/wallpaper-catalog.js');
  const morning0 = () => new Date(2026, 9, 7, 9).getTime();
  assert.deepEqual(remote.CURATED_CATEGORIES, ['random', 'nature', 'water', 'city', 'minimal', 'art']);
  const curatedIds = Object.values(catalog).flat().map(([id]) => id);
  assert.equal(new Set(curatedIds).size, curatedIds.length, 'Each photo belongs to one category');
  const curated = remote.wallpaperFromId(`picsum-${catalog.city[0][0]}`);
  assert.equal(curated.provider, 'curated');
  assert.equal(curated.category, 'city');
  assert.equal(curated.name, catalog.city[0][1], 'Bundled credits name the photographer');
  assert.equal(curated.sourceUrl, `https://unsplash.com/photos/${catalog.city[0][2]}`);
  assert.equal(curated.imageUrl, `https://picsum.photos/id/${catalog.city[0][0]}/2560/1440`);
  assert.equal(curated.cacheImage, true, 'Curated photos are cached once per device, not fetched on every new tab');
  const unknown = remote.wallpaperFromId('picsum-5');
  assert.equal(unknown.imageUrl, 'https://picsum.photos/id/5/2560/1440',
    'A photo synced from a version with a larger catalog still resolves from its ID');
  assert.equal(unknown.sourceUrl, 'https://picsum.photos');
  for (const bad of ['picsum-05', 'picsum-12345', 'picsum-1/../x', 'curated-daily-', 'curated-daily-Nature']) {
    assert.equal(remote.wallpaperFromId(bad), null, `${bad} must be rejected`);
  }
  assert.equal(remote.getWallpaperProvider(todayId), 'bing');
  assert.equal(remote.getWallpaperProvider('picsum-28'), 'curated');
  assert.equal(remote.getWallpaperProvider('monet-coastal-white'), '');
  assert(remote.isDailyWallpaperId(remote.BING_DAILY_ID) && remote.isDailyWallpaperId('curated-daily-city'));
  assert(!remote.isDailyWallpaperId('picsum-28'));
  assert.equal(remote.curatedDailyId('water'), 'curated-daily-water');
  assert.equal(remote.curatedDailyId('bogus'), 'curated-daily-random');
  const painting = remote.wallpaperFromId(`cma-${catalog.art[0][0]}`);
  assert.equal(painting.category, 'art');
  assert.equal(painting.name, catalog.art[0][1]);
  assert.equal(painting.title, catalog.art[0][2]);
  assert.equal(painting.cacheImage, true, 'Museum prints are downscaled and cached before showing');
  assert.equal(painting.imageUrl,
    `https://openaccess-cdn.clevelandart.org/${catalog.art[0][0]}/${catalog.art[0][0]}_print.jpg`);
  assert.equal(painting.sourceUrl, `https://clevelandart.org/art/${catalog.art[0][0]}`);
  for (const bad of ['cma-1980', 'cma-../../x', 'cma-1980.262/evil']) {
    assert.equal(remote.wallpaperFromId(bad), null, `${bad} must be rejected`);
  }
  assert.equal(remote.getCuratedDailyWallpaper('art', morning0()).provider, 'curated');
  assert.equal(remote.wallpaperFromId('curated-daily-sculpture').category, 'random',
    'A category from a newer version falls back instead of losing the pick');

  const morning = new Date(2026, 9, 7, 0, 5).getTime();
  const evening = new Date(2026, 9, 7, 23, 55).getTime();
  const deviceA = remote.createClient({ storageArea: storage(), now: () => morning, fetch: async () => assert.fail() });
  const deviceB = remote.createClient({ storageArea: storage(), now: () => evening, fetch: async () => assert.fail() });
  const dailyA = deviceA.getWallpaper('curated-daily-minimal');
  assert.equal(dailyA.id, 'curated-daily-minimal');
  assert.equal(dailyA.dailyId, deviceB.getWallpaper('curated-daily-minimal').dailyId,
    'Devices on the same date resolve the same photo without any request');
  assert.equal((await deviceA.ensureWallpaper('curated-daily-minimal')).dailyId, dailyA.dailyId);
  assert.equal((await deviceA.restoreWallpaper('picsum-28')).id, 'picsum-28');
  const nature = catalog.nature.map(([picsumId]) => `picsum-${picsumId}`);
  const days = Array.from({ length: nature.length }, (_, index) =>
    remote.getCuratedDailyWallpaper('nature', new Date(2026, 0, 1 + index, 12).getTime()).id);
  assert.equal(new Set(days).size, nature.length, 'The daily photo walks the whole category before repeating');
  assert.notEqual(days[0], days[1]);
  const mix = (hour, date = 7) => remote.getCuratedWallpapers('random', new Date(2026, 9, date, hour).getTime())
    .map((item) => item.id);
  const allIds = Object.keys(catalog).flatMap((category) => remote.getCuratedWallpapers(category).map((item) => item.id));
  assert.deepEqual([...mix(9)].sort(), [...allIds].sort(), 'The random category mixes every photo once');
  assert.deepEqual(mix(9), mix(23), 'The mix keeps its order through the day');
  assert.notDeepEqual(mix(9), mix(9, 8), 'The mix reshuffles on the next day');
  assert(allIds.includes(remote.getCuratedDailyWallpaper('random', morning).id));
  console.log('newtab remote content tests passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
