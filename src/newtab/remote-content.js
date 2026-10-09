(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LumnoNewtabRemoteContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  const QUOTE_CACHE_KEY = '_x_extension_newtab_quote_cache_2026_unique_';
  const BING_CACHE_KEY = '_x_extension_bing_catalog_cache_2026_unique_';
  const BING_DAILY_CACHE_KEY = '_x_extension_bing_daily_cache_2026_unique_';
  const BING_META_CACHE_KEY = '_x_extension_bing_wallpaper_meta_2026_unique_';
  const BING_DAILY_ID = 'bing-daily';
  const BING_ID_PATTERN = /^bing-(\d{8})-(OHR\.[a-zA-Z0-9_-]{1,160})$/;
  const BING_ORIGIN = 'https://www.bing.com';
  const CATALOG = root.LumnoNewtabWallpaperCatalog ||
    (typeof require === 'function' ? require('./wallpaper-catalog.js') : {});
  // The random category mixes every bundled category, so it leads the list as the default view.
  const RANDOM_CATEGORY = 'random';
  const CURATED_CATEGORIES = Object.freeze([RANDOM_CATEGORY, ...Object.keys(CATALOG)]);
  const CURATED_DAILY_PREFIX = 'curated-daily-';
  const CURATED_DAILY_ID_PATTERN = /^curated-daily-([a-z]{1,24})$/;
  // Any Picsum photo resolves from its ID alone, so a pick synced from a version with a larger
  // catalog still shows here; only bundled photos carry credits.
  const PICSUM_ID_PATTERN = /^picsum-(0|[1-9]\d{0,3})$/;
  const PICSUM_ORIGIN = 'https://picsum.photos';
  const CMA_ID_PATTERN = /^cma-(\d{4}\.[0-9a-z.]{1,20})$/;
  const CMA_IMAGE_ORIGIN = 'https://openaccess-cdn.clevelandart.org';
  const CURATED_DAILY_STRIDES = [37, 41, 43, 47, 53];
  const curatedCredits = new Map();
  // Photo rows start with a numeric Picsum ID; art rows start with an accession number.
  const curatedRowId = (row) => typeof row[0] === 'number' ? `picsum-${row[0]}` : `cma-${row[0]}`;
  Object.keys(CATALOG).forEach((category) => CATALOG[category].forEach((row) => {
    curatedCredits.set(curatedRowId(row), { category, author: row[1], detail: row[2] });
  }));

  function normalizeMarket(language) {
    const locale = String(language || '').replace(/_/g, '-').toLowerCase();
    if (locale.startsWith('zh')) return locale.includes('tw') || locale.includes('hant') ? 'zh-TW' : 'zh-CN';
    return locale.startsWith('ja') ? 'ja-JP' : 'en-US';
  }

  function read(area, key) {
    return readMany(area, [key]).then((values) => values[key]);
  }

  function readMany(area, keys) {
    return new Promise((resolve) => {
      if (!area || typeof area.get !== 'function') return resolve({});
      area.get(keys, (values) => resolve(values || {}));
    });
  }

  function write(area, key, value) {
    return new Promise((resolve, reject) => {
      if (!area || typeof area.set !== 'function') return resolve();
      area.set({ [key]: value }, () => {
        const error = root.chrome && root.chrome.runtime && root.chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve();
      });
    });
  }

  function localDay(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  function normalizeQuote(value) {
    if (!value || typeof value !== 'object' || typeof value.hitokoto !== 'string') return null;
    const text = value.hitokoto.trim();
    if (!text || text.length > 120) return null;
    const uuid = typeof value.uuid === 'string' && /^[a-f0-9-]{36}$/i.test(value.uuid)
      ? value.uuid : '';
    return {
      text,
      source: typeof value.from === 'string' ? value.from.slice(0, 160) : '',
      author: typeof value.from_who === 'string' ? value.from_who.slice(0, 80) : '',
      url: uuid ? `https://hitokoto.cn/?uuid=${uuid}` : 'https://hitokoto.cn/'
    };
  }

  function curatedWallpaperFromId(id) {
    const daily = CURATED_DAILY_ID_PATTERN.exec(id);
    if (daily) {
      // A category from a newer version falls back to the first one instead of losing the pick.
      const category = CURATED_CATEGORIES.includes(daily[1]) ? daily[1] : CURATED_CATEGORIES[0] || '';
      return { id, provider: 'curated', category, daily: true, name: 'Picsum', sourceUrl: PICSUM_ORIGIN };
    }
    const credit = curatedCredits.get(id);
    const art = CMA_ID_PATTERN.exec(id);
    if (art) {
      // Museum prints run 1–8 MB, so the page downscales and caches one copy per device and shows
      // the 900px web image until that copy exists.
      const base = `${CMA_IMAGE_ORIGIN}/${art[1]}/${art[1]}`;
      return { id, provider: 'curated', category: credit ? credit.category : 'art',
        name: credit ? credit.author : '', title: credit ? credit.detail : '',
        sourceUrl: `https://clevelandart.org/art/${art[1]}`,
        imageUrl: `${base}_print.jpg`, thumbnailUrl: `${base}_web.jpg`, cacheImage: true };
    }
    const match = PICSUM_ID_PATTERN.exec(id);
    if (!match) return null;
    // Picsum can take seconds or fail on some networks, and a failed photo never reaches the HTTP
    // cache, so every new tab would wait on it again. Photos are cached once per device like prints.
    return { id, provider: 'curated', category: credit ? credit.category : '',
      name: credit ? credit.author : 'Picsum',
      sourceUrl: credit ? `https://unsplash.com/photos/${credit.detail}` : PICSUM_ORIGIN,
      imageUrl: `${PICSUM_ORIGIN}/id/${match[1]}/2560/1440`,
      thumbnailUrl: `${PICSUM_ORIGIN}/id/${match[1]}/480/270`, cacheImage: true };
  }

  function wallpaperFromId(id) {
    const value = String(id || '');
    if (value === BING_DAILY_ID) return { id, provider: 'bing', name: 'Bing', sourceUrl: BING_ORIGIN };
    const match = BING_ID_PATTERN.exec(value);
    // Like curated photos, a Bing photo is cached once per device, so new tabs open without the network.
    return match ? { id, provider: 'bing', date: match[1], rawId: match[2], name: 'Bing', sourceUrl: BING_ORIGIN,
      imageUrl: `${BING_ORIGIN}/th?id=${match[2]}_1920x1080.jpg&pid=hp`,
      thumbnailUrl: `${BING_ORIGIN}/th?id=${match[2]}_1920x1080.jpg&pid=hp&w=480&h=270&c=1`, cacheImage: true }
      : curatedWallpaperFromId(value);
  }

  function getWallpaperProvider(id) {
    const item = wallpaperFromId(id);
    return item ? item.provider : '';
  }

  function isDailyWallpaperId(id) {
    return id === BING_DAILY_ID || CURATED_DAILY_ID_PATTERN.test(String(id || ''));
  }

  function curatedDailyId(category) {
    return `${CURATED_DAILY_PREFIX}${CURATED_CATEGORIES.includes(category) ? category : CURATED_CATEGORIES[0]}`;
  }

  function getCuratedRows(category) {
    return category === RANDOM_CATEGORY ? Object.values(CATALOG).flat() : CATALOG[category] || [];
  }

  function localDayNumber(timestamp) {
    const date = new Date(timestamp);
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  // The random mix reshuffles once a day: pages and highlights stay put within the day, and
  // devices on the same date list the photos in the same order.
  function shuffleForDay(rows, timestamp) {
    let seed = localDayNumber(timestamp) * 2654435761 >>> 0;
    const next = () => {
      seed = seed + 0x6D2B79F5 >>> 0;
      let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
      value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
    const shuffled = rows.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(next() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled;
  }

  function getCuratedWallpapers(category, timestamp) {
    const rows = category === RANDOM_CATEGORY
      ? shuffleForDay(getCuratedRows(category), timestamp === undefined ? Date.now() : timestamp)
      : getCuratedRows(category);
    return rows.map((row) => curatedWallpaperFromId(curatedRowId(row)));
  }

  // Devices on the same local date pick the same photo without talking to each other. A stride
  // coprime to the list length walks the whole category before repeating, and consecutive days
  // land far apart in the list.
  function getCuratedDailyWallpaper(category, timestamp) {
    const list = getCuratedRows(category);
    if (!list.length) return null;
    const day = localDayNumber(timestamp);
    const stride = CURATED_DAILY_STRIDES.find((step) => list.length % step !== 0) || 1;
    return curatedWallpaperFromId(curatedRowId(list[((day * stride) % list.length + list.length) % list.length]));
  }

  // Credit links are optional, so a relative or malformed one falls back to Bing instead of dropping the photo.
  function normalizeSourceUrl(link) {
    if (!link) return BING_ORIGIN;
    try {
      const source = new URL(String(link), BING_ORIGIN);
      return source.protocol === 'https:' && ['www.bing.com', 'cn.bing.com'].includes(source.hostname) &&
        !source.port && !source.username && !source.password ? source.href : BING_ORIGIN;
    } catch (_error) { return BING_ORIGIN; }
  }

  function normalizeWallpaper(value) {
    if (!value || value.wp !== true || !/^\d{8}$/.test(value.startdate)) return null;
    const date = new Date(`${value.startdate.slice(0, 4)}-${value.startdate.slice(4, 6)}-${value.startdate.slice(6, 8)}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10).replace(/-/g, '') !== value.startdate) return null;
    try {
      const url = new URL(value.urlbase, BING_ORIGIN);
      if (url.origin !== BING_ORIGIN || url.pathname !== '/th' || url.username || url.password) return null;
      const item = wallpaperFromId(`bing-${value.startdate}-${url.searchParams.get('id')}`);
      if (!item || !item.rawId) return null;
      return { ...item, name: String(value.title || 'Bing').slice(0, 200),
        copyright: String(value.copyright || '').slice(0, 500), date: value.startdate,
        sourceUrl: normalizeSourceUrl(value.copyrightlink) };
    } catch (_error) { return null; }
  }

  function normalizeStoredWallpaper(value) {
    const item = value && wallpaperFromId(value.id);
    return item && item.rawId ? normalizeWallpaper({ wp: true, startdate: value.date,
      urlbase: `/th?id=${item.rawId}`, title: value.name, copyright: value.copyright,
      copyrightlink: value.sourceUrl }) : null;
  }

  // Earlier versions kept Bing images in their own database; copies now share the wallpaper image cache.
  function deleteLegacyMediaStore(indexedDB) {
    try {
      if (indexedDB && typeof indexedDB.deleteDatabase === 'function') indexedDB.deleteDatabase('lumno-bing');
    } catch (_error) {}
  }

  function createClient(options) {
    const config = options || {};
    const area = config.storageArea;
    const fetcher = config.fetch || root.fetch.bind(root);
    const now = config.now || Date.now;
    const locks = config.locks || (root.navigator && root.navigator.locks);
    const images = new Map();
    const pendingImages = new Map();
    const quoteTasks = new Map();
    const catalogTasks = new Map();
    let pinnedIds = [];
    let dailyWallpaper = null;
    let dailyMarket = '';
    const getMarket = () => normalizeMarket(typeof config.getLanguage === 'function' ? config.getLanguage() : config.language);
    deleteLegacyMediaStore(root.indexedDB);
    function lock(name, task) {
      return locks && typeof locks.request === 'function' ? locks.request(name, task) : task();
    }
    async function request(url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetcher(url, { signal: controller.signal, credentials: 'omit',
          referrerPolicy: 'no-referrer' });
        if (!response.ok) {
          const error = new Error(`Request failed (${response.status}).`);
          error.status = response.status;
          throw error;
        }
        return await response.json();
      } finally { clearTimeout(timer); }
    }
    // A reroll skips the daily cache and saves its pick as today's quote, so it stays until the next day.
    // It fails loudly instead of falling back, leaving the current quote in place.
    function getQuote(category, options) {
      const type = category === 'poetry' ? 'poetry' : 'literature';
      const reroll = Boolean(options && options.reroll);
      const taskKey = reroll ? `${type}:reroll` : type;
      if (quoteTasks.has(taskKey)) return quoteTasks.get(taskKey);
      const task = lock('lumno-daily-quote', async () => {
        const cache = (await read(area, QUOTE_CACHE_KEY)) || {};
        const entry = cache[type];
        if (!reroll && entry && entry.quote && (entry.day === localDay(now()) || entry.retryAt > now())) {
          return entry.quote;
        }
        const url = `https://v1.hitokoto.cn/?c=${type === 'poetry' ? 'i' : 'd'}&encode=json&max_length=40`;
        if (reroll) {
          let quote = normalizeQuote(await request(url));
          // The pool is large but not endless; one more draw keeps a reroll from showing the same line.
          if (quote && entry && entry.quote && quote.text === entry.quote.text) quote = normalizeQuote(await request(url));
          if (!quote) throw new Error('Invalid quote response.');
          const latest = (await read(area, QUOTE_CACHE_KEY)) || {};
          await write(area, QUOTE_CACHE_KEY, { ...latest, [type]: { quote, day: localDay(now()) } });
          return quote;
        }
        try {
          const data = await request(url);
          const quote = normalizeQuote(data);
          if (!quote) throw new Error('Invalid quote response.');
          // Read again so concurrently updated categories are not overwritten.
          const latest = (await read(area, QUOTE_CACHE_KEY)) || {};
          await write(area, QUOTE_CACHE_KEY, { ...latest, [type]: { quote, day: localDay(now()) } });
          return quote;
        } catch (_error) {
          const fallback = typeof config.fallbackQuote === 'function' ? config.fallbackQuote() : config.fallbackQuote;
          const quote = entry && entry.quote || fallback || {
            text: 'A journey of a thousand miles begins with a single step.', author: 'Laozi',
            source: 'Tao Te Ching', url: 'https://hitokoto.cn/'
          };
          const latest = (await read(area, QUOTE_CACHE_KEY)) || {};
          await write(area, QUOTE_CACHE_KEY, { ...latest,
            [type]: { quote, day: entry && entry.day || '', retryAt: now() + 15 * 60 * 1000 } }).catch(() => {});
          return quote;
        }
      }).finally(() => quoteTasks.delete(taskKey));
      quoteTasks.set(taskKey, task);
      return task;
    }
    function getCatalog(refresh) {
      const market = getMarket();
      // A refresh must not resolve with a pending plain load that may serve the cache.
      const taskKey = `${market}${refresh ? ':refresh' : ''}`;
      if (catalogTasks.has(taskKey)) return catalogTasks.get(taskKey);
      const task = lock(`lumno-bing-catalog-${market}`, async () => {
        const entry = ((await read(area, BING_CACHE_KEY)) || {})[market] || {};
        const cached = Array.isArray(entry.items) ? entry.items.map(normalizeStoredWallpaper).filter(Boolean) : [];
        const remember = (items) => {
          items.forEach((item) => images.set(item.id, { ...images.get(item.id), ...item }));
          return items;
        };
        // Recheck during the day because Bing's publishing boundary can differ from the local date.
        if ((!refresh && entry.day === localDay(now()) && entry.updatedAt > now() - 60 * 60 * 1000 ||
            entry.retryAt > now()) && cached.length) return remember(cached);
        if (entry.retryAt > now()) throw new Error('Please try again shortly.');
        try {
          const params = new URLSearchParams({ format: 'js', idx: '0', n: '8', mkt: market });
          const data = await request(`${BING_ORIGIN}/HPImageArchive.aspx?${params}`);
          if (!data || !Array.isArray(data.images)) throw new Error('Invalid wallpaper response.');
          const items = data.images.slice(0, 8).map(normalizeWallpaper).filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date));
          if (!items.length) throw new Error('No downloadable wallpapers.');
          await writeCatalogEntry(market, { items, day: localDay(now()), updatedAt: now(), retryAt: 0 });
          return remember(items);
        } catch (error) {
          await writeCatalogEntry(market, { ...entry,
            retryAt: now() + (error.status === 429 ? 60000 : 15 * 60 * 1000) }).catch(() => {});
          if (cached.length) return remember(cached);
          throw error;
        }
      }).finally(() => catalogTasks.delete(taskKey));
      catalogTasks.set(taskKey, task);
      return task;
    }
    // Read again so markets updated while the request was in flight are not overwritten.
    async function writeCatalogEntry(market, entry) {
      const latest = (await read(area, BING_CACHE_KEY)) || {};
      await write(area, BING_CACHE_KEY, { ...latest, [market]: entry });
    }
    // Titles and credits of chosen photos outlive the 8-day catalog, so keep them separately.
    async function readStoredDetails(id) {
      const saved = (await read(area, BING_META_CACHE_KEY)) || {};
      if (saved[id]) return normalizeStoredWallpaper(saved[id]);
      const catalog = (await read(area, BING_CACHE_KEY)) || {};
      const entry = Object.values(catalog).flatMap((market) => market && Array.isArray(market.items) ? market.items : [])
        .find((item) => item && item.id === id);
      return entry ? normalizeStoredWallpaper(entry) : null;
    }
    function rememberDetails(item) {
      return lock('lumno-bing-meta', async () => {
        const saved = (await read(area, BING_META_CACHE_KEY)) || {};
        const dailyCache = (await read(area, BING_DAILY_CACHE_KEY)) || {};
        const keep = new Set([item.id, ...pinnedIds, ...Object.values(dailyCache).map((entry) => entry && entry.id)]);
        const next = { [item.id]: { id: item.id, date: item.date, name: item.name, copyright: item.copyright,
          sourceUrl: item.sourceUrl, savedAt: now() } };
        Object.values(saved).filter((entry) => entry && entry.id !== item.id)
          .sort((a, b) => b.savedAt - a.savedAt)
          .forEach((entry) => {
            if (keep.has(entry.id) || Object.keys(next).length < 12) next[entry.id] = entry;
          });
        await write(area, BING_META_CACHE_KEY, next);
      });
    }
    async function restoreWallpaper(id) {
      const descriptor = wallpaperFromId(id);
      if (!descriptor) return null;
      if (descriptor.provider === 'curated') return getWallpaper(id);
      if (id === BING_DAILY_ID) {
        const market = getMarket();
        // New tabs wait on this, so read the photo's saved details along with the daily entry.
        const stored = await readMany(area, [BING_DAILY_CACHE_KEY, BING_META_CACHE_KEY]);
        const entry = (stored[BING_DAILY_CACHE_KEY] || {})[market];
        const daily = entry && wallpaperFromId(entry.id);
        // Without an entry for this market (e.g. after a language change), keep the previous
        // photo on screen until ensureDailyWallpaper fetches this market's one.
        if (daily && daily.rawId) {
          const saved = (stored[BING_META_CACHE_KEY] || {})[entry.id];
          const details = saved ? normalizeStoredWallpaper(saved) : null;
          if (details && !images.has(entry.id)) images.set(entry.id, details);
          dailyWallpaper = await restoreWallpaper(entry.id);
          dailyMarket = market;
        }
        return dailyWallpaper ? { ...dailyWallpaper, id: BING_DAILY_ID, dailyId: dailyWallpaper.id } : null;
      }
      if (!images.has(id)) {
        const stored = await readStoredDetails(id).catch(() => null);
        images.set(id, stored || descriptor);
      }
      return images.get(id);
    }
    function ensureWallpaper(id) {
      const descriptor = wallpaperFromId(id);
      if (!descriptor) return Promise.reject(new Error('Invalid wallpaper ID.'));
      // Curated photos resolve from the bundle; the image itself loads like any other.
      if (descriptor.provider === 'curated') return Promise.resolve(getWallpaper(id));
      if (id === BING_DAILY_ID) return ensureDailyWallpaper();
      if (pendingImages.has(id)) return pendingImages.get(id);
      const task = restoreWallpaper(id).then(async (item) => {
        // A bare ID carries no title yet; only details from the catalog are worth keeping.
        if ('copyright' in item) await rememberDetails(item).catch(() => {});
        return item;
      }).finally(() => pendingImages.delete(id));
      pendingImages.set(id, task);
      return task;
    }
    function ensureDailyWallpaper() {
      const market = getMarket();
      const key = `${BING_DAILY_ID}-${market}`;
      if (pendingImages.has(key)) return pendingImages.get(key);
      const task = lock(`lumno-bing-daily-${market}`, async () => {
        await restoreWallpaper(BING_DAILY_ID);
        // Backoff lives in getCatalog alone, so a successful refresh resolves the daily photo right away.
        try {
          const items = await getCatalog();
          const latest = items[0];
          // A delayed or stale archive response must not replace a newer daily photo.
          if (dailyWallpaper && dailyMarket === market && dailyWallpaper.date >= latest.date) {
            return getWallpaper(BING_DAILY_ID);
          }
          const record = await ensureWallpaper(latest.id);
          const cache = (await read(area, BING_DAILY_CACHE_KEY)) || {};
          await write(area, BING_DAILY_CACHE_KEY, { ...cache, [market]: { id: record.id } });
          dailyWallpaper = record;
          dailyMarket = market;
          return getWallpaper(BING_DAILY_ID);
        } catch (error) {
          if (dailyWallpaper) return getWallpaper(BING_DAILY_ID);
          throw error;
        }
      }).finally(() => pendingImages.delete(key));
      pendingImages.set(key, task);
      return task;
    }
    function getWallpaper(id) {
      if (id === BING_DAILY_ID && dailyWallpaper) {
        return { ...dailyWallpaper, id, dailyId: dailyWallpaper.id };
      }
      const descriptor = wallpaperFromId(id);
      if (descriptor && descriptor.daily && descriptor.provider === 'curated') {
        const pick = getCuratedDailyWallpaper(descriptor.category, now());
        return pick ? { ...pick, id, daily: true, dailyId: pick.id } : descriptor;
      }
      return images.get(id) || wallpaperFromId(id);
    }
    return Object.freeze({ getQuote, getCatalog, ensureWallpaper, restoreWallpaper, getWallpaper,
      setPinnedIds: (ids) => { pinnedIds = ids.filter((id) => wallpaperFromId(id)); } });
  }

  return Object.freeze({ QUOTE_CACHE_KEY, BING_CACHE_KEY, BING_DAILY_CACHE_KEY, BING_META_CACHE_KEY, BING_DAILY_ID,
    CURATED_CATEGORIES, RANDOM_CATEGORY, normalizeMarket, localDay, normalizeQuote, normalizeWallpaper, wallpaperFromId,
    getWallpaperProvider, isDailyWallpaperId, curatedDailyId, getCuratedWallpapers, getCuratedDailyWallpaper,
    createClient });
});
