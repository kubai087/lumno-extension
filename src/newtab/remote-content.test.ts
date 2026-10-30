import { describe, expect, it } from 'vitest';
import type { StorageItems, StorageKeys } from '../domain/storage-port';
import { quoteCache } from '../domain/settings/newtab-quote';
import { bingCatalogCache, bingDailyCache, bingWallpaperMeta } from '../domain/settings/newtab-wallpaper';
import { required } from '../../tests/fakes/dom';
import {
  BING_DAILY_ID,
  CURATED_CATEGORIES,
  createClient,
  curatedDailyId,
  getCuratedDailyWallpaper,
  getCuratedWallpapers,
  getWallpaperProvider,
  isDailyWallpaperId,
  normalizeMarket,
  normalizeQuote,
  normalizeWallpaper,
  wallpaperFromId
} from './remote-content';
import { WALLPAPER_CATALOG as catalog } from './wallpaper/wallpaper-catalog';

// The daily quote and the Bing and bundled wallpapers: fetched, cached on
// this device and shared between the pages that show them.
function storage(initial: StorageItems = {}) {
  const values: StorageItems = structuredClone(initial);
  return {
    values,
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      const list = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : []);
      callback?.(Object.fromEntries(list.map((key) => [key, structuredClone(values[key])])));
    },
    set(payload: StorageItems, callback?: () => void) {
      Object.assign(values, structuredClone(payload));
      callback?.();
    }
  };
}

function response(data: unknown, status = 200) {
  return { ok: status === 200, status, json: async () => data };
}

function wallpaper(rawId = 'OHR.River_ZH-CN123', date = '20261002') {
  return {
    startdate: date, title: 'River', copyright: '© Photographer',
    copyrightlink: 'https://www.bing.com/search?q=river', urlbase: `/th?id=${rawId}`, wp: true
  };
}

// navigator.locks across the pages of one test: one task at a time per name.
function locks() {
  const tasks = new Map<string, Promise<unknown>>();
  return {
    request<T>(name: string, task: () => Promise<T>): Promise<T> {
      const pending = (tasks.get(name) || Promise.resolve()).catch(() => {}).then(task);
      tasks.set(name, pending);
      return pending;
    }
  };
}

// The value at a path of nested records, or undefined.
function dig(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (typeof current === 'object' && current !== null ? Reflect.get(current, key) : undefined), value);
}

const noRequest = async (): Promise<never> => {
  throw new Error('No request expected');
};
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const todayId = 'bing-20261002-OHR.River_ZH-CN123';
const yesterdayId = 'bing-20261001-OHR.Lake_ZH-CN456';
const DAY = 86400000;

describe('remote content normalization', () => {
  it('accepts only short quotes and links them to Hitokoto alone', () => {
    expect(normalizeQuote({ hitokoto: '' })).toBeNull();
    expect(normalizeQuote({ hitokoto: 'x'.repeat(121) })).toBeNull();
    expect(normalizeQuote({ hitokoto: 'test', uuid: 'javascript:alert(1)' })?.url).toBe('https://hitokoto.cn/');
  });

  it('picks Bing’s market from the page language', () => {
    expect(normalizeMarket('zh_CN')).toBe('zh-CN');
    expect(normalizeMarket('zh-Hant')).toBe('zh-TW');
    expect(normalizeMarket('ja')).toBe('ja-JP');
    expect(normalizeMarket('fr-FR')).toBe('en-US');
  });

  it('rejects restricted, misdated and foreign Bing images', () => {
    expect(normalizeWallpaper({ ...wallpaper(), wp: false })).toBeNull();
    expect(normalizeWallpaper({ ...wallpaper(), startdate: '20260231' })).toBeNull();
    expect(normalizeWallpaper({ ...wallpaper(), urlbase: 'https://evil.test/th?id=OHR.River' })).toBeNull();
    expect(normalizeWallpaper({ ...wallpaper(), urlbase: '/th?id=OHR.River%26evil' })).toBeNull();
    expect(wallpaperFromId('bing-../../bad')).toBeNull();
  });

  it('credits a Bing image through a safe link and resizes an existing image for its thumbnail', () => {
    const image = required(normalizeWallpaper(wallpaper()), 'the wallpaper');

    expect(image.sourceUrl).toBe('https://www.bing.com/search?q=river');
    expect(new URL(image.thumbnailUrl || '').searchParams.get('id')).toBe(new URL(image.imageUrl || '').searchParams.get('id'));
    expect(normalizeWallpaper({ ...wallpaper(), copyrightlink: 'javascript:alert(1)' })?.sourceUrl).toBe('https://www.bing.com');
    expect(normalizeWallpaper({ ...wallpaper(), copyrightlink: '/search?q=river' })?.sourceUrl).toBe('https://www.bing.com/search?q=river');
    expect(normalizeWallpaper({ ...wallpaper(), copyrightlink: 'http://[' })?.sourceUrl).toBe('https://www.bing.com');
  });
});

describe('the daily quote', () => {
  it('fetches once a day without credentials, shared by simultaneous requests, and keeps the last quote offline with backoff', async () => {
    let time = new Date(2026, 9, 2, 12).getTime();
    const requests: Array<[string, RequestInit]> = [];
    const quoteStorage = storage();
    const client = createClient({
      storageArea: quoteStorage,
      now: () => time,
      fetch: async (url, init) => {
        requests.push([url, init]);
        return response({ hitokoto: `quote ${requests.length}`, from: 'book', from_who: 'author' });
      }
    });

    const [first, second] = await Promise.all([client.getQuote('poetry'), client.getQuote('poetry')]);
    expect(requests).toHaveLength(1);
    expect(requests[0][1].credentials).toBe('omit');
    expect(requests[0][0]).toContain('c=i');
    expect(first).toEqual(second);
    await client.getQuote('poetry');
    expect(requests).toHaveLength(1);
    time += DAY;
    expect((await client.getQuote('poetry')).text).toBe('quote 2');
    expect(requests).toHaveLength(2);

    let offlineCalls = 0;
    const offline = createClient({
      storageArea: quoteStorage,
      now: () => time + DAY,
      fetch: async () => {
        offlineCalls += 1;
        throw new Error('offline');
      }
    });
    expect((await offline.getQuote('poetry')).text).toBe('quote 2');
    await offline.getQuote('poetry');
    expect(offlineCalls).toBe(1);
  });

  it('rerolls past the daily cache, drawing again on a repeat, and keeps the reroll for the day', async () => {
    const time = new Date(2026, 9, 3, 12).getTime();
    const rerollStorage = storage();
    const texts = ['same', 'same', 'fresh'];
    let fetches = 0;
    const client = createClient({
      storageArea: rerollStorage,
      now: () => time,
      fetch: async () => {
        const text = texts[fetches];
        fetches += 1;
        if (!text) throw new Error('offline');
        return response({ hitokoto: text });
      }
    });

    expect((await client.getQuote('literature')).text).toBe('same');
    expect((await client.getQuote('literature', { reroll: true })).text).toBe('fresh');
    expect(fetches).toBe(3);
    expect((await client.getQuote('literature')).text).toBe('fresh');
    expect(fetches).toBe(3);
    await expect(client.getQuote('literature', { reroll: true })).rejects.toThrow(/offline/);
    expect(dig(rerollStorage.values, quoteCache.key, 'literature', 'quote', 'text')).toBe('fresh');
    const tomorrow = createClient({ storageArea: rerollStorage, now: () => time + DAY, fetch: async () => response({ hitokoto: 'tomorrow' }) });
    expect((await tomorrow.getQuote('literature')).text).toBe('tomorrow');
  });
});

describe('Bing wallpapers', () => {
  it('lists the market’s archive without credentials or referrer, rechecks during the day and backs off a rate limit', async () => {
    let time = new Date(2026, 9, 2, 12).getTime();
    let rateLimited = false;
    const requests: Array<[string, RequestInit]> = [];
    const client = createClient({
      storageArea: storage(),
      now: () => time,
      language: 'zh_CN',
      fetch: async (url, init) => {
        requests.push([url, init]);
        return rateLimited ? response({}, 429) : response({ images: [wallpaper(), { ...wallpaper('OHR.Restricted'), wp: false }] });
      }
    });

    expect(await client.getCatalog()).toHaveLength(1);
    const target = new URL(requests[0][0]);
    expect([target.origin, target.pathname, target.searchParams.get('mkt'), target.searchParams.get('n')])
      .toEqual(['https://www.bing.com', '/HPImageArchive.aspx', 'zh-CN', '8']);
    expect([requests[0][1].credentials, requests[0][1].referrerPolicy]).toEqual(['omit', 'no-referrer']);
    await client.getCatalog();
    expect(requests).toHaveLength(1);
    time += 60 * 60 * 1000;
    await client.getCatalog();
    expect(requests).toHaveLength(2);
    rateLimited = true;
    expect(await client.getCatalog(true)).toHaveLength(1);
    await client.getCatalog(true);
    expect(requests).toHaveLength(3);
  });

  it('shows a chosen photo straight from Bing and keeps its details for later', async () => {
    const imageStorage = storage();
    const client = createClient({ storageArea: imageStorage, now: () => new Date(2026, 9, 2, 12).getTime(), fetch: noRequest });
    client.setPinnedIds([yesterdayId, 'monet-coastal-white']);
    const saved = await client.ensureWallpaper(todayId);

    expect(saved.imageUrl).toBe('https://www.bing.com/th?id=OHR.River_ZH-CN123_1920x1080.jpg&pid=hp');
    expect(saved).not.toHaveProperty('imageDataUrl');
    expect(imageStorage.values[bingWallpaperMeta.key]).toBeUndefined();
    imageStorage.values[bingCatalogCache.key] = { 'en-US': { items: [normalizeWallpaper(wallpaper())] } };
    const restored = createClient({ storageArea: imageStorage, fetch: noRequest });
    expect((await restored.restoreWallpaper(todayId))?.name).toBe('River');
    const withMeta = createClient({ storageArea: storage({ [bingWallpaperMeta.key]: {
      [todayId]: { id: todayId, date: '20261002', name: 'Saved river', copyright: '', sourceUrl: 'https://www.bing.com' } } }) });
    expect((await withMeta.restoreWallpaper(todayId))?.name).toBe('Saved river');
    await restored.ensureWallpaper(todayId);
    expect(dig(imageStorage.values, bingWallpaperMeta.key, todayId, 'name')).toBe('River');
    expect((await createClient({ storageArea: storage() }).restoreWallpaper(todayId))?.imageUrl).toBe(saved.imageUrl);
    await expect(client.ensureWallpaper('javascript:evil')).rejects.toThrow(/Invalid wallpaper/);
  });

  it('shares the daily photo between tabs, switches when Bing publishes, and never goes back or retries early', async () => {
    let time = new Date(2026, 9, 2, 12).getTime();
    let sourceDate = '20261002';
    let offline = false;
    const fetched: string[] = [];
    const dailyStorage = storage();
    const options = {
      storageArea: dailyStorage, now: () => time, locks: locks(), language: 'zh-CN',
      fetch: async (url: string) => {
        if (offline) throw new Error('offline');
        fetched.push(url);
        return response({ images: [wallpaper('OHR.Daily_ZH-CN123', sourceDate)] });
      }
    };
    const tab1 = createClient(options);
    const tab2 = createClient(options);

    const [daily1, daily2] = await Promise.all([tab1.ensureWallpaper(BING_DAILY_ID), tab2.ensureWallpaper(BING_DAILY_ID)]);
    expect(daily1.dailyId).toBe(daily2.dailyId);
    expect(daily1.imageUrl).toContain('OHR.Daily_ZH-CN123');
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain('HPImageArchive');
    await tab1.ensureWallpaper(BING_DAILY_ID);
    expect(fetched).toHaveLength(1);
    sourceDate = '20261003';
    time += DAY;
    const nextDay = await tab1.ensureWallpaper(BING_DAILY_ID);
    expect(nextDay.date).toBe('20261003');
    sourceDate = '20261002';
    time += 3600001;
    expect((await tab2.ensureWallpaper(BING_DAILY_ID)).date).toBe('20261003');

    offline = true;
    time += DAY;
    expect((await createClient(options).ensureWallpaper(BING_DAILY_ID)).date).toBe('20261003');
    const fetchesAfterFailure = fetched.length;
    offline = false;
    await createClient(options).ensureWallpaper(BING_DAILY_ID);
    expect(fetched).toHaveLength(fetchesAfterFailure);
    expect(dig(dailyStorage.values, bingDailyCache.key, 'zh-CN', 'id')).toBe(nextDay.dailyId);
  });

  it('resolves the daily photo once the catalog loads after a rate limit', async () => {
    let time = new Date(2026, 9, 2, 12).getTime();
    let limited = true;
    const client = createClient({
      storageArea: storage(), now: () => time, language: 'en-US',
      fetch: async () => (limited ? response({}, 429) : response({ images: [wallpaper('OHR.Hill_EN-US1')] }))
    });

    await expect(client.ensureWallpaper(BING_DAILY_ID)).rejects.toBeDefined();
    limited = false;
    time += 60001;
    expect(client.getWallpaper(BING_DAILY_ID)?.imageUrl).toBeUndefined();
    await client.getCatalog(true);
    expect((await client.ensureWallpaper(BING_DAILY_ID)).imageUrl).toContain('OHR.Hill_EN-US1');
  });

  it('does not answer a refresh with a plain load still on its way', async () => {
    let fetches = 0;
    let release: () => void = () => {};
    const client = createClient({
      storageArea: storage(), now: () => new Date(2026, 9, 2, 12).getTime(), language: 'en-US',
      fetch: async () => {
        fetches += 1;
        if (fetches === 1) await new Promise<void>((resolve) => { release = resolve; });
        return response({ images: [wallpaper('OHR.Hill_EN-US1')] });
      }
    });

    const plainLoad = client.getCatalog();
    await nextTask();
    const refreshLoad = client.getCatalog(true);
    release();
    await Promise.all([plainLoad, refreshLoad]);
    expect(fetches).toBe(2);
  });

  it('keeps markets saved meanwhile, and the current photo until a new market resolves', async () => {
    const time = new Date(2026, 9, 2, 12).getTime();
    const marketStorage = storage();
    const marketFetch = (rawId: string) => async () => response({ images: [wallpaper(rawId)] });
    await createClient({ storageArea: marketStorage, now: () => time, language: 'en-US', fetch: marketFetch('OHR.Hill_EN-US1') }).getCatalog();
    let language = 'zh-CN';
    let releaseZh: () => void = () => {};
    const zhClient = createClient({
      storageArea: marketStorage, now: () => time, getLanguage: () => language,
      fetch: async (url) => {
        if (url.includes('zh-CN')) await new Promise<void>((resolve) => { releaseZh = resolve; });
        return response({ images: [wallpaper(url.includes('zh-CN') ? 'OHR.River_ZH-CN123' : 'OHR.River_JA-JP123')] });
      }
    });

    const zhLoad = zhClient.getCatalog();
    await nextTask();
    await createClient({ storageArea: marketStorage, now: () => time, language: 'ja-JP', fetch: marketFetch('OHR.River_JA-JP123') }).getCatalog();
    releaseZh();
    await zhLoad;
    expect(Object.keys(Object(marketStorage.values[bingCatalogCache.key])).sort()).toEqual(['en-US', 'ja-JP', 'zh-CN']);

    const zhDaily = await zhClient.ensureWallpaper(BING_DAILY_ID);
    language = 'ja-JP';
    expect((await zhClient.restoreWallpaper(BING_DAILY_ID))?.dailyId).toBe(zhDaily.dailyId);
    const jaDaily = await zhClient.ensureWallpaper(BING_DAILY_ID);
    expect(jaDaily.date).toBe(zhDaily.date);
    expect(jaDaily.dailyId).toContain('JA-JP');
  });
});

describe('curated wallpapers', () => {
  const morning0 = new Date(2026, 9, 7, 9).getTime();

  it('lists its categories, each photo in one of them', () => {
    expect(CURATED_CATEGORIES).toEqual(['random', 'nature', 'water', 'city', 'minimal', 'art']);
    const ids = Object.values(catalog).flat().map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('credits a bundled photo, cached once per device, and resolves one from a larger catalog by its ID', () => {
    const [id, photographer, unsplashId] = catalog.city[0];
    const curated = required(wallpaperFromId(`picsum-${id}`), 'the city photo');

    expect([curated.provider, curated.category, curated.name]).toEqual(['curated', 'city', photographer]);
    expect(curated.sourceUrl).toBe(`https://unsplash.com/photos/${unsplashId}`);
    expect(curated.imageUrl).toBe(`https://picsum.photos/id/${id}/2560/1440`);
    expect(curated.cacheImage).toBe(true);
    const unknown = wallpaperFromId('picsum-5');
    expect([unknown?.imageUrl, unknown?.sourceUrl]).toEqual(['https://picsum.photos/id/5/2560/1440', 'https://picsum.photos']);
    ['picsum-05', 'picsum-12345', 'picsum-1/../x', 'curated-daily-', 'curated-daily-Nature'].forEach((bad) => expect(wallpaperFromId(bad)).toBeNull());
  });

  it('tells providers and daily picks apart by ID', () => {
    expect(getWallpaperProvider(todayId)).toBe('bing');
    expect(getWallpaperProvider('picsum-28')).toBe('curated');
    expect(getWallpaperProvider('monet-coastal-white')).toBe('');
    expect(isDailyWallpaperId(BING_DAILY_ID)).toBe(true);
    expect(isDailyWallpaperId('curated-daily-city')).toBe(true);
    expect(isDailyWallpaperId('picsum-28')).toBe(false);
    expect(curatedDailyId('water')).toBe('curated-daily-water');
    expect(curatedDailyId('bogus')).toBe('curated-daily-random');
  });

  it('downscales and caches a museum print and credits the museum', () => {
    const [id, name, title] = catalog.art[0];
    const painting = required(wallpaperFromId(`cma-${id}`), 'the painting');

    expect([painting.category, painting.name, painting.title, painting.cacheImage]).toEqual(['art', name, title, true]);
    expect(painting.imageUrl).toBe(`https://openaccess-cdn.clevelandart.org/${id}/${id}_print.jpg`);
    expect(painting.sourceUrl).toBe(`https://clevelandart.org/art/${id}`);
    ['cma-1980', 'cma-../../x', 'cma-1980.262/evil'].forEach((bad) => expect(wallpaperFromId(bad)).toBeNull());
    expect(getCuratedDailyWallpaper('art', morning0)?.provider).toBe('curated');
    expect(wallpaperFromId('curated-daily-sculpture')?.category).toBe('random');
  });

  it('resolves the same daily photo on every device of a date, without any request', async () => {
    const deviceA = createClient({ storageArea: storage(), now: () => new Date(2026, 9, 7, 0, 5).getTime(), fetch: noRequest });
    const deviceB = createClient({ storageArea: storage(), now: () => new Date(2026, 9, 7, 23, 55).getTime(), fetch: noRequest });
    const dailyA = required(deviceA.getWallpaper('curated-daily-minimal'), 'the daily pick');

    expect(dailyA.id).toBe('curated-daily-minimal');
    expect(deviceB.getWallpaper('curated-daily-minimal')?.dailyId).toBe(dailyA.dailyId);
    expect((await deviceA.ensureWallpaper('curated-daily-minimal')).dailyId).toBe(dailyA.dailyId);
    expect((await deviceA.restoreWallpaper('picsum-28'))?.id).toBe('picsum-28');
  });

  it('walks a whole category before repeating a daily photo', () => {
    const days = catalog.nature.map((_photo, index) => getCuratedDailyWallpaper('nature', new Date(2026, 0, 1 + index, 12).getTime())?.id);

    expect(new Set(days).size).toBe(catalog.nature.length);
    expect(days[0]).not.toBe(days[1]);
  });

  it('mixes every photo once in the random category, in one order a day', () => {
    const mix = (hour: number, date = 7) => getCuratedWallpapers('random', new Date(2026, 9, date, hour).getTime()).map((item) => item.id);
    const allIds = Object.keys(catalog).flatMap((category) => getCuratedWallpapers(category).map((item) => item.id));

    expect([...mix(9)].sort()).toEqual([...allIds].sort());
    expect(mix(9)).toEqual(mix(23));
    expect(mix(9)).not.toEqual(mix(9, 8));
    expect(allIds).toContain(getCuratedDailyWallpaper('random', new Date(2026, 9, 7, 0, 5).getTime())?.id);
  });
});
