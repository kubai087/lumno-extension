const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function createStyle() {
  const values = new Map();
  return {
    getPropertyValue(name) {
      return values.get(String(name)) || '';
    },
    setProperty(name, value) {
      values.set(String(name), String(value));
    },
    removeProperty(name) {
      values.delete(String(name));
    }
  };
}

function createElement() {
  const attributes = new Map();
  return {
    style: createStyle(),
    getAttribute(name) {
      return attributes.has(String(name)) ? attributes.get(String(name)) : null;
    },
    setAttribute(name, value) {
      attributes.set(String(name), String(value));
    },
    removeAttribute(name) {
      attributes.delete(String(name));
    },
    getBoundingClientRect() {
      return {
        left: 100,
        top: 100,
        right: 148,
        bottom: 148,
        width: 48,
        height: 48
      };
    }
  };
}

function createCanvas() {
  let drawnImage = null;
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage(image) {
          drawnImage = image;
        },
        getImageData() {
          const pixel = drawnImage && drawnImage.pixel
            ? drawnImage.pixel
            : { red: 128, green: 128, blue: 128 };
          const length = Math.max(1, canvas.width * canvas.height) * 4;
          const data = new Uint8ClampedArray(length);
          for (let index = 0; index < length; index += 4) {
            data[index] = pixel.red;
            data[index + 1] = pixel.green;
            data[index + 2] = pixel.blue;
            data[index + 3] = 255;
          }
          return { data };
        }
      };
    }
  };
  return canvas;
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

(async () => {
  const target = createElement();
  const body = createElement();
  body.setAttribute('data-wallpaper-active', 'true');
  const canvas = createCanvas();
  const pendingImages = [];
  const scheduledFrames = new Map();
  let nextFrameId = 0;
  let currentWallpaper = {
    id: 'dark-wallpaper',
    url: 'test://dark-wallpaper'
  };

  class FakeImage {
    constructor() {
      this.width = 10;
      this.height = 10;
      this.naturalWidth = 10;
      this.naturalHeight = 10;
      this.onload = null;
      this.onerror = null;
      this.pixel = null;
      this.settled = false;
      pendingImages.push(this);
    }

    set src(value) {
      this._src = String(value);
    }

    get src() {
      return this._src;
    }

    decode() {
      return Promise.resolve();
    }

    resolve(pixel) {
      assert.strictEqual(this.settled, false, `image ${this.src} should settle once`);
      this.settled = true;
      this.pixel = pixel;
      this.onload();
    }

    reject() {
      assert.strictEqual(this.settled, false, `image ${this.src} should settle once`);
      this.settled = true;
      this.onerror();
    }
  }

  function getPendingImage(url) {
    const image = pendingImages.find((candidate) => candidate.src === url && !candidate.settled);
    assert.ok(image, `expected a pending image for ${url}`);
    return image;
  }

  const documentObj = {
    body,
    documentElement: {
      clientWidth: 1000,
      clientHeight: 600
    },
    createElement(tagName) {
      return String(tagName).toLowerCase() === 'canvas' ? canvas : createElement();
    }
  };
  const windowObj = {
    innerWidth: 1000,
    innerHeight: 600,
    requestAnimationFrame(callback) {
      const id = ++nextFrameId;
      scheduledFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      scheduledFrames.delete(id);
    }
  };
  const sandbox = {
    console,
    Image: FakeImage,
    Uint8ClampedArray,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    fs.readFileSync('src/newtab/wallpaper-adaptive-tone.js', 'utf8'),
    sandbox,
    { filename: 'src/newtab/wallpaper-adaptive-tone.js' }
  );

  const runtime = sandbox.LumnoNewtabWallpaperAdaptiveTone.createWallpaperAdaptiveTone({
    documentObj,
    windowObj,
    getTargets() {
      return [{
        element: target,
        sampleElement: target,
        minWidth: 42,
        minHeight: 42,
        iconButton: true
      }];
    },
    getCurrentWallpaper() {
      return currentWallpaper;
    },
    getWallpaperImageUrl(wallpaper) {
      return wallpaper.url;
    },
    getOverlayAlphaAtViewportY() {
      return 0;
    },
    getOverlayLuminance() {
      return 1;
    },
    getEffectLuminanceAtViewport() {
      return null;
    },
    applyWordmarkThemeAppearance() {}
  });

  runtime.refresh();
  getPendingImage('test://dark-wallpaper').resolve({ red: 16, green: 24, blue: 32 });
  await flushAsyncWork();

  const darkInk = target.getAttribute('data-wallpaper-ink');
  const darkAdaptiveColor = target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink');
  assert.strictEqual(darkInk, 'light');
  assert.ok(darkAdaptiveColor, 'the initial wallpaper should apply an adaptive color');
  assert.strictEqual(scheduledFrames.size, 1, 'the initial apply should schedule a follow-up sample');

  currentWallpaper = {
    id: 'light-wallpaper',
    url: 'test://light-wallpaper'
  };
  runtime.refresh();

  assert.strictEqual(
    scheduledFrames.size,
    0,
    'starting a replacement sampler should cancel the stale scheduled apply'
  );
  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    darkInk,
    'the previous ink choice should remain while the replacement image is loading'
  );
  assert.strictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    darkAdaptiveColor,
    'the previous adaptive color should remain while the replacement image is loading'
  );

  runtime.schedule();
  assert.strictEqual(
    scheduledFrames.size,
    0,
    'layout updates should not resample the previous image during a wallpaper transition'
  );

  const staleLightImage = getPendingImage('test://light-wallpaper');
  currentWallpaper = {
    id: 'dark-wallpaper',
    url: 'test://dark-wallpaper'
  };
  runtime.refresh();

  assert.strictEqual(
    pendingImages.filter((image) => image.src === 'test://dark-wallpaper').length,
    1,
    'switching back should reuse the retained sampler instead of loading the previous wallpaper again'
  );
  assert.strictEqual(
    scheduledFrames.size,
    1,
    'switching back should resume sampling from the retained active wallpaper'
  );

  staleLightImage.resolve({ red: 244, green: 248, blue: 252 });
  await flushAsyncWork();
  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    darkInk,
    'a canceled replacement load should not overwrite the restored active wallpaper'
  );

  currentWallpaper = {
    id: 'light-wallpaper',
    url: 'test://light-wallpaper'
  };
  runtime.refresh();
  getPendingImage('test://light-wallpaper').resolve({ red: 244, green: 248, blue: 252 });
  await flushAsyncWork();

  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    'dark',
    'the replacement sampler should atomically apply the new ink choice when ready'
  );
  assert.notStrictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    darkAdaptiveColor,
    'the replacement sampler should overwrite the retained adaptive color'
  );

  currentWallpaper = {
    id: 'failed-wallpaper',
    url: 'test://failed-wallpaper'
  };
  runtime.refresh();
  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    'dark',
    'a pending image should retain the last valid tone even if it will later fail'
  );

  getPendingImage('test://failed-wallpaper').reject();
  await flushAsyncWork();

  assert.strictEqual(
    target.getAttribute('data-wallpaper-ink'),
    null,
    'a current wallpaper load failure should clear the retained tone'
  );
  assert.strictEqual(
    target.style.getPropertyValue('--x-nt-wallpaper-adaptive-ink'),
    '',
    'a current wallpaper load failure should restore the theme fallback'
  );

  console.log('new tab wallpaper adaptive tone transition tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
