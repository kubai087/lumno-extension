const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { runModuleInContext } = require('../helpers/module-script');

const repoRoot = path.join(__dirname, '..', '..');
const sources = runModuleInContext('src/newtab/wallpaper/runtime/wallpaper-sources.ts', vm.createContext({}));

function createSources(overrides) {
  const cachedWallpaperImages = new Map();
  const wallpaperNetworkImageStates = new Map();
  const remoteWallpapers = new Map();
  const linkWallpapers = new Map();
  const deps = Object.assign({
    NEWTAB_WALLPAPER_MODE_DARK: 'dark',
    NEWTAB_WALLPAPER_MODE_LIGHT: 'light',
    NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION: 2,
    NEWTAB_WALLPAPER_DEFAULT_ID: 'monet-coastal-white',
    localWallpaperStore: { isCustomWallpaperId: (id) => /^custom-wallpaper-/.test(id) },
    isLinkWallpaperId: (id) => /^link-/.test(id),
    getLinkWallpaperById: (id) => linkWallpapers.get(id) || null,
    getDailyWallpaperPick: () => '',
    remoteClient: { getWallpaper: (id) => remoteWallpapers.get(id) || null },
    NEWTAB_WALLPAPER_OPTIONS: [
      { id: 'monet-coastal-white', file: 'lumno-newtab-monet-coastal-white.webp' }
    ],
    NEWTAB_CUSTOM_WALLPAPER_ID: 'custom-wallpaper',
    NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX: '-thumb.webp',
    NEWTAB_WALLPAPER_SAMPLE_SUFFIX: '-sample.avif',
    NEWTAB_WALLPAPER_SOURCE_SIZE: { width: 2048, height: 1152 },
    NEWTAB_WALLPAPER_EXTENSION_DIRECTORY: 'assets/wallpapers',
    cachedWallpaperImages,
    dailyWallpaperStandIns: new Map(),
    chrome: { runtime: { getURL: (path) => `chrome-extension://abc/${path}` } },
    wallpaperNetworkImageStates,
    t: (_key, fallback) => fallback,
    wallpaperState: {
      customWallpapers: [
        { id: 'custom-wallpaper-a', imageDataUrl: 'data:image/webp;base64,ZnVsbA==', thumbnailDataUrl: 'data:image/webp;base64,c21hbGw=', width: 2560, height: 1440 },
        { id: 'custom-wallpaper-b', imageDataUrl: 'data:image/webp;base64,ZnVsbC1i', thumbnailDataUrl: 'data:image/webp;base64,dGh1bWItYg==', sampleDataUrl: 'data:image/webp;base64,c2FtcGxlLWI=', width: 2560, height: 1440 },
        // Records saved before thumbnails existed carry the full image as their thumbnail.
        { id: 'custom-wallpaper-old', imageDataUrl: 'data:image/webp;base64,b2xk', thumbnailDataUrl: 'data:image/webp;base64,b2xk' }
      ]
    }
  }, overrides);
  return { api: sources.createWallpaperSources(deps), cachedWallpaperImages, wallpaperNetworkImageStates, remoteWallpapers, linkWallpapers };
}

function testSampleNamesTheShownImagesSmallCopyAndFullSize() {
  const { api, cachedWallpaperImages, wallpaperNetworkImageStates, remoteWallpapers, linkWallpapers } = createSources();
  const sample = (id) => {
    const value = api.getWallpaperSample(api.getWallpaperById(id));
    return value && Object.assign({}, value);
  };
  const bundledSample = {
    url: 'chrome-extension://abc/assets/wallpapers/lumno-newtab-monet-coastal-white-sample.avif',
    width: 2048,
    height: 1152
  };

  assert.deepStrictEqual(sample('monet-coastal-white'), bundledSample,
    'a bundled wallpaper samples its bundled small copy, placed by the built-in size');
  assert.deepStrictEqual(sample('custom-wallpaper-b'), { url: 'data:image/webp;base64,c2FtcGxlLWI=', width: 2560, height: 1440 },
    'an upload samples the small copy saved for sampling, placed by the upload size');
  assert.deepStrictEqual(sample('custom-wallpaper-a'), { url: 'data:image/webp;base64,c21hbGw=', width: 2560, height: 1440 },
    'an upload saved before sampling copies existed samples its thumbnail');
  assert.strictEqual(sample('custom-wallpaper-old'), null,
    'a record whose thumbnail is the full image has no smaller copy');

  const photo = { id: 'bing-20260101-OHR.Test_1', cacheImage: true, imageUrl: 'https://example.test/bing.jpg', thumbnailUrl: 'https://example.test/bing-tile.jpg' };
  remoteWallpapers.set('bing-20260101-OHR.Test_1', photo);
  assert.strictEqual(sample('bing-20260101-OHR.Test_1'), null, 'a photo shown from the network has no local small copy');
  cachedWallpaperImages.set('bing-20260101-OHR.Test_1', {
    url: photo.imageUrl,
    imageDataUrl: 'data:image/webp;base64,YmluZw==',
    thumbnailDataUrl: 'data:image/webp;base64,YmluZy1zbWFsbA==',
    sampleDataUrl: 'data:image/webp;base64,YmluZy1zYW1wbGU=',
    width: 1920,
    height: 1080
  });
  assert.deepStrictEqual(sample('bing-20260101-OHR.Test_1'), { url: 'data:image/webp;base64,YmluZy1zYW1wbGU=', width: 1920, height: 1080 },
    'a cached photo samples the small copy cached for sampling');
  cachedWallpaperImages.set('bing-20260101-OHR.Test_1', Object.assign({}, cachedWallpaperImages.get('bing-20260101-OHR.Test_1'),
    { sampleDataUrl: undefined, width: undefined, height: undefined }));
  assert.deepStrictEqual(sample('bing-20260101-OHR.Test_1'), { url: 'data:image/webp;base64,YmluZy1zbWFsbA==', width: 0, height: 0 },
    'a copy cached before sampling copies and sizes were saved samples its thumbnail');

  const remote = { id: 'picsum-2', imageUrl: 'https://example.test/curated.jpg' };
  remoteWallpapers.set('picsum-2', remote);
  assert.strictEqual(sample('picsum-2'), null, 'a network photo still loading has nothing to sample');
  wallpaperNetworkImageStates.set(remote.imageUrl, 'failed');
  assert.deepStrictEqual(sample('picsum-2'), bundledSample,
    'a network photo that failed samples the default it shows instead');

  linkWallpapers.set('link-1', { id: 'link-1', url: 'https://example.test/link.jpg', imageDataUrl: '', thumbnailDataUrl: '' });
  assert.strictEqual(sample('link-1'), null, 'a link shown from the network has no local small copy');
  linkWallpapers.set('link-1', { id: 'link-1', url: 'https://example.test/link.jpg', imageDataUrl: 'data:image/webp;base64,bGluaw==', thumbnailDataUrl: 'data:image/webp;base64,bGluay1zbWFsbA==', width: 1600, height: 900 });
  assert.deepStrictEqual(sample('link-1'), { url: 'data:image/webp;base64,bGluay1zbWFsbA==', width: 1600, height: 900 });

  assert.strictEqual(api.getWallpaperSample(null), null);
}

// The width and height a WebP (lossy, lossless or extended) or AVIF file declares.
function readImageSize(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 4, 8) === 'ftyp') {
    // AVIF: the image spatial extents property, 'ispe', after its version and flags.
    const ispe = bytes.indexOf('ispe', 0, 'ascii');
    assert.ok(ispe > 0, `${file} declares its size`);
    return { width: bytes.readUInt32BE(ispe + 8), height: bytes.readUInt32BE(ispe + 12) };
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`${file} is neither WebP nor AVIF`);
}

// scripts/build/generate-wallpaper-samples.js writes these; a wallpaper added or replaced without
// running it would sample a missing or stale copy.
function testEveryBuiltInWallpaperHasASampleAtTheSamplerSize() {
  const effects = runModuleInContext('src/newtab/wallpaper/wallpaper-effects.ts', vm.createContext({}));
  const source = fs.readFileSync(path.join(repoRoot, 'src/newtab/wallpaper/wallpaper-options.ts'), 'utf8');
  const suffix = source.match(/NEWTAB_WALLPAPER_SAMPLE_SUFFIX\s*=\s*'([^']+)'/)[1];
  const sourceSize = source.match(/NEWTAB_WALLPAPER_SOURCE_SIZE\s*=\s*Object\.freeze\(\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}\)/);
  const files = [...source.matchAll(/\bfile:\s*'([^']+\.webp)'/g)].map((match) => match[1]);
  assert.ok(files.length >= 18, 'the built-in wallpapers are listed');
  files.forEach((file) => {
    const full = readImageSize(path.join(repoRoot, 'assets/wallpapers', file));
    assert.deepStrictEqual(full, { width: Number(sourceSize[1]), height: Number(sourceSize[2]) },
      `${file} is the size NEWTAB_WALLPAPER_SOURCE_SIZE names, which places its samples`);
    const sampleFile = path.join(repoRoot, 'assets/wallpapers', file.replace(/\.webp$/, suffix));
    assert.ok(fs.existsSync(sampleFile), `${file} has a sample copy`);
    const expected = effects.getSamplerSize(full.width, full.height);
    assert.deepStrictEqual(Object.assign({}, readImageSize(sampleFile)), Object.assign({}, expected),
      `${file}'s sample copy is the size its sampler reads`);
  });
}

testSampleNamesTheShownImagesSmallCopyAndFullSize();
testEveryBuiltInWallpaperHasASampleAtTheSamplerSize();
console.log('new tab wallpaper sources tests passed');
