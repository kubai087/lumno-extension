(function(root) {
  'use strict';

  const EFFECT_TYPES = ['none', 'blur', 'grain', 'blocks', 'halftone', 'dither', 'ascii', 'crt'];
  const EFFECT_INK_TONES = ['auto', 'dark', 'light'];
  const BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  const ASCII_LIGHT_WALLPAPER_THRESHOLD = 0.58;
  const TARGET_EFFECT_CANVAS_PIXELS = 2048 * 2048;
  const MAX_EFFECT_CANVAS_SCALE = 1.6;
  const PARAMETER_RENDER_DEBOUNCE_MS = 72;
  const MIN_BLUR_RADIUS_PX = 2;
  const MAX_BLUR_RADIUS_PX = 32;
  const DEFAULT_PREFS = {
    version: 11,
    type: 'none',
    inkTone: 'auto',
    strength: 50,
    size: 50,
    spacing: 50,
    texture: 20,
    blockSize: 1,
    crtStrength: 20,
    crtBloom: 15,
    crtRgbOffset: 35,
    crtCurvature: 18
  };

  function getOption(options, key, fallback) {
    if (options && Object.prototype.hasOwnProperty.call(options, key)) {
      return options[key];
    }
    return fallback;
  }

  function getFunction(options, key, fallback) {
    const value = getOption(options, key, fallback || function() {});
    return typeof value === 'function' ? value : (fallback || function() {});
  }

  function clampNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return min;
    }
    return Math.min(max, Math.max(min, number));
  }

  function clampCrtPhysicalValue(value, min, max) {
    return Math.round(clampNumber(value, min, max) * 1000) / 1000;
  }

  function normalizeBlockParameter(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.round(clampNumber(number, 0, 5));
  }

  function migratePrefsToLatest(value, inheritedVersion) {
    const source = value && typeof value === 'object' ? value : {};
    const ownVersion = Number(source.version);
    const fallbackVersion = Number(inheritedVersion);
    const storedVersion = Number.isFinite(ownVersion) ? ownVersion : fallbackVersion;
    const migrated = Object.assign({}, source);
    if (!Number.isFinite(storedVersion) || storedVersion < 11) {
      if (source.type === 'blocks') {
        const explicitBlockSize = Number(source.blockSize);
        const legacySize = Number(source.size);
        let blockSize = Number.isFinite(explicitBlockSize) ? explicitBlockSize : legacySize;
        if ((!Number.isFinite(storedVersion) || storedVersion < 10) &&
            Number.isFinite(blockSize) && blockSize > 5) {
          blockSize /= 20;
        }
        migrated.blockSize = Number.isFinite(blockSize)
          ? blockSize
          : DEFAULT_PREFS.blockSize;
        migrated.strength = DEFAULT_PREFS.strength;
        migrated.size = DEFAULT_PREFS.size;
        migrated.spacing = DEFAULT_PREFS.spacing;
        migrated.texture = DEFAULT_PREFS.texture;
      }
      if (source.type === 'crt') {
        migrated.crtStrength = Number.isFinite(Number(source.crtStrength))
          ? source.crtStrength
          : (Number.isFinite(Number(source.strength))
            ? source.strength
            : DEFAULT_PREFS.crtStrength);
        migrated.strength = DEFAULT_PREFS.strength;
      }
    }
    migrated.version = DEFAULT_PREFS.version;
    return migrated;
  }

  function quantizeDitherChannel(value, threshold, levels) {
    const stepCount = Math.max(2, Math.round(Number(levels) || 2));
    const scaled = (clampNumber(value, 0, 255) / 255) * (stepCount - 1);
    const lower = Math.floor(scaled);
    const quantizedIndex = Math.min(
      stepCount - 1,
      lower + ((scaled - lower) > clampNumber(threshold, 0, 1) ? 1 : 0)
    );
    return (quantizedIndex / (stepCount - 1)) * 255;
  }

  function quantizeDitherColor(color, threshold, levels, mix) {
    const source = color || {};
    const blend = clampNumber(mix, 0, 1);
    const quantize = (value) => {
      const channel = clampNumber(value, 0, 255);
      const quantized = quantizeDitherChannel(channel, threshold, levels);
      return Math.round(channel + ((quantized - channel) * blend));
    };
    return {
      red: quantize(source.red),
      green: quantize(source.green),
      blue: quantize(source.blue)
    };
  }

  function liftSampleColor(color, brightness, saturationBoost) {
    const source = color || {};
    const red = clampNumber(source.red, 0, 255) / 255;
    const green = clampNumber(source.green, 0, 255) / 255;
    const blue = clampNumber(source.blue, 0, 255) / 255;
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const delta = maxChannel - minChannel;
    let hue = 0;
    if (delta > 0) {
      if (maxChannel === red) {
        hue = ((green - blue) / delta) % 6;
      } else if (maxChannel === green) {
        hue = ((blue - red) / delta) + 2;
      } else {
        hue = ((red - green) / delta) + 4;
      }
      hue = ((hue * 60) + 360) % 360;
    }
    const saturation = maxChannel > 0 ? delta / maxChannel : 0;
    const liftedValue = maxChannel + (
      (1 - maxChannel) * clampNumber(brightness, 0, 1)
    );
    const liftedSaturation = clampNumber(
      saturation * (1 + clampNumber(saturationBoost, 0, 1.2)),
      0,
      1
    );
    const chroma = liftedValue * liftedSaturation;
    const hueSector = hue / 60;
    const secondChannel = chroma * (1 - Math.abs((hueSector % 2) - 1));
    let redPrime = 0;
    let greenPrime = 0;
    let bluePrime = 0;
    if (hueSector < 1) {
      redPrime = chroma;
      greenPrime = secondChannel;
    } else if (hueSector < 2) {
      redPrime = secondChannel;
      greenPrime = chroma;
    } else if (hueSector < 3) {
      greenPrime = chroma;
      bluePrime = secondChannel;
    } else if (hueSector < 4) {
      greenPrime = secondChannel;
      bluePrime = chroma;
    } else if (hueSector < 5) {
      redPrime = secondChannel;
      bluePrime = chroma;
    } else {
      redPrime = chroma;
      bluePrime = secondChannel;
    }
    const match = liftedValue - chroma;
    return {
      red: Math.round(clampNumber((redPrime + match) * 255, 0, 255)),
      green: Math.round(clampNumber((greenPrime + match) * 255, 0, 255)),
      blue: Math.round(clampNumber((bluePrime + match) * 255, 0, 255))
    };
  }

  function getEffectCanvasScale(devicePixelRatio, viewportWidth, viewportHeight) {
    const width = Math.max(1, Number(viewportWidth) || 1);
    const height = Math.max(1, Number(viewportHeight) || 1);
    const pixelBudgetScale = Math.sqrt(TARGET_EFFECT_CANVAS_PIXELS / (width * height));
    return clampNumber(
      Math.min(Number(devicePixelRatio) || 1, pixelBudgetScale, MAX_EFFECT_CANVAS_SCALE),
      1,
      MAX_EFFECT_CANVAS_SCALE
    );
  }

  function analyzeImageData(data) {
    if (!data || typeof data.length !== 'number' || data.length < 4) {
      return {
        averageLuminance: 0.5,
        lowLuminance: 0.1,
        highLuminance: 0.9,
        useDarkInk: false
      };
    }
    const pixelCount = Math.floor(data.length / 4);
    const sampleStride = Math.max(1, Math.floor(pixelCount / 12000));
    let luminanceTotal = 0;
    let sampledPixels = 0;
    const luminanceSamples = [];
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += sampleStride) {
      const index = pixelIndex * 4;
      const alpha = clampNumber(Number(data[index + 3]) / 255, 0, 1);
      const red = (Number(data[index]) * alpha) + (255 * (1 - alpha));
      const green = (Number(data[index + 1]) * alpha) + (255 * (1 - alpha));
      const blue = (Number(data[index + 2]) * alpha) + (255 * (1 - alpha));
      const luminance = ((red * 0.299) + (green * 0.587) + (blue * 0.114)) / 255;
      luminanceTotal += luminance;
      luminanceSamples.push(luminance);
      sampledPixels += 1;
    }
    const averageLuminance = sampledPixels > 0
      ? clampNumber(luminanceTotal / sampledPixels, 0, 1)
      : 0.5;
    luminanceSamples.sort((first, second) => first - second);
    const lastSampleIndex = Math.max(0, luminanceSamples.length - 1);
    const lowLuminance = luminanceSamples.length > 0
      ? luminanceSamples[Math.round(lastSampleIndex * 0.08)]
      : 0.1;
    const highLuminance = luminanceSamples.length > 0
      ? luminanceSamples[Math.round(lastSampleIndex * 0.92)]
      : 0.9;
    return {
      averageLuminance,
      lowLuminance: clampNumber(lowLuminance, 0, 1),
      highLuminance: clampNumber(highLuminance, 0, 1),
      useDarkInk: averageLuminance >= ASCII_LIGHT_WALLPAPER_THRESHOLD
    };
  }

  function normalizePrefs(value, inheritedVersion) {
    const source = migratePrefsToLatest(value, inheritedVersion);
    const type = EFFECT_TYPES.indexOf(source.type) === -1 ? DEFAULT_PREFS.type : source.type;
    const inkTone = EFFECT_INK_TONES.indexOf(source.inkTone) === -1
      ? DEFAULT_PREFS.inkTone
      : source.inkTone;
    const rawStrength = Number.isFinite(Number(source.strength))
      ? source.strength
      : DEFAULT_PREFS.strength;
    const rawSize = Number.isFinite(Number(source.size))
      ? source.size
      : (Number.isFinite(Number(source.density)) ? source.density : DEFAULT_PREFS.size);
    const rawSpacing = Number.isFinite(Number(source.spacing))
      ? source.spacing
      : DEFAULT_PREFS.spacing;
    const rawTexture = Number.isFinite(Number(source.texture))
      ? source.texture
      : DEFAULT_PREFS.texture;
    const rawBlockSize = Number.isFinite(Number(source.blockSize))
      ? source.blockSize
      : DEFAULT_PREFS.blockSize;
    const rawCrtStrength = Number.isFinite(Number(source.crtStrength))
      ? source.crtStrength
      : DEFAULT_PREFS.crtStrength;
    const rawCrtBloom = Number.isFinite(Number(source.crtBloom))
      ? source.crtBloom
      : DEFAULT_PREFS.crtBloom;
    const rawCrtRgbOffset = Number.isFinite(Number(source.crtRgbOffset))
      ? source.crtRgbOffset
      : DEFAULT_PREFS.crtRgbOffset;
    const rawCrtCurvature = Number.isFinite(Number(source.crtCurvature))
      ? source.crtCurvature
      : DEFAULT_PREFS.crtCurvature;
    return {
      version: DEFAULT_PREFS.version,
      type,
      inkTone,
      strength: Math.round(clampNumber(rawStrength, 0, 100)),
      size: Math.round(clampNumber(rawSize, 0, 100)),
      spacing: Math.round(clampNumber(rawSpacing, 0, 100)),
      texture: Math.round(clampNumber(rawTexture, 0, 100)),
      blockSize: normalizeBlockParameter(rawBlockSize, DEFAULT_PREFS.blockSize),
      crtStrength: clampCrtPhysicalValue(rawCrtStrength, 0, 20),
      crtBloom: clampCrtPhysicalValue(rawCrtBloom, 0, 20),
      crtRgbOffset: Math.round(clampNumber(rawCrtRgbOffset, 0, 100)),
      crtCurvature: clampCrtPhysicalValue(rawCrtCurvature, 0, 35)
    };
  }

  function normalizeStoragePrefs(value) {
    const source = value && typeof value === 'object' ? value : {};
    const hasModePrefs = Boolean(
      (source.light && typeof source.light === 'object') ||
      (source.dark && typeof source.dark === 'object')
    );
    const normalizeMode = (modeValue) => normalizePrefs(modeValue, source.version);
    const shared = normalizeMode(source);
    const lightSource = hasModePrefs ? (source.light || source.dark) : shared;
    const darkSource = hasModePrefs ? (source.dark || source.light) : shared;
    return {
      version: DEFAULT_PREFS.version,
      light: normalizeMode(lightSource),
      dark: normalizeMode(darkSource)
    };
  }

  function getBlurRadius(strength) {
    const ratio = clampNumber(strength, 0, 100) / 100;
    return Math.round((MIN_BLUR_RADIUS_PX +
      ((MAX_BLUR_RADIUS_PX - MIN_BLUR_RADIUS_PX) * ratio)) * 10) / 10;
  }

  function getStandardFrostParams(texture) {
    const inputRatio = clampNumber(texture, 0, 100) / 100;
    const ratio = Math.pow(inputRatio, 0.65);
    return {
      ratio,
      materialOpacity: ratio * 0.18,
      grainSize: Math.round(96 - (32 * ratio)),
      coarseGrainSize: Math.round(420 - (100 * ratio)),
      saturation: Math.round(100 + (10 * ratio)),
      brightness: Math.round(100 + (6 * ratio)),
      contrast: Math.round(100 - (16 * ratio))
    };
  }

  function resolveUseDarkInk(inkTone, sampler) {
    if (inkTone === 'dark') {
      return true;
    }
    if (inkTone === 'light') {
      return false;
    }
    return Boolean(sampler && sampler.useDarkInk === true);
  }

  function createWallpaperEffects(options) {
    const documentObj = getOption(options, 'documentObj', root.document);
    const windowObj = getOption(options, 'windowObj', root.window);
    const getCurrentWallpaper = getFunction(options, 'getCurrentWallpaper', function() {
      return null;
    });
    const getWallpaperImageUrl = getFunction(options, 'getWallpaperImageUrl', function() {
      return '';
    });
    const shouldAnimateTransition = getFunction(options, 'shouldAnimateTransition', function() {
      return true;
    });
    const onRender = getFunction(options, 'onRender');
    const EFFECT_CROSSFADE_MS = 150;
    const RESIZE_RENDER_SETTLE_MS = 140;
    const RESIZE_CROSSFADE_MS = 180;
    const ASCII_CHARS = '  .,:;-=+xX08S#&@';

    let canvas = null;
    let context = null;
    let prefs = Object.assign({}, DEFAULT_PREFS);
    let renderFrame = 0;
    let renderTimer = 0;
    let renderToken = 0;
    let loadedImage = null;
    let loadedImageUrl = '';
    let loadedSampler = null;
    let loadedSamplerUrl = '';
    let observer = null;
    let asciiGlyphMetricsCache = null;
    let effectBaseCacheKey = '';
    let crtWebglRenderer = null;
    let hasTriedCrtWebglRenderer = false;
    const materialNoiseTiles = { coarse: null, fine: null };
    const standardNoiseDataUrls = { coarse: null, fine: null };
    let resizeTransitionCanvas = null;
    let resizeTransitionFrame = 0;
    let resizeTransitionTimer = 0;
    let shouldCrossfadeResize = false;
    let renderRequestRevision = 0;
    let renderCompletedRevision = 0;
    let destroyed = false;
    const renderWaiters = [];

    function requestFrame(callback) {
      if (windowObj && typeof windowObj.requestAnimationFrame === 'function') {
        return windowObj.requestAnimationFrame(callback);
      }
      return setTimeout(callback, 16);
    }

    function cancelFrame(id) {
      if (windowObj && typeof windowObj.cancelAnimationFrame === 'function') {
        windowObj.cancelAnimationFrame(id);
        return;
      }
      clearTimeout(id);
    }

    function shouldReduceMotion() {
      return Boolean(windowObj &&
        typeof windowObj.matchMedia === 'function' &&
        windowObj.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function canAnimateTransition() {
      return shouldAnimateTransition() && !shouldReduceMotion();
    }

    function getViewportSize() {
      const docEl = documentObj.documentElement;
      return {
        width: Math.max(1, windowObj.innerWidth || (docEl ? docEl.clientWidth : 0) || 1),
        height: Math.max(1, windowObj.innerHeight || (docEl ? docEl.clientHeight : 0) || 1)
      };
    }

    function getDeviceScale(viewport) {
      return getEffectCanvasScale(
        windowObj.devicePixelRatio || 1,
        viewport.width,
        viewport.height
      );
    }

    function getLuminanceFromRgb(red, green, blue) {
      return ((red * 0.299) + (green * 0.587) + (blue * 0.114)) / 255;
    }

    function isWallpaperActive() {
      return Boolean(documentObj.body &&
        documentObj.body.getAttribute('data-wallpaper-active') === 'true' &&
        getCurrentWallpaper());
    }

    function updateWallpaperEffectProperties(nextPrefs) {
      const body = documentObj && documentObj.body;
      if (!body || !body.style || typeof body.style.setProperty !== 'function') {
        return;
      }
      body.style.setProperty(
        '--x-nt-wallpaper-blur-radius',
        `${getBlurRadius(nextPrefs.strength)}px`
      );
      const frost = nextPrefs.type === 'blur'
        ? getStandardFrostParams(nextPrefs.texture)
        : getStandardFrostParams(0);
      body.style.setProperty('--x-nt-wallpaper-blur-saturate', `${frost.saturation}%`);
      body.style.setProperty('--x-nt-wallpaper-blur-brightness', `${frost.brightness}%`);
      body.style.setProperty('--x-nt-wallpaper-blur-contrast', `${frost.contrast}%`);
    }

    function ensureCanvas() {
      if (canvas && context) {
        return canvas;
      }
      if (!documentObj || !documentObj.createElement || !documentObj.body) {
        return null;
      }
      canvas = documentObj.createElement('canvas');
      canvas.className = 'x-nt-wallpaper-effect-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      context = canvas.getContext('2d', { alpha: true });
      if (!context) {
        canvas = null;
        return null;
      }
      documentObj.body.insertBefore(canvas, documentObj.body.firstChild || null);
      bindObservers();
      return canvas;
    }

    function bindObservers() {
      if (observer || !root.MutationObserver || !documentObj.body) {
        return;
      }
      observer = new root.MutationObserver((mutations) => {
        const shouldRefresh = mutations.some((mutation) => {
          return mutation.type === 'attributes' &&
            mutation.attributeName === 'data-wallpaper-active';
        });
        if (shouldRefresh) {
          scheduleRender();
        }
      });
      observer.observe(documentObj.body, {
        attributes: true,
        attributeFilter: ['data-wallpaper-active']
      });
    }

    function clearEffectBaseCache() {
      effectBaseCacheKey = '';
    }

    function cleanupResizeCrossfade() {
      if (resizeTransitionFrame) {
        cancelFrame(resizeTransitionFrame);
        resizeTransitionFrame = 0;
      }
      if (resizeTransitionTimer) {
        clearTimeout(resizeTransitionTimer);
        resizeTransitionTimer = 0;
      }
      if (resizeTransitionCanvas && resizeTransitionCanvas.parentNode) {
        resizeTransitionCanvas.parentNode.removeChild(resizeTransitionCanvas);
      }
      resizeTransitionCanvas = null;
      if (canvas) {
        canvas.removeAttribute('data-resize-enter');
        canvas.removeAttribute('data-resize-jump');
      }
    }

    function prepareResizeCrossfade() {
      if (!canvas ||
          !context ||
          shouldReduceMotion() ||
          getCanvasOpacity() <= 0.01) {
        return false;
      }
      cleanupResizeCrossfade();
      const snapshot = documentObj.createElement('canvas');
      const snapshotContext = snapshot.getContext('2d', { alpha: true });
      if (!snapshotContext) {
        return false;
      }
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.className = `${canvas.className} x-nt-wallpaper-effect-resize-snapshot`;
      snapshot.setAttribute('aria-hidden', 'true');
      const effectType = canvas.getAttribute('data-effect');
      if (effectType) {
        snapshot.setAttribute('data-effect', effectType);
      }
      snapshot.style.width = '100vw';
      snapshot.style.height = '100vh';
      snapshot.style.opacity = String(getCanvasOpacity());
      snapshot.style.mixBlendMode = canvas.style.mixBlendMode || 'normal';
      snapshot.style.backgroundImage = canvas.style.backgroundImage || 'none';
      snapshot.style.backgroundRepeat = canvas.style.backgroundRepeat || 'no-repeat';
      snapshot.style.backgroundSize = canvas.style.backgroundSize || 'auto';
      snapshot.style.backgroundPosition = canvas.style.backgroundPosition || '0 0';
      try {
        snapshotContext.drawImage(canvas, 0, 0);
      } catch (error) {
        return false;
      }
      if (!canvas.parentNode) {
        return false;
      }
      canvas.parentNode.insertBefore(snapshot, canvas);
      resizeTransitionCanvas = snapshot;
      canvas.setAttribute('data-resize-enter', 'true');
      canvas.setAttribute('data-resize-jump', 'true');
      void canvas.offsetWidth;
      canvas.removeAttribute('data-resize-jump');
      return true;
    }

    function finishResizeCrossfade() {
      if (!canvas || !resizeTransitionCanvas) {
        return;
      }
      const snapshot = resizeTransitionCanvas;
      resizeTransitionFrame = requestFrame(() => {
        resizeTransitionFrame = 0;
        if (!canvas || resizeTransitionCanvas !== snapshot) {
          return;
        }
        canvas.removeAttribute('data-resize-enter');
        snapshot.setAttribute('data-resize-exit', 'true');
        resizeTransitionTimer = setTimeout(() => {
          resizeTransitionTimer = 0;
          if (resizeTransitionCanvas === snapshot) {
            cleanupResizeCrossfade();
          }
        }, RESIZE_CROSSFADE_MS + 80);
      });
    }

    function resizeCanvas() {
      if (!canvas || !context) {
        return null;
      }
      canvas.style.backgroundImage = 'none';
      canvas.style.backgroundRepeat = 'no-repeat';
      canvas.style.backgroundSize = 'auto';
      const viewport = getViewportSize();
      const scale = getDeviceScale(viewport);
      const width = Math.max(1, Math.round(viewport.width * scale));
      const height = Math.max(1, Math.round(viewport.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        effectBaseCacheKey = '';
      }
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      return viewport;
    }

    function clearCanvas() {
      renderToken += 1;
      shouldCrossfadeResize = false;
      cleanupResizeCrossfade();
      if (renderFrame) {
        cancelFrame(renderFrame);
        renderFrame = 0;
      }
      if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = 0;
      }
      clearEffectBaseCache();
      if (canvas && context) {
        const viewport = getViewportSize();
        context.clearRect(0, 0, viewport.width, viewport.height);
        canvas.removeAttribute('data-effect');
        canvas.style.opacity = '0';
        canvas.style.mixBlendMode = 'normal';
        canvas.style.backgroundImage = 'none';
        canvas.style.backgroundRepeat = 'no-repeat';
        canvas.style.backgroundSize = 'auto';
      }
      onRender();
    }

    function waitForRenderRevision(revision) {
      if (renderCompletedRevision >= revision) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        renderWaiters.push({ revision, resolve });
      });
    }

    function completeRender(revision) {
      renderCompletedRevision = Math.max(renderCompletedRevision, revision);
      for (let index = renderWaiters.length - 1; index >= 0; index -= 1) {
        const waiter = renderWaiters[index];
        if (waiter.revision > renderCompletedRevision) {
          continue;
        }
        renderWaiters.splice(index, 1);
        waiter.resolve();
      }
    }

    function loadImage(url, token) {
      if (!url) {
        return Promise.resolve(null);
      }
      if (loadedImage && loadedImageUrl === url) {
        return Promise.resolve(loadedImage);
      }
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
          if (token !== renderToken) {
            resolve(null);
            return;
          }
          const resolveLoadedImage = () => {
            loadedImage = image;
            loadedImageUrl = url;
            loadedSampler = null;
            loadedSamplerUrl = '';
            resolve(image);
          };
          if (typeof image.decode === 'function') {
            image.decode().then(resolveLoadedImage).catch(resolveLoadedImage);
            return;
          }
          resolveLoadedImage();
        };
        image.onerror = () => {
          reject(new Error('Failed to load wallpaper effect source.'));
        };
        image.src = url;
      });
    }

    function createSampler(image) {
      if (!image) {
        return null;
      }
      const naturalWidth = Math.max(1, image.naturalWidth || image.width || 1);
      const naturalHeight = Math.max(1, image.naturalHeight || image.height || 1);
      const sampleScale = Math.min(1, 520 / naturalWidth, 320 / naturalHeight);
      const sourceCanvas = documentObj.createElement('canvas');
      sourceCanvas.width = Math.max(1, Math.round(naturalWidth * sampleScale));
      sourceCanvas.height = Math.max(1, Math.round(naturalHeight * sampleScale));
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) {
        return null;
      }
      sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
      let data = null;
      try {
        data = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
      } catch (e) {
        return null;
      }
      const analysis = analyzeImageData(data);
      return {
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        naturalWidth,
        naturalHeight,
        scaleX: sourceCanvas.width / naturalWidth,
        scaleY: sourceCanvas.height / naturalHeight,
        averageLuminance: analysis.averageLuminance,
        lowLuminance: analysis.lowLuminance,
        highLuminance: analysis.highLuminance,
        useDarkInk: analysis.useDarkInk,
        data
      };
    }

    function getSampler(image, imageUrl) {
      if (loadedSampler && loadedSamplerUrl === imageUrl) {
        return loadedSampler;
      }
      clearEffectBaseCache();
      loadedSampler = createSampler(image);
      loadedSamplerUrl = loadedSampler ? imageUrl : '';
      return loadedSampler;
    }

    function getRenderedMetrics(sampler, viewport) {
      const scale = Math.max(
        viewport.width / sampler.naturalWidth,
        viewport.height / sampler.naturalHeight
      );
      const renderedWidth = sampler.naturalWidth * scale;
      const renderedHeight = sampler.naturalHeight * scale;
      return {
        scale,
        offsetX: (viewport.width - renderedWidth) / 2,
        offsetY: (viewport.height - renderedHeight) / 2,
        renderedWidth,
        renderedHeight
      };
    }

    function sampleColor(sampler, metrics, viewportX, viewportY) {
      const sourceX = ((viewportX - metrics.offsetX) / metrics.scale) * sampler.scaleX;
      const sourceY = ((viewportY - metrics.offsetY) / metrics.scale) * sampler.scaleY;
      const x = Math.round(clampNumber(sourceX, 0, sampler.width - 1));
      const y = Math.round(clampNumber(sourceY, 0, sampler.height - 1));
      const index = (y * sampler.width + x) * 4;
      const red = sampler.data[index] || 0;
      const green = sampler.data[index + 1] || 0;
      const blue = sampler.data[index + 2] || 0;
      const alpha = (sampler.data[index + 3] || 255) / 255;
      return {
        red: Math.round((red * alpha) + (255 * (1 - alpha))),
        green: Math.round((green * alpha) + (255 * (1 - alpha))),
        blue: Math.round((blue * alpha) + (255 * (1 - alpha)))
      };
    }

    function getLuminance(color) {
      return getLuminanceFromRgb(color.red, color.green, color.blue);
    }

    function clampChannel(value) {
      return Math.round(clampNumber(value, 0, 255));
    }

    function boostSampleColor(color, amount) {
      const boost = 1 + clampNumber(amount, 0, 1.2);
      const luma = ((color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114));
      return {
        red: clampChannel(luma + ((color.red - luma) * boost)),
        green: clampChannel(luma + ((color.green - luma) * boost)),
        blue: clampChannel(luma + ((color.blue - luma) * boost))
      };
    }

    function getEffectAlpha(base, strength) {
      return clampNumber((strength / 100) * base, 0, 1);
    }

    function smoothstep(value) {
      const x = clampNumber(value, 0, 1);
      return x * x * (3 - (2 * x));
    }

    function applyToneCurve(tone, strength) {
      const amount = clampNumber(strength, 0, 100) / 100;
      const blackPoint = amount * 0.22;
      const whitePoint = 1 - (amount * 0.08);
      const leveled = clampNumber((tone - blackPoint) / Math.max(0.01, whitePoint - blackPoint), 0, 1);
      const curved = smoothstep(leveled);
      return (leveled * (1 - amount)) + (curved * amount);
    }

    function getLayerEffectTone(luminance, sampler, strength, useDarkInk) {
      const useLightInk = useDarkInk !== true;
      const rawTone = useLightInk ? luminance : (1 - luminance);
      const low = clampNumber(sampler.lowLuminance, 0, 1);
      const high = clampNumber(sampler.highLuminance, 0, 1);
      const range = high - low;
      if (range < 0.025) {
        return applyToneCurve(rawTone, strength);
      }
      const normalizedTone = useLightInk
        ? clampNumber((luminance - low) / range, 0, 1)
        : clampNumber((high - luminance) / range, 0, 1);
      const contrastMix = 0.72 + ((clampNumber(strength, 0, 100) / 100) * 0.14);
      return applyToneCurve(
        (rawTone * (1 - contrastMix)) + (normalizedTone * contrastMix),
        strength
      );
    }

    function getControlRange(value, minValue, maxValue) {
      const ratio = clampNumber(value, 0, 100) / 100;
      return minValue + ((maxValue - minValue) * ratio);
    }

    function getAsciiGlyphMetrics(fontSize, font, targetContext) {
      if (asciiGlyphMetricsCache &&
          asciiGlyphMetricsCache.fontSize === fontSize &&
          asciiGlyphMetricsCache.font === font) {
        return asciiGlyphMetricsCache;
      }
      const glyphWidth = ASCII_CHARS.split('').reduce((maxWidth, char) => {
        if (char === ' ') {
          return maxWidth;
        }
        const metrics = targetContext.measureText(char);
        return Math.max(maxWidth, metrics.width || 0);
      }, fontSize * 0.62);
      const glyphMetrics = targetContext.measureText('@');
      const glyphHeight = (glyphMetrics.actualBoundingBoxAscent || 0) +
        (glyphMetrics.actualBoundingBoxDescent || 0);
      asciiGlyphMetricsCache = {
        fontSize,
        font,
        glyphWidth,
        glyphHeight
      };
      return asciiGlyphMetricsCache;
    }

    function getOverlayBlendLuminance(baseLuminance, effectLuminance) {
      const base = clampNumber(baseLuminance, 0, 1);
      const source = clampNumber(effectLuminance, 0, 1);
      if (base <= 0.5) {
        return 2 * base * source;
      }
      return 1 - (2 * (1 - base) * (1 - source));
    }

    function setCanvasVisuals(type, opacity, blendMode) {
      if (!canvas) {
        return;
      }
      canvas.setAttribute('data-effect', type);
      canvas.style.opacity = String(clampNumber(opacity, 0, 1));
      canvas.style.mixBlendMode = blendMode || 'normal';
      onRender();
      finishResizeCrossfade();
    }

    function getCanvasOpacity() {
      if (!canvas) {
        return 0;
      }
      const opacity = Number.parseFloat(canvas.style.opacity || '1');
      return clampNumber(Number.isFinite(opacity) ? opacity : 1, 0, 1);
    }

    function resolveMaterialBlendMode(luminance) {
      if (luminance <= 0.42) {
        return 'screen';
      }
      if (luminance >= 0.68) {
        return 'multiply';
      }
      return 'soft-light';
    }

    function getLuminanceAtViewport(viewportX, viewportY, baseLuminance) {
      const normalized = normalizePrefs(prefs);
      if (!canvas ||
          !context ||
          !isWallpaperActive() ||
          normalized.type === 'none' ||
          canvas.style.opacity === '0') {
        return null;
      }
      if (normalized.type === 'blur') {
        return Number.isFinite(baseLuminance) ? baseLuminance : null;
      }
      const viewport = getViewportSize();
      const x = Math.round(clampNumber(viewportX, 0, viewport.width) * (canvas.width / viewport.width));
      const y = Math.round(clampNumber(viewportY, 0, viewport.height) * (canvas.height / viewport.height));
      let pixel = null;
      try {
        pixel = context.getImageData(
          clampNumber(x, 0, canvas.width - 1),
          clampNumber(y, 0, canvas.height - 1),
          1,
          1
        ).data;
      } catch (e) {
        return null;
      }
      const canvasAlpha = (pixel[3] / 255) * getCanvasOpacity();
      const effectLuminance = getLuminanceFromRgb(pixel[0], pixel[1], pixel[2]);
      if (normalized.type === 'grain') {
        if (!Number.isFinite(baseLuminance)) {
          return null;
        }
        const blended = getOverlayBlendLuminance(baseLuminance, effectLuminance);
        return (baseLuminance * (1 - canvasAlpha)) + (blended * canvasAlpha);
      }
      if (!Number.isFinite(baseLuminance)) {
        return null;
      }
      return (baseLuminance * (1 - canvasAlpha)) + (effectLuminance * canvasAlpha);
    }

    function drawGrain(viewport, strength) {
      context.clearRect(0, 0, viewport.width, viewport.height);
      const tile = documentObj.createElement('canvas');
      tile.width = 180;
      tile.height = 180;
      const tileContext = tile.getContext('2d');
      if (!tileContext) {
        return;
      }
      const imageData = tileContext.createImageData(tile.width, tile.height);
      for (let index = 0; index < imageData.data.length; index += 4) {
        const value = Math.floor(Math.random() * 255);
        imageData.data[index] = value;
        imageData.data[index + 1] = value;
        imageData.data[index + 2] = value;
        imageData.data[index + 3] = 255;
      }
      tileContext.putImageData(imageData, 0, 0);
      const pattern = context.createPattern(tile, 'repeat');
      if (!pattern) {
        return;
      }
      context.fillStyle = pattern;
      context.fillRect(0, 0, viewport.width, viewport.height);
      setCanvasVisuals('grain', 0.08 + getEffectAlpha(0.22, strength), 'overlay');
    }

    function quantizeBlockColor(color, texture) {
      const levels = 4 + Math.round((clampNumber(texture, 0, 100) / 100) * 20);
      const quantize = (value) => Math.round(
        (Math.round((clampNumber(value, 0, 255) / 255) * (levels - 1)) / (levels - 1)) * 255
      );
      return {
        red: quantize(color.red),
        green: quantize(color.green),
        blue: quantize(color.blue)
      };
    }

    function shadeBlockColor(color, amount) {
      const ratio = clampNumber(amount, -1, 1);
      const target = ratio >= 0 ? 255 : 0;
      const mix = Math.abs(ratio);
      return {
        red: Math.round(color.red + ((target - color.red) * mix)),
        green: Math.round(color.green + ((target - color.green) * mix)),
        blue: Math.round(color.blue + ((target - color.blue) * mix))
      };
    }

    function getBlockColorCss(color, alpha) {
      if (Number.isFinite(alpha)) {
        return `rgb(${color.red} ${color.green} ${color.blue} / ${clampNumber(alpha, 0, 1)})`;
      }
      return `rgb(${color.red} ${color.green} ${color.blue})`;
    }

    function fillBlockPolygon(targetContext, points, color) {
      if (!points.length) {
        return;
      }
      targetContext.beginPath();
      targetContext.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        targetContext.lineTo(points[index].x, points[index].y);
      }
      targetContext.closePath();
      targetContext.fillStyle = color;
      targetContext.fill();
    }

    function fillBlockCircle(targetContext, x, y, radius, color) {
      targetContext.beginPath();
      targetContext.arc(x, y, radius, 0, Math.PI * 2);
      targetContext.closePath();
      targetContext.fillStyle = color;
      targetContext.fill();
    }

    function getBlockMaterialHash(column, row) {
      return Math.abs(Math.imul(column + 17, 374761393) ^ Math.imul(row + 29, 668265263));
    }

    function getBlockMaterialVariation(column, row) {
      return ((getBlockMaterialHash(column, row) % 17) - 8) / 400;
    }

    function mixBlockColors(first, second, ratio) {
      const mix = clampNumber(ratio, 0, 1);
      const target = second || first;
      return {
        red: Math.round(first.red + ((target.red - first.red) * mix)),
        green: Math.round(first.green + ((target.green - first.green) * mix)),
        blue: Math.round(first.blue + ((target.blue - first.blue) * mix))
      };
    }

    function drawCompactBlockGrid(viewport, sampler, metrics, cellSize, texture) {
      const edge = 1;
      for (let y = -cellSize; y < viewport.height + cellSize; y += cellSize) {
        for (let x = -cellSize; x < viewport.width + cellSize; x += cellSize) {
          const column = Math.round(x / cellSize);
          const row = Math.round(y / cellSize);
          const sampled = sampleColor(
            sampler,
            metrics,
            x + (cellSize / 2),
            y + (cellSize / 2)
          );
          const faceColor = shadeBlockColor(
            quantizeBlockColor(sampled, texture),
            0.065 + getBlockMaterialVariation(column, row)
          );
          context.fillStyle = getBlockColorCss(faceColor);
          context.fillRect(x, y, cellSize, cellSize);
          context.fillStyle = getBlockColorCss(shadeBlockColor(faceColor, -0.18), 0.42);
          context.fillRect(x + cellSize - edge, y, edge, cellSize);
          context.fillRect(x, y + cellSize - edge, cellSize, edge);
        }
      }
    }

    function drawBlocks(viewport, sampler, strength, size, spacing, texture) {
      const sizeRatio = clampNumber(size, 0, 5) / 5;
      const cellSize = Math.round((viewport.width < 720 ? 10 : 13) +
        (Math.pow(sizeRatio, 0.82) * (viewport.width < 720 ? 30 : 43)));
      const gap = Math.min(cellSize - 2, (clampNumber(spacing, 0, 5) / 5) * cellSize * 0.3);
      const strengthRatio = clampNumber(strength, 0, 100) / 100;
      const metrics = getRenderedMetrics(sampler, viewport);
      const cacheKey = [
        getEffectBaseKey('blocks', viewport, sampler, 'auto', strength, size, spacing),
        texture
      ].join(':');
      if (effectBaseCacheKey !== cacheKey) {
        context.clearRect(0, 0, viewport.width, viewport.height);
        if (cellSize < 16) {
          drawCompactBlockGrid(viewport, sampler, metrics, cellSize, texture);
          effectBaseCacheKey = cacheKey;
          setCanvasVisuals('blocks', 1, 'normal');
          return;
        }
        const startX = -cellSize;
        const startY = -cellSize;
        const columnCount = Math.ceil((viewport.width + (cellSize * 2)) / cellSize);
        const rowCount = Math.ceil((viewport.height + (cellSize * 2)) / cellSize);
        const cells = Array.from({ length: rowCount }, (_, row) =>
          Array.from({ length: columnCount }, (_, column) => {
            const x = startX + (column * cellSize);
            const y = startY + (row * cellSize);
            const centerX = x + (cellSize / 2);
            const centerY = y + (cellSize / 2);
            return { color: sampleColor(sampler, metrics, centerX, centerY) };
          })
        );
        const occupied = Array.from({ length: rowCount }, () => Array(columnCount).fill(false));
        const canOccupy = (row, column, rowSpan, columnSpan) => {
          if (row + rowSpan > rowCount || column + columnSpan > columnCount) {
            return false;
          }
          for (let offsetRow = 0; offsetRow < rowSpan; offsetRow += 1) {
            for (let offsetColumn = 0; offsetColumn < columnSpan; offsetColumn += 1) {
              if (occupied[row + offsetRow][column + offsetColumn]) {
                return false;
              }
            }
          }
          return true;
        };
        const getCombinedSample = (row, column, rowSpan, columnSpan) => {
          let count = 0;
          let red = 0;
          let green = 0;
          let blue = 0;
          for (let offsetRow = 0; offsetRow < rowSpan; offsetRow += 1) {
            for (let offsetColumn = 0; offsetColumn < columnSpan; offsetColumn += 1) {
              const sampleRow = cells[row + offsetRow];
              if (sampleRow && sampleRow[column + offsetColumn]) {
                const sample = sampleRow[column + offsetColumn];
                red += sample.color.red;
                green += sample.color.green;
                blue += sample.color.blue;
                count += 1;
              }
            }
          }
          if (!count) {
            return null;
          }
          return {
            color: {
              red: red / count,
              green: green / count,
              blue: blue / count
            }
          };
        };
        const tiles = [];
        for (let row = 0; row < rowCount; row += 1) {
          for (let column = 0; column < columnCount; column += 1) {
            if (occupied[row][column]) {
              continue;
            }
            const hash = getBlockMaterialHash(column, row);
            let rowSpan = 1;
            let columnSpan = 1;
            if (hash % 37 === 0 && canOccupy(row, column, 2, 2)) {
              rowSpan = 2;
              columnSpan = 2;
            } else if (hash % 11 === 0) {
              const horizontal = hash % 2 === 0;
              const nextRowSpan = horizontal ? 1 : 2;
              const nextColumnSpan = horizontal ? 2 : 1;
              if (canOccupy(row, column, nextRowSpan, nextColumnSpan)) {
                rowSpan = nextRowSpan;
                columnSpan = nextColumnSpan;
              }
            }
            for (let offsetRow = 0; offsetRow < rowSpan; offsetRow += 1) {
              for (let offsetColumn = 0; offsetColumn < columnSpan; offsetColumn += 1) {
                occupied[row + offsetRow][column + offsetColumn] = true;
              }
            }
            tiles.push({
              row,
              column,
              rowSpan,
              columnSpan,
              hash,
              sample: getCombinedSample(row, column, rowSpan, columnSpan)
            });
          }
        }
        tiles.forEach((tile) => {
            const sample = tile.sample;
            if (!sample) {
              return;
            }
            const x = startX + (tile.column * cellSize);
            const y = startY + (tile.row * cellSize);
            const rightNeighbor = getCombinedSample(tile.row, tile.column + tile.columnSpan, tile.rowSpan, 1);
            const bottomNeighbor = getCombinedSample(tile.row + tile.rowSpan, tile.column, 1, tile.columnSpan);
            const color = quantizeBlockColor(sample.color, texture);
            const depth = strengthRatio * Math.min(11, cellSize * 0.22);
            const offsetX = depth * 0.52;
            const offsetY = depth * 0.78;
            const topX = x + (gap / 2);
            const topY = y + (gap / 2) - (depth * 0.34);
            const blockWidth = Math.max(2, (tile.columnSpan * cellSize) - gap);
            const blockHeight = Math.max(2, (tile.rowSpan * cellSize) - gap);
            const rightX = topX + blockWidth;
            const bottomY = topY + blockHeight;
            const bevel = Math.max(1, Math.min(3, Math.round(blockWidth * 0.08)));
            const faceColor = shadeBlockColor(
              color,
              0.065 + getBlockMaterialVariation(tile.column, tile.row)
            );
            const rightBounceColor = rightNeighbor
              ? quantizeBlockColor(rightNeighbor.color, texture)
              : color;
            const bottomBounceColor = bottomNeighbor
              ? quantizeBlockColor(bottomNeighbor.color, texture)
              : color;
            if (!rightNeighbor) {
              fillBlockPolygon(context, [
                { x: rightX, y: topY },
                { x: rightX + offsetX, y: topY + offsetY },
                { x: rightX + offsetX, y: bottomY + offsetY },
                { x: rightX, y: bottomY }
              ], getBlockColorCss(shadeBlockColor(color, -0.18)));
            }
            if (!bottomNeighbor) {
              fillBlockPolygon(context, [
                { x: topX, y: bottomY },
                { x: rightX, y: bottomY },
                { x: rightX + offsetX, y: bottomY + offsetY },
                { x: topX + offsetX, y: bottomY + offsetY }
              ], getBlockColorCss(shadeBlockColor(color, -0.28)));
            }
            context.fillStyle = getBlockColorCss(faceColor);
            context.fillRect(topX, topY, blockWidth, blockHeight);
            context.fillStyle = getBlockColorCss(shadeBlockColor(faceColor, 0.24), 0.34);
            context.fillRect(topX, topY, blockWidth, bevel);
            context.fillRect(topX, topY, bevel, blockHeight);
            context.fillStyle = getBlockColorCss(
              shadeBlockColor(mixBlockColors(faceColor, rightBounceColor, 0.07), -0.18),
              0.42
            );
            context.fillRect(rightX - bevel, topY + bevel, bevel, blockHeight - bevel);
            context.fillStyle = getBlockColorCss(
              shadeBlockColor(mixBlockColors(faceColor, bottomBounceColor, 0.06), -0.18),
              0.42
            );
            context.fillRect(topX + bevel, bottomY - bevel, blockWidth - bevel, bevel);
            context.fillStyle = getBlockColorCss(shadeBlockColor(faceColor, 0.48), 0.34);
            context.fillRect(
              topX + bevel,
              topY + bevel,
              Math.max(2, blockWidth * 0.24),
              1
            );
            if (tile.hash % 7 === 0) {
              const wearLength = Math.max(2, Math.min(5, Math.round(cellSize * 0.13)));
              const wearOffsetX = bevel +
                (tile.hash % Math.max(2, Math.floor(blockWidth - wearLength - bevel)));
              const wearOffsetY = bevel +
                (tile.hash % Math.max(2, Math.floor(blockHeight - wearLength - bevel)));
              context.fillStyle = getBlockColorCss(shadeBlockColor(faceColor, 0.64), 0.38);
              context.fillRect(topX + wearOffsetX, topY, wearLength, 1);
              context.fillStyle = getBlockColorCss(shadeBlockColor(faceColor, -0.34), 0.24);
              context.fillRect(topX, topY + wearOffsetY, 1, Math.max(1, wearLength - 1));
            }
            if (cellSize - gap >= 12) {
              for (let studRow = 0; studRow < tile.rowSpan; studRow += 1) {
                for (let studColumn = 0; studColumn < tile.columnSpan; studColumn += 1) {
                  const studRadius = Math.max(2, (cellSize - gap) * 0.16);
                  const studX = topX + ((studColumn + 0.5) * cellSize);
                  const studY = topY + ((studRow + 0.5) * cellSize);
                  fillBlockCircle(
                    context,
                    studX + 0.7,
                    studY + 0.9,
                    studRadius,
                    getBlockColorCss(shadeBlockColor(faceColor, -0.22), 0.78)
                  );
                  fillBlockCircle(
                    context,
                    studX - 0.35,
                    studY - 0.45,
                    studRadius * 0.88,
                    getBlockColorCss(shadeBlockColor(faceColor, 0.12))
                  );
                  context.fillStyle = getBlockColorCss(shadeBlockColor(faceColor, 0.58), 0.52);
                  context.fillRect(studX - (studRadius * 0.45), studY - (studRadius * 0.55), 1, 1);
                }
              }
            }
        });
        effectBaseCacheKey = cacheKey;
      }
      setCanvasVisuals('blocks', 1, 'normal');
    }

    function getGridStart(step, minimum) {
      const first = step / 2;
      if (minimum <= first) {
        return first;
      }
      return first + (Math.floor((minimum - first) / step) * step);
    }

    function getEffectBaseKey(type, viewport, sampler, inkTone, strength, size, spacing) {
      return [
        type,
        loadedImageUrl,
        canvas ? canvas.width : 0,
        canvas ? canvas.height : 0,
        viewport.width,
        viewport.height,
        inkTone,
        resolveUseDarkInk(inkTone, sampler) ? 1 : 0,
        strength,
        size,
        spacing
      ].join(':');
    }

    function drawHalftoneLayer(targetContext, viewport, sampler, inkTone, strength, size, spacing) {
      const metrics = getRenderedMetrics(sampler, viewport);
      const step = getControlRange(
        spacing,
        viewport.width < 720 ? 9 : 10,
        viewport.width < 720 ? 23 : 26
      );
      const sizeRadius = getControlRange(
        size,
        viewport.width < 720 ? 1.4 : 1.6,
        viewport.width < 720 ? 13 : 15
      );
      const maxRadius = Math.min(sizeRadius, step * 0.78);
      const useDarkInk = resolveUseDarkInk(inkTone, sampler);
      const strengthRatio = clampNumber(strength, 0, 100) / 100;
      for (let y = getGridStart(step, 0); y <= viewport.height + step; y += step) {
        if (y < 0 || y > viewport.height + step) {
          continue;
        }
        for (let x = getGridStart(step, 0); x <= viewport.width + step; x += step) {
          if (x < 0 || x > viewport.width + step) {
            continue;
          }
          const color = sampleColor(sampler, metrics, x, y);
          const luminance = getLuminance(color);
          const tone = getLayerEffectTone(luminance, sampler, strength, useDarkInk);
          if (tone <= 0.01) {
            continue;
          }
          const radius = clampNumber(
            tone * maxRadius,
            0.7,
            maxRadius
          );
          const ink = liftSampleColor(
            color,
            0.18 + (strengthRatio * 0.18) + (tone * 0.2),
            0.12 + (strengthRatio * 0.16)
          );
          targetContext.globalAlpha = clampNumber(
            0.24 + (tone * 0.58),
            0.1,
            0.88
          );
          targetContext.fillStyle = `rgb(${ink.red} ${ink.green} ${ink.blue})`;
          targetContext.beginPath();
          targetContext.arc(x, y, radius, 0, Math.PI * 2);
          targetContext.fill();
        }
      }
      targetContext.globalAlpha = 1;
    }

    function drawAsciiLayer(targetContext, viewport, sampler, inkTone, strength, size, spacing) {
      const metrics = getRenderedMetrics(sampler, viewport);
      const useDarkInk = resolveUseDarkInk(inkTone, sampler);
      const strengthRatio = clampNumber(strength, 0, 100) / 100;
      const fontSize = Math.round(getControlRange(size, 7, viewport.width < 720 ? 22 : 24));
      targetContext.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      targetContext.textRendering = 'geometricPrecision';
      targetContext.fontKerning = 'none';
      targetContext.textBaseline = 'middle';
      targetContext.textAlign = 'center';
      const glyphMetrics = getAsciiGlyphMetrics(fontSize, targetContext.font, targetContext);
      const xStep = Math.max(
        getControlRange(spacing, viewport.width < 720 ? 7 : 8, viewport.width < 720 ? 22 : 24),
        glyphMetrics.glyphWidth * 1.08
      );
      const lineHeight = Math.max(
        getControlRange(spacing, 9, viewport.width < 720 ? 24 : 26),
        (glyphMetrics.glyphHeight || fontSize) * 1.12,
        fontSize * 1.04
      );
      for (let y = getGridStart(lineHeight, 0); y <= viewport.height + lineHeight; y += lineHeight) {
        if (y < 0 || y > viewport.height + lineHeight) {
          continue;
        }
        for (let x = getGridStart(xStep, 0); x <= viewport.width + xStep; x += xStep) {
          if (x < 0 || x > viewport.width + xStep) {
            continue;
          }
          const color = sampleColor(sampler, metrics, x, y);
          const luminance = getLuminance(color);
          const tone = getLayerEffectTone(luminance, sampler, strength, useDarkInk);
          if (tone <= 0.02) {
            continue;
          }
          const index = Math.round(tone * (ASCII_CHARS.length - 1));
          const char = ASCII_CHARS[clampNumber(index, 0, ASCII_CHARS.length - 1)];
          if (char === ' ') {
            continue;
          }
          const ink = liftSampleColor(
            color,
            0.24 + (strengthRatio * 0.18) + (tone * 0.24),
            0.16 + (strengthRatio * 0.2)
          );
          const alpha = (0.12 + (tone * 0.7)) *
            (0.72 + (strengthRatio * 0.28));
          targetContext.globalAlpha = clampNumber(alpha, 0.06, 0.94);
          targetContext.fillStyle = `rgb(${ink.red} ${ink.green} ${ink.blue})`;
          targetContext.fillText(char, x, y);
        }
      }
      targetContext.globalAlpha = 1;
    }

    function drawDitherLayer(targetContext, viewport, sampler, _inkTone, strength, size, spacing) {
      const metrics = getRenderedMetrics(sampler, viewport);
      const strengthRatio = clampNumber(strength, 0, 100) / 100;
      const pixelSize = Math.max(2, Math.round(getControlRange(
        size,
        2,
        viewport.width < 720 ? 7 : 9
      )));
      const patternScale = Math.max(1, Math.round(getControlRange(spacing, 1, 4)));
      const colorLevels = Math.max(2, Math.round(getControlRange(strength, 8, 2)));
      const colorMix = getControlRange(strength, 0.32, 1);
      const ditherCanvas = documentObj.createElement('canvas');
      ditherCanvas.width = Math.max(1, Math.ceil(viewport.width / pixelSize));
      ditherCanvas.height = Math.max(1, Math.ceil(viewport.height / pixelSize));
      const ditherContext = ditherCanvas.getContext('2d');
      if (!ditherContext) {
        return;
      }
      const imageData = ditherContext.createImageData(ditherCanvas.width, ditherCanvas.height);
      for (let y = 0; y < ditherCanvas.height; y += 1) {
        const matrixY = Math.floor(y / patternScale) % BAYER_4X4.length;
        for (let x = 0; x < ditherCanvas.width; x += 1) {
          const matrixX = Math.floor(x / patternScale) % BAYER_4X4[matrixY].length;
          const threshold = (BAYER_4X4[matrixY][matrixX] + 0.5) / 16;
          const viewportX = Math.min(viewport.width, (x + 0.5) * pixelSize);
          const viewportY = Math.min(viewport.height, (y + 0.5) * pixelSize);
          const color = boostSampleColor(
            sampleColor(sampler, metrics, viewportX, viewportY),
            0.06 + (strengthRatio * 0.18)
          );
          const dithered = quantizeDitherColor(color, threshold, colorLevels, colorMix);
          const index = ((y * ditherCanvas.width) + x) * 4;
          imageData.data[index] = dithered.red;
          imageData.data[index + 1] = dithered.green;
          imageData.data[index + 2] = dithered.blue;
          imageData.data[index + 3] = 255;
        }
      }
      ditherContext.putImageData(imageData, 0, 0);
      const previousSmoothing = targetContext.imageSmoothingEnabled;
      targetContext.imageSmoothingEnabled = false;
      targetContext.drawImage(
        ditherCanvas,
        0,
        0,
        ditherCanvas.width,
        ditherCanvas.height,
        0,
        0,
        viewport.width,
        viewport.height
      );
      targetContext.imageSmoothingEnabled = previousSmoothing;
    }

    function drawWallpaperCover(targetContext, viewport, sampler, offsetX) {
      if (!loadedImage || !sampler) {
        return;
      }
      const metrics = getRenderedMetrics(sampler, viewport);
      targetContext.drawImage(
        loadedImage,
        0,
        0,
        sampler.naturalWidth,
        sampler.naturalHeight,
        metrics.offsetX + (Number(offsetX) || 0),
        metrics.offsetY,
        metrics.renderedWidth,
        metrics.renderedHeight
      );
    }

    function drawCrtFallbackLayer(targetContext, viewport, sampler, _inkTone, strength, crtPrefs) {
      const details = crtPrefs || DEFAULT_PREFS;
      const strengthRatio = clampNumber(strength, 0, 20) / 20;
      const fringeOffset = getControlRange(details.crtRgbOffset, 0, 4.2);
      const bloomRatio = clampNumber(details.crtBloom, 0, 20) / 20;
      const curvatureRatio = clampNumber(details.crtCurvature, 0, 35) / 100;
      targetContext.clearRect(0, 0, viewport.width, viewport.height);

      targetContext.save();
      targetContext.filter = `saturate(${1.04 + (strengthRatio * 0.28)}) ` +
        `contrast(${1.02 + (strengthRatio * 0.16)}) brightness(${1.01 + (strengthRatio * 0.05)})`;
      drawWallpaperCover(targetContext, viewport, sampler, 0);
      targetContext.restore();

      targetContext.save();
      targetContext.globalCompositeOperation = 'screen';
      targetContext.globalAlpha = 0.018 + (strengthRatio * 0.045);
      targetContext.filter = 'sepia(1) saturate(7) hue-rotate(292deg)';
      drawWallpaperCover(targetContext, viewport, sampler, -fringeOffset);
      targetContext.filter = 'sepia(1) saturate(7) hue-rotate(142deg)';
      drawWallpaperCover(targetContext, viewport, sampler, fringeOffset);
      targetContext.restore();

      if (bloomRatio > 0) {
        targetContext.save();
        targetContext.globalCompositeOperation = 'screen';
        targetContext.globalAlpha = bloomRatio * 0.24;
        targetContext.filter = `blur(${1 + (details.crtBloom * 0.42)}px) saturate(1.08)`;
        drawWallpaperCover(targetContext, viewport, sampler, 0);
        targetContext.restore();
      }

      const phosphorWidth = 1;
      const scanlinePeriod = 2;
      const phosphorTile = documentObj.createElement('canvas');
      phosphorTile.width = phosphorWidth * 3;
      phosphorTile.height = scanlinePeriod;
      const phosphorContext = phosphorTile.getContext('2d');
      if (phosphorContext) {
        phosphorContext.fillStyle = 'rgb(255 38 48 / 82%)';
        phosphorContext.fillRect(0, 0, phosphorWidth, scanlinePeriod);
        phosphorContext.fillStyle = 'rgb(38 255 132 / 78%)';
        phosphorContext.fillRect(phosphorWidth, 0, phosphorWidth, scanlinePeriod);
        phosphorContext.fillStyle = 'rgb(38 94 255 / 86%)';
        phosphorContext.fillRect(phosphorWidth * 2, 0, phosphorWidth, scanlinePeriod);
        phosphorContext.fillStyle = 'rgb(255 255 255 / 12%)';
        phosphorContext.fillRect(0, 0, phosphorTile.width, 1);
        phosphorContext.fillStyle = 'rgb(0 0 0 / 82%)';
        phosphorContext.fillRect(
          0,
          Math.max(1, scanlinePeriod - 1),
          phosphorTile.width,
          1
        );
        const phosphorPattern = targetContext.createPattern(phosphorTile, 'repeat');
        if (phosphorPattern) {
          targetContext.save();
          targetContext.globalCompositeOperation = 'soft-light';
          targetContext.globalAlpha = 0.32 + (strengthRatio * 0.28);
          targetContext.fillStyle = phosphorPattern;
          targetContext.fillRect(0, 0, viewport.width, viewport.height);
          targetContext.restore();
        }
      }

      const centerX = viewport.width / 2;
      const centerY = viewport.height / 2;
      const vignette = targetContext.createRadialGradient(
        centerX,
        centerY,
        Math.min(viewport.width, viewport.height) * 0.18,
        centerX,
        centerY,
        Math.max(viewport.width, viewport.height) * 0.72
      );
      vignette.addColorStop(0, 'rgb(255 255 255 / 2%)');
      vignette.addColorStop(0.68, 'rgb(0 0 0 / 0%)');
      vignette.addColorStop(
        1,
        `rgb(0 0 0 / ${Math.round(18 + (strengthRatio * 20) + (curvatureRatio * 28))}%)`
      );
      targetContext.fillStyle = vignette;
      targetContext.fillRect(0, 0, viewport.width, viewport.height);
    }

    function getNoiseByte(x, y, seed) {
      let value = ((x * 374761393) ^ (y * 668265263) ^ seed) >>> 0;
      value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
      return (value ^ (value >>> 16)) & 255;
    }

    function getCoarseNoiseByte(x, y, tileSize) {
      const cellSize = 16;
      const cellCount = Math.max(1, Math.round(tileSize / cellSize));
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const nextX = (cellX + 1) % cellCount;
      const nextY = (cellY + 1) % cellCount;
      const offsetX = (x % cellSize) / cellSize;
      const offsetY = (y % cellSize) / cellSize;
      const smoothX = offsetX * offsetX * (3 - (2 * offsetX));
      const smoothY = offsetY * offsetY * (3 - (2 * offsetY));
      const topLeft = getNoiseByte(cellX, cellY, 0x51f15e);
      const topRight = getNoiseByte(nextX, cellY, 0x51f15e);
      const bottomLeft = getNoiseByte(cellX, nextY, 0x51f15e);
      const bottomRight = getNoiseByte(nextX, nextY, 0x51f15e);
      const top = topLeft + ((topRight - topLeft) * smoothX);
      const bottom = bottomLeft + ((bottomRight - bottomLeft) * smoothX);
      return Math.round(top + ((bottom - top) * smoothY));
    }

    function writeTransparentNoisePixel(data, index, value, alphaScale) {
      const delta = value - 127.5;
      const channel = delta >= 0 ? 255 : 0;
      data[index] = channel;
      data[index + 1] = channel;
      data[index + 2] = channel;
      data[index + 3] = Math.round(Math.min(255, Math.abs(delta) * 2 * alphaScale));
    }

    function ensureMaterialNoiseTile(kind) {
      if (!materialNoiseTiles[kind]) {
        const tile = documentObj.createElement('canvas');
        tile.width = 128;
        tile.height = 128;
        const tileContext = tile.getContext('2d');
        if (!tileContext) {
          return null;
        }
        const imageData = tileContext.createImageData(tile.width, tile.height);
        const noiseValues = new Uint8Array(tile.width * tile.height);
        for (let y = 0; y < tile.height; y += 1) {
          for (let x = 0; x < tile.width; x += 1) {
            noiseValues[(y * tile.width) + x] = kind === 'coarse'
              ? getCoarseNoiseByte(x, y, tile.width)
              : getNoiseByte(x, y, 0x9e3779b9);
          }
        }
        for (let y = 0; y < tile.height; y += 1) {
          for (let x = 0; x < tile.width; x += 1) {
            const pixelIndex = (y * tile.width) + x;
            const index = pixelIndex * 4;
            let value = noiseValues[pixelIndex];
            if (kind === 'fine') {
              const left = noiseValues[(y * tile.width) + ((x + tile.width - 1) % tile.width)];
              const right = noiseValues[(y * tile.width) + ((x + 1) % tile.width)];
              const top = noiseValues[(((y + tile.height - 1) % tile.height) * tile.width) + x];
              const bottom = noiseValues[(((y + 1) % tile.height) * tile.width) + x];
              value = clampNumber(
                127.5 + (((right - left) + (bottom - top)) * 0.55),
                0,
                255
              );
            }
            writeTransparentNoisePixel(
              imageData.data,
              index,
              value,
              kind === 'coarse' ? 0.45 : 1.05
            );
          }
        }
        tileContext.putImageData(imageData, 0, 0);
        materialNoiseTiles[kind] = tile;
      }
      return materialNoiseTiles[kind];
    }

    function getStandardNoiseDataUrl(kind) {
      if (standardNoiseDataUrls[kind] !== null) {
        return standardNoiseDataUrls[kind];
      }
      const tile = ensureMaterialNoiseTile(kind);
      if (!tile || typeof tile.toDataURL !== 'function') {
        return '';
      }
      try {
        standardNoiseDataUrls[kind] = tile.toDataURL('image/png');
      } catch (_error) {
        return '';
      }
      return standardNoiseDataUrls[kind];
    }

    function drawStandardGlassTexture(texture, wallpaperLuminance) {
      const params = getStandardFrostParams(texture);
      const viewport = getViewportSize();
      const materialBlendMode = resolveMaterialBlendMode(
        Number.isFinite(wallpaperLuminance) ? wallpaperLuminance : 0.5
      );
      const enabled = params.ratio > 0.001;
      const fineNoiseUrl = enabled ? getStandardNoiseDataUrl('fine') : '';
      const coarseNoiseUrl = enabled ? getStandardNoiseDataUrl('coarse') : '';
      const backgroundImages = [
        'linear-gradient(rgba(248, 250, 252, 0.55), rgba(248, 250, 252, 0.55))',
        'linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.12) 14%, transparent 34%)',
        'radial-gradient(ellipse 65% 52% at 12% 8%, rgba(255, 255, 255, 0.46), transparent 72%)',
        'radial-gradient(ellipse at center, transparent 58%, rgba(255, 255, 255, 0.16) 88%, rgba(255, 255, 255, 0.04) 100%)'
      ];
      const backgroundRepeats = ['no-repeat', 'no-repeat', 'no-repeat', 'no-repeat'];
      const backgroundSizes = ['100% 100%', '100% 100%', '100% 100%', '100% 100%'];
      if (fineNoiseUrl) {
        backgroundImages.push(`url("${fineNoiseUrl}")`);
        backgroundRepeats.push('repeat');
        backgroundSizes.push(`${params.grainSize}px ${params.grainSize}px`);
      }
      if (coarseNoiseUrl) {
        backgroundImages.push(`url("${coarseNoiseUrl}")`);
        backgroundRepeats.push('repeat');
        backgroundSizes.push(`${params.coarseGrainSize}px ${params.coarseGrainSize}px`);
      }
      canvas.width = 1;
      canvas.height = 1;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.backgroundImage = enabled
        ? backgroundImages.join(', ')
        : 'none';
      canvas.style.backgroundRepeat = enabled
        ? backgroundRepeats.join(', ')
        : 'no-repeat';
      canvas.style.backgroundSize = enabled
        ? backgroundSizes.join(', ')
        : 'auto';
      setCanvasVisuals(
        'blur-standard',
        enabled ? params.materialOpacity : 0,
        materialBlendMode
      );
    }

    function drawCachedLayeredEffect(type, viewport, sampler, inkTone, strength, size, spacing, drawLayer) {
      const boundedSpacing = clampNumber(spacing, 0, 100);
      const cacheKey = getEffectBaseKey(type, viewport, sampler, inkTone, strength, size, boundedSpacing);
      if (effectBaseCacheKey !== cacheKey) {
        context.clearRect(0, 0, viewport.width, viewport.height);
        drawLayer(context, viewport, sampler, inkTone, strength, size, boundedSpacing);
        effectBaseCacheKey = cacheKey;
      }
      setCanvasVisuals(type, 1, 'normal');
    }

    function drawHalftone(viewport, sampler, inkTone, strength, size, spacing) {
      drawCachedLayeredEffect(
        'halftone',
        viewport,
        sampler,
        inkTone,
        strength,
        size,
        spacing,
        drawHalftoneLayer
      );
    }

    function drawAscii(viewport, sampler, inkTone, strength, size, spacing) {
      drawCachedLayeredEffect(
        'ascii',
        viewport,
        sampler,
        inkTone,
        strength,
        size,
        spacing,
        drawAsciiLayer
      );
    }

    function drawDither(viewport, sampler, inkTone, strength, size, spacing) {
      drawCachedLayeredEffect(
        'dither',
        viewport,
        sampler,
        inkTone,
        strength,
        size,
        spacing,
        drawDitherLayer
      );
    }

    function ensureCrtWebglRenderer() {
      if (hasTriedCrtWebglRenderer) {
        return crtWebglRenderer;
      }
      hasTriedCrtWebglRenderer = true;
      const factory = root.LumnoNewtabCrtWebGL;
      if (!factory || typeof factory.createRenderer !== 'function') {
        return null;
      }
      try {
        crtWebglRenderer = factory.createRenderer({
          documentObj,
          onContextLost: () => {
            clearEffectBaseCache();
            scheduleRender();
          },
          onContextRestored: () => {
            clearEffectBaseCache();
            scheduleRender();
          }
        });
      } catch (_error) {
        crtWebglRenderer = null;
      }
      return crtWebglRenderer;
    }

    function destroyCrtWebglRenderer() {
      if (crtWebglRenderer && typeof crtWebglRenderer.destroy === 'function') {
        crtWebglRenderer.destroy();
      }
      crtWebglRenderer = null;
      hasTriedCrtWebglRenderer = false;
    }

    function drawCrt(viewport, sampler, inkTone, strength, crtPrefs) {
      const details = crtPrefs || DEFAULT_PREFS;
      const cacheKey = [
        getEffectBaseKey('crt-webgl', viewport, sampler, inkTone, strength, 33, 2),
        details.crtBloom,
        details.crtRgbOffset,
        details.crtCurvature
      ].join(':');
      if (effectBaseCacheKey !== cacheKey) {
        const renderer = ensureCrtWebglRenderer();
        const rendered = Boolean(renderer &&
          typeof renderer.render === 'function' &&
          renderer.render({
            image: loadedImage,
            width: canvas.width,
            height: canvas.height,
            sourceWidth: sampler.naturalWidth,
            sourceHeight: sampler.naturalHeight,
            strength,
            bloom: details.crtBloom,
            rgbOffset: details.crtRgbOffset,
            curvature: details.crtCurvature
          }));
        context.clearRect(0, 0, viewport.width, viewport.height);
        if (rendered && renderer.canvas) {
          context.drawImage(
            renderer.canvas,
            0,
            0,
            renderer.canvas.width,
            renderer.canvas.height,
            0,
            0,
            viewport.width,
            viewport.height
          );
        } else {
          drawCrtFallbackLayer(context, viewport, sampler, inkTone, strength, details);
        }
        effectBaseCacheKey = cacheKey;
      }
      setCanvasVisuals('crt', 1, 'normal');
    }

    function renderNow(revision) {
      renderFrame = 0;
      const normalized = normalizePrefs(prefs);
      if (normalized.type === 'none' || !isWallpaperActive()) {
        clearCanvas();
        completeRender(revision);
        return;
      }
      if (!ensureCanvas()) {
        completeRender(revision);
        return;
      }
      const token = ++renderToken;
      if (normalized.type === 'blur') {
        shouldCrossfadeResize = false;
        const wallpaper = getCurrentWallpaper();
        const imageUrl = wallpaper ? getWallpaperImageUrl(wallpaper) : '';
        if (loadedSampler && loadedSamplerUrl === imageUrl) {
          drawStandardGlassTexture(normalized.texture, loadedSampler.averageLuminance);
          completeRender(revision);
          return;
        }
        drawStandardGlassTexture(normalized.texture, null);
        if (!imageUrl) {
          completeRender(revision);
          return;
        }
        loadImage(imageUrl, token).then((image) => {
          if (token !== renderToken) {
            return;
          }
          const sampler = image ? getSampler(image, imageUrl) : null;
          if (sampler) {
            drawStandardGlassTexture(normalized.texture, sampler.averageLuminance);
          }
          completeRender(revision);
        }).catch(() => {
          if (token === renderToken) {
            completeRender(revision);
          }
        });
        return;
      }
      const crossfadeResize = shouldCrossfadeResize &&
        (normalized.type === 'blocks' ||
          normalized.type === 'halftone' ||
          normalized.type === 'dither' ||
          normalized.type === 'ascii' ||
          normalized.type === 'crt');
      shouldCrossfadeResize = false;
      if (crossfadeResize) {
        prepareResizeCrossfade();
      }
      const viewport = resizeCanvas();
      if (!viewport) {
        completeRender(revision);
        return;
      }
      if (normalized.type === 'grain') {
        drawGrain(viewport, normalized.strength);
        completeRender(revision);
        return;
      }
      const wallpaper = getCurrentWallpaper();
      const imageUrl = wallpaper ? getWallpaperImageUrl(wallpaper) : '';
      loadImage(imageUrl, token).then((image) => {
        if (token !== renderToken) {
          return;
        }
        if (!image) {
          clearCanvas();
          completeRender(revision);
          return;
        }
        const nextViewport = resizeCanvas();
        if (!nextViewport) {
          completeRender(revision);
          return;
        }
        const sampler = getSampler(image, imageUrl);
        if (!sampler) {
          clearCanvas();
          completeRender(revision);
          return;
        }
        if (normalized.type === 'blocks') {
          drawBlocks(
            nextViewport,
            sampler,
            100,
            normalized.blockSize,
            0,
            100
          );
          completeRender(revision);
          return;
        }
        if (normalized.type === 'halftone') {
          drawHalftone(
            nextViewport,
            sampler,
            normalized.inkTone,
            normalized.strength,
            normalized.size,
            normalized.spacing
          );
          completeRender(revision);
          return;
        }
        if (normalized.type === 'dither') {
          drawDither(
            nextViewport,
            sampler,
            normalized.inkTone,
            normalized.strength,
            normalized.size,
            normalized.spacing
          );
          completeRender(revision);
          return;
        }
        if (normalized.type === 'crt') {
          drawCrt(
            nextViewport,
            sampler,
            normalized.inkTone,
            normalized.crtStrength,
            normalized
          );
          completeRender(revision);
          return;
        }
        if (normalized.type === 'ascii') {
          drawAscii(
            nextViewport,
            sampler,
            normalized.inkTone,
            normalized.strength,
            normalized.size,
            normalized.spacing
          );
        }
        completeRender(revision);
      }).catch(() => {
        if (token !== renderToken) {
          completeRender(revision);
          return;
        }
        clearCanvas();
        completeRender(revision);
      });
    }

    function runRenderNow(revision) {
      try {
        renderNow(revision);
      } catch (_error) {
        try {
          clearCanvas();
        } finally {
          completeRender(revision);
        }
      }
    }

    function scheduleRender(delay) {
      const revision = ++renderRequestRevision;
      if (destroyed) {
        completeRender(revision);
        return revision;
      }
      if (renderFrame) {
        cancelFrame(renderFrame);
        renderFrame = 0;
      }
      if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = 0;
      }
      const wait = Number(delay) || 0;
      if (wait > 0) {
        renderTimer = setTimeout(() => {
          renderTimer = 0;
          renderFrame = requestFrame(() => runRenderNow(revision));
        }, wait);
        return revision;
      }
      renderFrame = requestFrame(() => runRenderNow(revision));
      return revision;
    }

    function apply(nextPrefs) {
      const previousPrefs = normalizePrefs(prefs);
      prefs = normalizePrefs(nextPrefs);
      updateWallpaperEffectProperties(prefs);
      const previousType = previousPrefs.type;
      const visualPrefsChanged = previousType !== prefs.type ||
        previousPrefs.inkTone !== prefs.inkTone ||
        previousPrefs.strength !== prefs.strength ||
        previousPrefs.crtStrength !== prefs.crtStrength ||
        (prefs.type !== 'crt' && previousPrefs.size !== prefs.size) ||
        previousPrefs.blockSize !== prefs.blockSize ||
        (prefs.type !== 'crt' && previousPrefs.spacing !== prefs.spacing) ||
        previousPrefs.texture !== prefs.texture ||
        previousPrefs.crtBloom !== prefs.crtBloom ||
        previousPrefs.crtRgbOffset !== prefs.crtRgbOffset ||
        previousPrefs.crtCurvature !== prefs.crtCurvature;
      if (!visualPrefsChanged) {
        return Promise.resolve();
      }
      if (previousType === 'crt' && prefs.type !== 'crt') {
        destroyCrtWebglRenderer();
      }
      if (prefs.type !== 'ascii' &&
          prefs.type !== 'dither' &&
          prefs.type !== 'halftone' &&
          prefs.type !== 'blocks' &&
          prefs.type !== 'crt') {
        clearEffectBaseCache();
      }
      if (canvas &&
          context &&
          canAnimateTransition() &&
          previousType !== prefs.type &&
          previousType !== 'none' &&
          prefs.type !== 'none' &&
          getCanvasOpacity() > 0.01) {
        if (prepareResizeCrossfade()) {
          return waitForRenderRevision(scheduleRender());
        }
        canvas.style.opacity = '0';
        return waitForRenderRevision(scheduleRender(EFFECT_CROSSFADE_MS));
      }
      if (visualPrefsChanged && previousType === prefs.type) {
        return waitForRenderRevision(scheduleRender(PARAMETER_RENDER_DEBOUNCE_MS));
      }
      return waitForRenderRevision(scheduleRender());
    }

    function refresh(options) {
      const normalized = normalizePrefs(prefs);
      const immediate = Boolean(options && options.immediate);
      if (canvas &&
          context &&
          canAnimateTransition() &&
          normalized.type !== 'none' &&
          getCanvasOpacity() > 0.01) {
        const preservedCurrentFrame = (
          normalized.type === 'blocks' ||
          normalized.type === 'halftone' ||
          normalized.type === 'dither' ||
          normalized.type === 'ascii' ||
          normalized.type === 'crt'
        ) && prepareResizeCrossfade();
        if (!preservedCurrentFrame) {
          canvas.style.opacity = '0';
        }
        return waitForRenderRevision(scheduleRender(
          immediate || preservedCurrentFrame ? 0 : EFFECT_CROSSFADE_MS
        ));
      }
      return waitForRenderRevision(scheduleRender(immediate ? 0 : 60));
    }

    function handleWindowResize() {
      const normalized = normalizePrefs(prefs);
      shouldCrossfadeResize = Boolean(
        canvas &&
        context &&
        canAnimateTransition() &&
        (normalized.type === 'blocks' ||
          normalized.type === 'halftone' ||
          normalized.type === 'dither' ||
          normalized.type === 'ascii' ||
          normalized.type === 'crt') &&
        getCanvasOpacity() > 0.01
      );
      scheduleRender(RESIZE_RENDER_SETTLE_MS);
    }

    function destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      renderToken += 1;
      if (renderFrame) {
        cancelFrame(renderFrame);
        renderFrame = 0;
      }
      if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = 0;
      }
      if (observer && typeof observer.disconnect === 'function') {
        observer.disconnect();
      }
      observer = null;
      cleanupResizeCrossfade();
      destroyCrtWebglRenderer();
      if (windowObj && typeof windowObj.removeEventListener === 'function') {
        windowObj.removeEventListener('resize', handleWindowResize);
      }
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvas = null;
      context = null;
      completeRender(++renderRequestRevision);
    }

    if (windowObj && typeof windowObj.addEventListener === 'function') {
      windowObj.addEventListener('resize', handleWindowResize, { passive: true });
    }

    return {
      apply,
      destroy,
      getLuminanceAtViewport,
      refresh,
      normalizePrefs
    };
  }

  root.LumnoNewtabWallpaperEffects = {
    analyzeImageData,
    DEFAULT_PREFS,
    EFFECT_INK_TONES,
    EFFECT_TYPES,
    createWallpaperEffects,
    getEffectCanvasScale,
    getBlurRadius,
    liftSampleColor,
    migratePrefsToLatest,
    normalizePrefs,
    normalizeStoragePrefs,
    quantizeDitherColor,
    resolveUseDarkInk
  };
})(globalThis);
