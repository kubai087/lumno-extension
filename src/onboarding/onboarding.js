(function() {
  const MODEL = globalThis.LumnoOnboardingContent;
  const NAVIGATION_DISPOSITION = globalThis.LumnoNavigationDisposition;

  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const SHOW_SEARCH_COMMAND_NAME = 'show-search';
  const ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION = 'triggerOnboardingSearchOverlayFromCommand';
  const SHORTCUT_PLACEHOLDER = '{shortcut}';
  const TITLE_CYCLE_INTERVAL_MS = 1900;
  const TITLE_CYCLE_FIRST_DELAY_MS = 520;
  const TEXT_SWAP_FALLBACK_DURATION_MS = 200;
  const SITE_SEARCH_OPTIONS_PAGE_PATH = 'src/options/options.html#shortcuts';
  const FOCUSED_NEWTAB_RELATIVE_PAGE_PATH = '../newtab/lumno-newtab.html?focus=1';
  const COMMUNITY_LINKS = globalThis.LumnoCommunityLinks;
  // The demo recent-site card points at Lumno's own listing, so it follows the
  // store this copy was installed from.
  const STORE_ACCENT_RGB = Object.freeze({
    chrome: Object.freeze([66, 133, 244]),
    edge: Object.freeze([0, 120, 212])
  });
  const ACTION_MESSAGE_BY_ID = Object.freeze({
    openShortcuts: 'openExtensionShortcutsPage',
    openExtensionDetails: 'openExtensionDetailsPage',
    openNewtab: 'openNewTab',
    openOptions: 'openOptionsPage',
    openSiteSearchOptions: 'openSiteSearchOptionsPage'
  });
  let runtimeCopy = MODEL.getOnboardingRuntimeCopy('en');
  const LUMNO_WEB_WORDMARK_SRC = '../../assets/images/lumno-web-textlogo.svg';
  const LUMNO_WEB_BUTTERFLY_REST_PATH = 'M4.3248 17.7823C1.22382 14.6398 -0.116749 10.2475 0.824858 6.7097C1.02033 5.97529 1.95363 5.98287 2.27212 6.67289L4.16024 10.7637C4.38415 11.2488 4.50011 11.7767 4.50011 12.311L4.50011 16L6.24277 16C7.66705 16 9.01155 16.6576 9.88596 17.7819L11.0831 19.3211C11.5044 19.8627 11.2076 20.6668 10.5235 20.7201C8.63849 20.8671 6.85452 20.3459 4.3248 17.7823Z';
  const LUMNO_WEB_BUTTERFLY_FLUTTER_PATH = 'M4.32468 17.7823C-1.04106 11.6456 2.30784 4.56298 5.14393 1.13518C5.48929 0.717757 6.11849 0.734355 6.47527 1.14207L10.4328 5.66451C11.4105 6.78177 11.6239 8.37593 10.9745 9.71102L8.61264 14.567L11.5238 13.9636C13.2202 13.612 14.9706 14.24 16.0565 15.5899L18.7241 18.9056C19.0394 19.2975 18.9857 19.8717 18.5688 20.1531C15.6258 22.1399 9.6385 23.8596 4.32468 17.7823Z';
  const LUMNO_WEB_BUTTERFLY_D_VALUES = `${LUMNO_WEB_BUTTERFLY_FLUTTER_PATH};${LUMNO_WEB_BUTTERFLY_REST_PATH};${LUMNO_WEB_BUTTERFLY_FLUTTER_PATH}`;
  const ONBOARDING_OVERLAY_DEMO_PANEL_ID = '_x_extension_onboarding_overlay_demo_2026_unique_';
  const LUMNO_OVERLAY_HOVER_LEAD_MS = 1040;
  const LUMNO_OVERLAY_HOVER_START_MS = 4240 - LUMNO_OVERLAY_HOVER_LEAD_MS;
  const LUMNO_OVERLAY_HOVER_STEP_MS = 1600;
  const LUMNO_OVERLAY_HOVER_WRAP_STEP_MS = 1600;
  const NEWTAB_PREVIEW_HOVER_START_MS = 1500;
  const NEWTAB_PREVIEW_HOVER_HOLD_MS = 1200;
  const NEWTAB_PREVIEW_HOVER_MOVE_MS = 520;
  const NEWTAB_PREVIEW_HOVER_SETTLE_MS = 1140;
  const NEWTAB_PREVIEW_WORDMARK_SRC = '../../assets/images/lumno-wordmark.svg';
  const HOMEPAGE_PIP_ART_SRC = '../../assets/images/onboarding-auto-pip.svg';
  const NEWTAB_FILTERS_ART_SRC = '../../assets/images/onboarding-newtab-filters.webp';
  const ONBOARDING_FRAME_WIDTH = 1240;
  const ONBOARDING_FRAME_HEIGHT = 680;
  const VISUAL_CANVAS_WIDTH = 704;
  const VISUAL_CANVAS_HEIGHT = 680;

  function getRuntimeSection(name) {
    const copy = runtimeCopy || {};
    const section = copy && copy[name];
    return section && typeof section === 'object' ? section : {};
  }

  function getRuntimeMiscText(key, fallback) {
    const misc = getRuntimeSection('misc');
    const value = misc && misc[key];
    const text = String(value || '').trim();
    return text || fallback || '';
  }

  function formatRuntimeTemplate(template, values) {
    const source = String(template || '');
    const map = values || {};
    return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(map, key) ? String(map[key]) : match
    ));
  }


  function getRuntimeArray(sectionName, key) {
    const section = getRuntimeSection(sectionName);
    const value = key ? section[key] : section;
    return Array.isArray(value) ? value : [];
  }

  function getLumnoOverlayQuery() {
    const section = getRuntimeSection('lumnoOverlay');
    return String(section.query || 'extension');
  }

  function getLumnoOverlayResults() {
    return getRuntimeArray('lumnoOverlay', 'results');
  }

  function getNewtabPreviewCopy() {
    return getRuntimeSection('newtabPreview');
  }

  function getNewtabPreviewQuery() {
    return String(getNewtabPreviewCopy().query || '');
  }

  function getNewtabPreviewBookmarks() {
    return getRuntimeArray('newtabPreview', 'bookmarks');
  }

  function getNewtabPreviewRecentSites() {
    return getRuntimeArray('newtabPreview', 'recentSites').map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }
      if (String(item.url || '').trim() !== 'chromeWebStore') {
        return Object.assign({}, item);
      }
      const listing = COMMUNITY_LINKS.getStoreListing();
      return Object.assign({}, item, {
        title: `Lumno - ${listing.name}`,
        siteName: listing.name,
        url: listing.url,
        urlText: listing.host,
        accentRgb: STORE_ACCENT_RGB[listing.id] || item.accentRgb
      });
    });
  }

  function getNewtabPreviewSectionTitle(key, fallback) {
    const sections = getNewtabPreviewCopy().sections || {};
    return String(sections[key] || fallback || '');
  }

  function getSiteSearchDemoCases() {
    return getRuntimeArray('siteSearchDemo', 'cases');
  }

  function getFeatureCards() {
    return getRuntimeArray('featureCards');
  }

  function getFeatureAwards() {
    return getRuntimeArray('featureAwards');
  }

  function getNewtabPreviewFaviconUrl(url) {
    const value = String(url || '').trim();
    return value
      ? `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(value)}&size=64`
      : '';
  }

  function getNewtabPreviewFolderSvg(idSuffix) {
    const suffix = String(idSuffix || 'preview').replace(/[^a-zA-Z0-9_-]/g, '_');
    const lowerGradientId = `x-nt-preview-folder-lower-${suffix}`;
    const upperGradientId = `x-nt-preview-folder-upper-${suffix}`;
    return [
      '<svg viewBox="0 0 31 29" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">',
      '<g data-folder-layer="lower">',
      `<path d="M7.24 2C6.082 2 5.503 2 5.064 2.232C4.71 2.42 4.42 2.71 4.232 3.064C4 3.503 4 4.082 4 5.24V19.76C4 20.918 4 21.497 4.232 21.936C4.42 22.29 4.71 22.58 5.064 22.768C5.503 23 6.082 23 7.24 23H23.76C24.918 23 25.497 23 25.936 22.768C26.29 22.58 26.58 22.29 26.768 21.936C27 21.497 27 20.918 27 19.76V8.24C27 7.082 27 6.503 26.768 6.064C26.58 5.71 26.29 5.42 25.936 5.232C25.497 5 24.918 5 23.76 5H16.287C15.767 5 15.507 5 15.263 4.938C15.065 4.887 14.875 4.806 14.701 4.698C14.488 4.565 14.308 4.377 13.948 4.002L12.986 2.998C12.626 2.623 12.446 2.435 12.233 2.302C12.059 2.194 11.869 2.113 11.671 2.062C11.427 2 11.167 2 10.647 2H7.24Z" fill="url(#${lowerGradientId})"/>`,
      '<path d="M7.24 2.5H10.647C11.192 2.5 11.379 2.504 11.547 2.547C11.696 2.585 11.838 2.645 11.969 2.727C12.116 2.818 12.248 2.95 12.625 3.344L13.587 4.348C13.929 4.705 14.158 4.949 14.438 5.123C14.655 5.258 14.892 5.359 15.14 5.422C15.458 5.503 15.792 5.5 16.287 5.5H23.76C24.347 5.5 24.757 5.5 25.075 5.527C25.388 5.554 25.567 5.603 25.702 5.675C25.968 5.815 26.185 6.032 26.325 6.298C26.397 6.433 26.446 6.612 26.473 6.925C26.5 7.243 26.5 7.653 26.5 8.24V19.76C26.5 20.347 26.5 20.757 26.473 21.075C26.446 21.388 26.397 21.567 26.325 21.702C26.185 21.968 25.968 22.185 25.702 22.325C25.567 22.397 25.388 22.446 25.075 22.473C24.757 22.5 24.347 22.5 23.76 22.5H7.24C6.653 22.5 6.243 22.5 5.925 22.473C5.612 22.446 5.433 22.397 5.298 22.325C5.032 22.185 4.815 21.968 4.675 21.702C4.603 21.567 4.554 21.388 4.527 21.075C4.5 20.757 4.5 20.347 4.5 19.76V5.24C4.5 4.653 4.5 4.243 4.527 3.925C4.554 3.612 4.603 3.433 4.675 3.298C4.815 3.032 5.032 2.815 5.298 2.675C5.433 2.603 5.612 2.554 5.925 2.527C6.243 2.5 6.653 2.5 7.24 2.5Z" stroke="#5393FF"/>',
      '</g>',
      '<g data-folder-layer="file">',
      '<path d="M7 10C7 9.448 7.448 9 8 9H23C23.552 9 24 9.448 24 10V17C24 17.552 23.552 18 23 18H8C7.448 18 7 17.552 7 17V10Z" fill="white"/>',
      '<path d="M13 11H18" stroke="#DDE8FB" stroke-linecap="round"/>',
      '</g>',
      '<g data-folder-layer="upper">',
      `<path d="M7.24 5C6.082 5 5.503 5 5.064 5.232C4.71 5.42 4.42 5.71 4.232 6.064C4 6.503 4 7.082 4 8.24V19.76C4 20.918 4 21.497 4.232 21.936C4.42 22.29 4.71 22.58 5.064 22.768C5.503 23 6.082 23 7.24 23H23.76C24.918 23 25.497 23 25.936 22.768C26.29 22.58 26.58 22.29 26.768 21.936C27 21.497 27 20.918 27 19.76V8.24C27 7.082 27 6.503 26.768 6.064C26.58 5.71 26.29 5.42 25.936 5.232C25.497 5 24.918 5 23.76 5H7.24Z" fill="url(#${upperGradientId})"/>`,
      '<path d="M7.24 5.5H23.76C24.347 5.5 24.757 5.5 25.075 5.527C25.388 5.554 25.567 5.603 25.702 5.675C25.968 5.815 26.185 6.032 26.325 6.298C26.397 6.433 26.446 6.612 26.473 6.925C26.5 7.243 26.5 7.653 26.5 8.24V19.76C26.5 20.347 26.5 20.757 26.473 21.075C26.446 21.388 26.397 21.567 26.325 21.702C26.185 21.968 25.968 22.185 25.702 22.325C25.567 22.397 25.388 22.446 25.075 22.473C24.757 22.5 24.347 22.5 23.76 22.5H7.24C6.653 22.5 6.243 22.5 5.925 22.473C5.612 22.446 5.433 22.397 5.298 22.325C5.032 22.185 4.815 21.968 4.675 21.702C4.603 21.567 4.554 21.388 4.527 21.075C4.5 20.757 4.5 20.347 4.5 19.76V8.24C4.5 7.653 4.5 7.243 4.527 6.925C4.554 6.612 4.603 6.433 4.675 6.298C4.815 6.032 5.032 5.815 5.298 5.675C5.433 5.603 5.612 5.554 5.925 5.527C6.243 5.5 6.653 5.5 7.24 5.5Z" stroke="#5393FF"/>',
      '</g>',
      '<defs>',
      `<linearGradient id="${lowerGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">`,
      '<stop stop-color="#93BBFF"/><stop offset="0.884515" stop-color="#81B0FF"/><stop offset="0.884615" stop-color="#4389FF"/><stop offset="1" stop-color="#97BEFF"/>',
      '</linearGradient>',
      `<linearGradient id="${upperGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">`,
      '<stop stop-color="#CCDFFF"/><stop offset="0.884515" stop-color="#B2CEFF"/><stop offset="0.884615" stop-color="#89B5FF"/><stop offset="1" stop-color="#97BEFF"/>',
      '</linearGradient>',
      '</defs>',
      '</svg>'
    ].join('');
  }

  function mixNewtabPreviewColor(color, target, amount) {
    return [
      Math.round(color[0] + (target[0] - color[0]) * amount),
      Math.round(color[1] + (target[1] - color[1]) * amount),
      Math.round(color[2] + (target[2] - color[2]) * amount)
    ];
  }

  function newtabPreviewRgbToCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function newtabPreviewRgbToCssAlpha(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function newtabPreviewRgbToCssParts(rgb) {
    return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  }

  function getNewtabPreviewAccentRgb(item) {
    return item && Array.isArray(item.accentRgb) && item.accentRgb.length === 3
      ? item.accentRgb
      : [59, 130, 246];
  }

  function applyNewtabPreviewRecentTheme(card, item) {
    const accentRgb = getNewtabPreviewAccentRgb(item);
    const accentEmphasis = mixNewtabPreviewColor(accentRgb, [0, 0, 0], 0.18);
    const base = mixNewtabPreviewColor(accentRgb, [255, 255, 255], 0.82);
    const border = mixNewtabPreviewColor(base, [0, 0, 0], 0.1);
    const innerTint = mixNewtabPreviewColor(accentRgb, [255, 255, 255], 0.82);
    card.style.setProperty('--x-nt-recent-card-color', newtabPreviewRgbToCss(base));
    card.style.setProperty('--x-nt-recent-card-border-color', newtabPreviewRgbToCss(border));
    card.style.setProperty('--x-nt-recent-inner-tint-rgb', newtabPreviewRgbToCssParts(innerTint));
    card.style.setProperty('--x-nt-recent-accent-color', newtabPreviewRgbToCss(accentEmphasis));
    card.style.setProperty('--x-nt-recent-accent-soft', newtabPreviewRgbToCssAlpha(accentRgb, 0.12));
    card.style.setProperty('--x-nt-recent-accent-border', newtabPreviewRgbToCssAlpha(accentRgb, 0.18));
  }

  function applyNewtabPreviewBookmarkTheme(card, item) {
    if (!item || item.type === 'folder') {
      card.style.setProperty('--x-nt-bookmark-shadow-rgb', '86, 138, 220');
      return;
    }
    const accentRgb = getNewtabPreviewAccentRgb(item);
    const base = mixNewtabPreviewColor(accentRgb, [255, 255, 255], 0.94);
    const border = mixNewtabPreviewColor(base, [0, 0, 0], 0.07);
    const icon = mixNewtabPreviewColor(accentRgb, [255, 255, 255], 0.96);
    const hover = mixNewtabPreviewColor(accentRgb, [255, 255, 255], 0.9);
    const shadow = mixNewtabPreviewColor(accentRgb, [138, 146, 160], 0.46);
    card.style.setProperty('--x-nt-bookmark-card-color', newtabPreviewRgbToCss(base));
    card.style.setProperty('--x-nt-bookmark-card-hover-color', newtabPreviewRgbToCssAlpha(hover, 0.86));
    card.style.setProperty('--x-nt-bookmark-card-border-color', newtabPreviewRgbToCss(border));
    card.style.setProperty('--x-nt-bookmark-icon-color', newtabPreviewRgbToCss(icon));
    card.style.setProperty('--x-nt-bookmark-shadow-rgb', newtabPreviewRgbToCssParts(shadow));
  }

  const params = new URLSearchParams(window.location.search || '');
  const root = document.querySelector('[data-onboarding-shell]');
  const versionText = document.getElementById('onboarding-version-text');
  const copyPanel = document.getElementById('onboarding-copy-panel');
  const eyebrow = document.getElementById('onboarding-eyebrow');
  const title = document.getElementById('onboarding-title');
  const body = document.getElementById('onboarding-body');
  const pageStrip = document.getElementById('onboarding-page-strip');
  const interactionSlots = document.getElementById('onboarding-interaction-slots');
  const visualSlot = document.getElementById('onboarding-visual-slot');
  const visualPanel = document.getElementById('onboarding-visual-panel');
  const visualCanvas = document.getElementById('onboarding-visual-canvas');
  const visualStage = document.getElementById('onboarding-visual-stage');
  const cursorLayer = document.getElementById('onboarding-cursor-layer');
  const copyActions = document.querySelector('.onboarding-copy-actions');
  const onboardingPageStripApi = globalThis.LumnoOnboardingPageStrip;
  const onboardingActionsApi = globalThis.LumnoOnboardingActions;
  const onboardingBodyCopyApi = globalThis.LumnoOnboardingBodyCopy;
  const onboardingCopyHeadingApi = globalThis.LumnoOnboardingCopyHeading;
  const onboardingCursorLayerApi = globalThis.LumnoOnboardingCursorLayer;
  const onboardingInteractionsApi = globalThis.LumnoOnboardingInteractions;
  const onboardingVisualSurfaceApi = globalThis.LumnoOnboardingVisualSurface;
  const pageStripController = pageStrip
    ? onboardingPageStripApi.createPageStripController(pageStrip, {
      onNavigate(slideIndex) {
        dispatch({ type: 'GOTO', index: slideIndex });
      }
    })
    : null;
  const copyActionsController = copyActions
    ? onboardingActionsApi.createActionButtonsController(copyActions, {
      onAction(actionId, event) {
        runExtensionAction(actionId, event);
      },
      onShowTooltip(button) {
        showActionButtonTooltip(button);
      },
      onHideTooltip() {
        hideActionButtonTooltip();
      }
    })
    : null;
  const interactionSlotsController = interactionSlots
    ? onboardingInteractionsApi.createInteractionsController(interactionSlots, {
      onAction(actionId, event) {
        runExtensionAction(actionId, event);
      },
      onToggleAccordion(accordionId) {
        toggleInteractionAccordion(accordionId);
      },
      onShowInfoTooltip(target, infoTooltip, browserAvatars) {
        showOnboardingInfoTooltip(target, infoTooltip, browserAvatars);
      },
      onHideInfoTooltip() {
        hideOnboardingInfoTooltip();
      }
    })
    : null;
  const bodyCopyController = body
    ? onboardingBodyCopyApi.createBodyCopyController(body)
    : null;
  const copyHeadingController = (eyebrow || title)
    ? onboardingCopyHeadingApi.createCopyHeadingController(
      { eyebrow, title },
      {
        onTitleFitNeeded() {
          scheduleTitleFitUpdate();
        }
      }
    )
    : null;
  const cursorLayerController = cursorLayer
    ? onboardingCursorLayerApi.createCursorLayerController(cursorLayer)
    : null;
  const visualSurfaceController = visualStage
    ? onboardingVisualSurfaceApi.createVisualSurfaceController(visualStage)
    : null;
  let blueprint = null;
  let state = null;
  let currentShortcutValue = getDefaultShortcutValue();
  let currentShortcutLabel = getDefaultShortcutLabel();
  let titleFitFrame = 0;
  let copySwapTimeout = 0;
  let visualScaleFrame = 0;
  let expandedInteractionAccordionId = '';
  let visualResizeObserver = null;
  const onboardingInfoTooltipController = globalThis.LumnoTooltip.createController({
    id: '_x_extension_onboarding_info_tooltip_2026_unique_',
    className: 'onboarding-info-tooltip',
    maxWidth: 360
  });
  const actionTooltipController = globalThis.LumnoTooltip.createController({
    id: '_x_extension_onboarding_action_tooltip_2026_unique_',
    className: 'onboarding-info-tooltip',
    maxWidth: 360
  });

  function getChromeApi() {
    return typeof chrome !== 'undefined' ? chrome : null;
  }

  function syncOnboardingSlideParam(index) {
    if (!window.history || typeof window.history.replaceState !== 'function' || !window.location || !window.location.href) {
      return;
    }
    const numericIndex = Number(index);
    const safeIndex = Number.isFinite(numericIndex) ? Math.max(0, Math.floor(numericIndex)) : 0;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('slide', String(safeIndex));
      const nextUrl = url.toString();
      if (nextUrl === window.location.href) {
        return;
      }
      window.history.replaceState(window.history.state, '', nextUrl);
    } catch (error) {
      // Ignore URL sync failures; onboarding state should still render normally.
    }
  }

  function buildRuntimePageUrl(path) {
    const value = String(path || '').trim();
    if (!value) {
      return '';
    }
    const chromeApi = getChromeApi();
    const hashIndex = value.indexOf('#');
    const pagePath = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const hash = hashIndex >= 0 ? value.slice(hashIndex + 1) : '';
    const baseUrl = chromeApi &&
        chromeApi.runtime &&
        typeof chromeApi.runtime.getURL === 'function'
      ? chromeApi.runtime.getURL(pagePath)
      : pagePath;
    return hash ? `${baseUrl}#${hash}` : baseUrl;
  }

  function navigateOnboardingToNewtab() {
    const chromeApi = getChromeApi();
    const routes = globalThis.LumnoExtensionRoutes;
    let url = '';
    url = routes.buildLumnoNewtabUrl(chromeApi, { focus: true });
    if (!url && chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function') {
      url = chromeApi.runtime.getURL('src/newtab/lumno-newtab.html?focus=1');
    }
    if (!url && typeof window !== 'undefined' && window.location) {
      try {
        url = new URL(FOCUSED_NEWTAB_RELATIVE_PAGE_PATH, window.location.href).toString();
      } catch (error) {
        url = FOCUSED_NEWTAB_RELATIVE_PAGE_PATH;
      }
    }
    if (!url || typeof window === 'undefined' || !window.location) {
      return false;
    }
    try {
      if (typeof window.location.assign === 'function') {
        window.location.assign(url);
        return true;
      }
      window.location.href = url;
      return true;
    } catch (error) {
      return false;
    }
  }

  function openExtensionPageTab(path, eventOrDisposition) {
    const url = buildRuntimePageUrl(path);
    if (!url) {
      return false;
    }
    const chromeApi = getChromeApi();
    const disposition = typeof eventOrDisposition === 'string'
      ? eventOrDisposition
      : getOpenDisposition(eventOrDisposition, 'newTab');
    if (chromeApi && chromeApi.tabs && typeof chromeApi.tabs.create === 'function') {
      try {
        chromeApi.tabs.create({ url, active: disposition !== 'backgroundTab' });
        return true;
      } catch (error) {
        // Fall through to window.open when the tabs API is unavailable.
      }
    }
    if (typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener');
      return true;
    }
    return false;
  }

  function openSiteSearchOptionsFallback(eventOrDisposition) {
    return openExtensionPageTab(SITE_SEARCH_OPTIONS_PAGE_PATH, eventOrDisposition);
  }

  function getOpenDisposition(event, fallback) {
    if (typeof event === 'string') {
      return event === 'backgroundTab' ? 'backgroundTab' : (fallback || event || 'newTab');
    }
    return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
  }

  function openExternalTab(url, eventOrDisposition) {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) {
      return false;
    }
    const chromeApi = getChromeApi();
    const disposition = typeof eventOrDisposition === 'string'
      ? eventOrDisposition
      : getOpenDisposition(eventOrDisposition, 'newTab');
    if (chromeApi && chromeApi.runtime && typeof chromeApi.runtime.sendMessage === 'function') {
      try {
        chromeApi.runtime.sendMessage({ action: 'createTab', url: targetUrl, disposition }, (response) => {
          const lastError = chromeApi.runtime && chromeApi.runtime.lastError;
          if (!lastError && response && response.ok !== false) {
            return;
          }
          if (typeof window.open === 'function') {
            window.open(targetUrl, '_blank', 'noopener');
          }
        });
        return true;
      } catch (error) {
        // Fall through to window.open when extension messaging is unavailable.
      }
    }
    if (typeof window.open === 'function') {
      window.open(targetUrl, '_blank', 'noopener');
      return true;
    }
    return false;
  }

  function getCssTimeMs(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) {
      return fallback;
    }
    const numeric = Number.parseFloat(raw);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return raw.endsWith('s') && !raw.endsWith('ms') ? numeric * 1000 : numeric;
  }

  function getTextSwapDurationMs() {
    if (typeof getComputedStyle !== 'function' || !document.documentElement) {
      return TEXT_SWAP_FALLBACK_DURATION_MS;
    }
    return getCssTimeMs(
      getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur'),
      TEXT_SWAP_FALLBACK_DURATION_MS
    );
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMacPlatform() {
    return /Mac|iPhone|iPad|iPod/i.test(String(navigator.platform || ''));
  }

  function getDefaultShortcutValue() {
    return isMacPlatform() ? 'Command+Shift+K' : 'Ctrl+Shift+K';
  }

  function getDefaultShortcutLabel() {
    return formatShortcutForDisplay(getDefaultShortcutValue()) || getDefaultShortcutValue();
  }

  function normalizeShortcutValue(value) {
    return String(value || '').trim().replace(/\s*\+\s*/g, '+');
  }

  function getShortcutDisplayTokens(shortcut) {
    return MODEL.getShortcutDisplayTokens(shortcut, { preferSymbols: isMacPlatform() });
  }

  function formatShortcutForDisplay(shortcut) {
    return MODEL.formatShortcutForDisplay(shortcut, { preferSymbols: isMacPlatform() });
  }

  function loadCurrentShortcut(callback) {
    const chromeApi = getChromeApi();
    const fallback = getDefaultShortcutValue();
    if (!chromeApi || !chromeApi.commands || typeof chromeApi.commands.getAll !== 'function') {
      callback(fallback);
      return;
    }
    try {
      chromeApi.commands.getAll((commands) => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          callback(fallback);
          return;
        }
        const items = Array.isArray(commands) ? commands : [];
        const command = items.find((item) => item && item.name === SHOW_SEARCH_COMMAND_NAME);
        const shortcut = command && typeof command.shortcut === 'string'
          ? command.shortcut
          : '';
        callback(shortcut || fallback);
      });
    } catch (error) {
      callback(fallback);
    }
  }

  function shortcutHotkeyMatchesEvent(shortcut, event) {
    return MODEL.shortcutHotkeyMatchesEvent(shortcut, event);
  }

  function isEditableTarget(target) {
    const element = target && target.nodeType === 1
      ? target
      : (target && target.parentElement ? target.parentElement : null);
    if (!element || !element.closest) {
      return false;
    }
    return Boolean(element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }

  function updateCurrentShortcut(shortcut, shouldRender) {
    const value = shortcut || getDefaultShortcutValue();
    const nextShortcutLabel = formatShortcutForDisplay(value) || getDefaultShortcutLabel();
    const changed = value !== currentShortcutValue || nextShortcutLabel !== currentShortcutLabel;
    currentShortcutValue = value;
    currentShortcutLabel = nextShortcutLabel;
    if (changed && shouldRender && blueprint && state) {
      render();
    }
  }

  function refreshCurrentShortcut(shouldRender) {
    loadCurrentShortcut((shortcut) => {
      updateCurrentShortcut(shortcut, shouldRender);
    });
  }

  function getCurrentOnboardingTab(callback) {
    const chromeApi = getChromeApi();
    const done = typeof callback === 'function' ? callback : () => {};
    if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.getCurrent !== 'function') {
      done(null);
      return;
    }
    try {
      chromeApi.tabs.getCurrent((tab) => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          done(null);
          return;
        }
        done(tab || null);
      });
    } catch (error) {
      done(null);
    }
  }

  function getOnboardingTabZoomFactor(tabId, callback) {
    const chromeApi = getChromeApi();
    const done = typeof callback === 'function' ? callback : () => {};
    if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.getZoom !== 'function' || typeof tabId !== 'number') {
      done(1);
      return;
    }
    try {
      chromeApi.tabs.getZoom(tabId, (zoomFactor) => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          done(1);
          return;
        }
        const zoom = Number(zoomFactor);
        done(Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
      });
    } catch (error) {
      done(1);
    }
  }

  function getOnboardingOverlayTabs(currentTabId, callback) {
    const chromeApi = getChromeApi();
    const done = typeof callback === 'function' ? callback : () => {};
    if (!chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.sendMessage !== 'function') {
      done([], currentTabId);
      return;
    }
    const request = { action: 'getTabsForOverlay' };
    if (typeof currentTabId === 'number') {
      request.currentTabId = currentTabId;
    }
    try {
      chromeApi.runtime.sendMessage(request, (response) => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          done([], currentTabId);
          return;
        }
        const tabs = response && Array.isArray(response.tabs) ? response.tabs : [];
        const responseCurrentTabId = response && typeof response.currentTabId === 'number'
          ? response.currentTabId
          : currentTabId;
        done(tabs, responseCurrentTabId);
      });
    } catch (error) {
      done([], currentTabId);
    }
  }

  function triggerOnboardingSearchOverlay() {
    const toggleOverlay = window._x_extension_toggleSearchOverlay_2026_unique_;
    if (typeof toggleOverlay !== 'function') {
      return;
    }
    getCurrentOnboardingTab((tab) => {
      const currentTabId = tab && typeof tab.id === 'number' ? tab.id : null;
      getOnboardingTabZoomFactor(currentTabId, (tabZoomFactor) => {
        getOnboardingOverlayTabs(currentTabId, (tabs, responseCurrentTabId) => {
          toggleOverlay(tabs, {
            tabZoomFactor,
            currentTabId: typeof responseCurrentTabId === 'number' ? responseCurrentTabId : currentTabId,
            currentTabUrl: window.location && window.location.href ? window.location.href : ''
          });
        });
      });
    });
  }

  function handleOnboardingCommandMessage(request, sender, sendResponse) {
    if (!request || request.action !== ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION) {
      return false;
    }
    const requestedTabId = Number.isFinite(Number(request.tabId)) ? Number(request.tabId) : null;
    getCurrentOnboardingTab((tab) => {
      const currentTabId = tab && typeof tab.id === 'number' ? tab.id : null;
      if (typeof requestedTabId === 'number' && typeof currentTabId === 'number' && currentTabId !== requestedTabId) {
        if (typeof sendResponse === 'function') {
          sendResponse({ ok: false, reason: 'tab-mismatch' });
        }
        return;
      }
      triggerOnboardingSearchOverlay();
      if (typeof sendResponse === 'function') {
        sendResponse({ ok: true });
      }
    });
    return true;
  }

  function getRuntimeLocale(callback) {
    const chromeApi = getChromeApi();
    const fromParam = params.get('locale') || params.get('lang') || '';
    if (fromParam) {
      callback(MODEL.normalizeLocale(fromParam));
      return;
    }
    if (!chromeApi || !chromeApi.storage) {
      callback(MODEL.normalizeLocale(getBrowserLocale()));
      return;
    }
    const settings = globalThis.LumnoSettings;
    const storageArea = settings.createProviderStorageRuntime(chromeApi).area;
    if (!storageArea || typeof storageArea.get !== 'function') {
      callback(MODEL.normalizeLocale(getBrowserLocale()));
      return;
    }
    try {
      storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
        const runtimeError = chromeApi.runtime ? chromeApi.runtime.lastError : null;
        const stored = !runtimeError && result ? result[LANGUAGE_STORAGE_KEY] : '';
        const locale = stored && stored !== 'system'
          ? stored
          : getBrowserLocale();
        callback(MODEL.normalizeLocale(locale));
      });
    } catch (e) {
      callback(MODEL.normalizeLocale(getBrowserLocale()));
    }
  }

  function getBrowserLocale() {
    const chromeApi = getChromeApi();
    if (chromeApi && chromeApi.i18n && typeof chromeApi.i18n.getUILanguage === 'function') {
      try {
        return chromeApi.i18n.getUILanguage() || navigator.language || 'en';
      } catch (error) {
        return navigator.language || 'en';
      }
    }
    return navigator.language || 'en';
  }

  function updateVersionChip() {
    const chromeApi = getChromeApi();
    const versionFromParams = (params.get('version') || '').trim();
    const manifestVersion = chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getManifest === 'function'
      ? String((chromeApi.runtime.getManifest() || {}).version || '').trim()
      : '';
    const version = versionFromParams || (manifestVersion ? `v${manifestVersion}` : '');
    if (!versionText) {
      return;
    }
    versionText.textContent = version || '';
    const chip = versionText.closest('.version-chip');
    if (chip) {
      chip.hidden = !version;
    }
  }


  function getBrowserTooltipText(browserAvatars) {
    const browsers = browserAvatars && Array.isArray(browserAvatars.browsers)
      ? browserAvatars.browsers
      : [];
    return browsers.map((browser) => browser && browser.name).filter(Boolean)
      .join(getRuntimeMiscText('browserNameSeparator', ', '));
  }

  function positionBrowserAvatarTooltip(element, target) {
    if (!element || !target || typeof target.getBoundingClientRect !== 'function') {
      return;
    }
    element.style.setProperty('max-width', '220px');
    element.style.setProperty('width', 'max-content');
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = element.getBoundingClientRect();
    const margin = 8;
    const spacing = 8;
    let left = targetRect.right + spacing;
    let top = targetRect.top + ((targetRect.height - tooltipRect.height) / 2);
    if (left + tooltipRect.width > window.innerWidth - margin) {
      left = targetRect.left - tooltipRect.width - spacing;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
    element.style.setProperty('left', `${Math.round(left)}px`);
    element.style.setProperty('top', `${Math.round(top)}px`);
  }

  function renderInfoTooltipContent(element, infoTooltip, browserAvatars) {
    if (!element) {
      return;
    }
    const tooltipView = globalThis.LumnoTooltipView;
    const isBrowserAvatarTooltip =
      infoTooltip && infoTooltip.type === 'browser-avatars';
    element.classList.toggle(
      'onboarding-browser-tooltip',
      isBrowserAvatarTooltip
    );
    if (!isBrowserAvatarTooltip ||
        typeof tooltipView.renderBrowserAvatarTooltip !== 'function') {
      return;
    }
    element.dataset.reactIsland = 'onboarding-info-tooltip-content';
    tooltipView.renderBrowserAvatarTooltip(element, {
      browsers: browserAvatars && Array.isArray(browserAvatars.browsers)
        ? browserAvatars.browsers
        : [],
      browserNameSeparator: getRuntimeMiscText(
        'browserNameSeparator',
        ', '
      ),
      browserAvatarSuffix: getRuntimeMiscText(
        'browserAvatarSuffix',
        'and more'
      )
    });
  }

  function showOnboardingInfoTooltip(button, infoTooltip, browserAvatars) {
    const text = String(infoTooltip && infoTooltip.text || getBrowserTooltipText(browserAvatars) || '').trim();
    if (!button || !text) {
      return;
    }
    const options = {
      placement: 'top',
      maxWidth: 360,
      spacing: infoTooltip && infoTooltip.type === 'browser-avatars' ? 24 : 8
    };
    const element = onboardingInfoTooltipController.show(button, text, options);
    renderInfoTooltipContent(element, infoTooltip, browserAvatars);
    if (infoTooltip && infoTooltip.type === 'browser-avatars') {
      positionBrowserAvatarTooltip(element, button);
    } else {
      globalThis.LumnoTooltip.position(element, button, options);
    }
  }

  function hideOnboardingInfoTooltip() {
    onboardingInfoTooltipController.hide();
  }

  function getActionButtonTooltipMaxWidth(button) {
    const value = Number.parseInt(button && button.dataset && button.dataset.tooltipMaxWidth || '', 10);
    return Number.isFinite(value) && value > 0 ? value : 360;
  }

  function showActionButtonTooltip(button) {
    const text = String(button && button.dataset && button.dataset.tooltip || '').trim();
    if (!button || !text) {
      return;
    }
    const maxWidth = getActionButtonTooltipMaxWidth(button);
    actionTooltipController.show(button, text, {
      placement: 'top',
      maxWidth,
      spacing: 8
    });
  }

  function hideActionButtonTooltip() {
    actionTooltipController.hide();
  }



  function updateInteractionAccordionRows() {
    if (!interactionSlots) {
      return;
    }
    interactionSlotsController.setExpandedAccordionId(
      expandedInteractionAccordionId
    );
  }

  function toggleInteractionAccordion(accordionId) {
    const id = String(accordionId || '').trim();
    if (!id) {
      return;
    }
    expandedInteractionAccordionId = expandedInteractionAccordionId === id ? '' : id;
    updateInteractionAccordionRows();
  }

  function renderInteractions(slide) {
    if (!interactionSlots) {
      return;
    }
    hideOnboardingInfoTooltip();
    const slots = Array.isArray(slide.left.interactionSlots)
      ? slide.left.interactionSlots
      : [];
    const hasAccordion = slots.some((slot) => slot.accordion && slot.accordion.text);
    interactionSlots.hidden = slots.length === 0;
    interactionSlots.dataset.visible = slots.length > 0 ? 'true' : 'false';
    interactionSlots.dataset.accordion = hasAccordion ? 'true' : 'false';
    interactionSlotsController.render({
      slots,
      expandedAccordionId: expandedInteractionAccordionId
    });
  }


  function getSiteSearchDemoBrandAccentRgb(item) {
    return item && Array.isArray(item.brandAccentRgb) && item.brandAccentRgb.length === 3
      ? item.brandAccentRgb
      : (item && Array.isArray(item.accentRgb) && item.accentRgb.length === 3 ? item.accentRgb : [59, 130, 246]);
  }

  function getSiteSearchDemoLuminance(rgb) {
    if (!Array.isArray(rgb) || rgb.length !== 3) {
      return 0;
    }
    const channels = rgb.map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function getSiteSearchDemoReadableTextColor(bgRgb) {
    const darkText = [17, 24, 39];
    const lightText = [248, 250, 252];
    const bgLum = getSiteSearchDemoLuminance(bgRgb);
    const darkLum = getSiteSearchDemoLuminance(darkText);
    const lightLum = getSiteSearchDemoLuminance(lightText);
    const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
    const contrastWithLight = (Math.max(bgLum, lightLum) + 0.05) / (Math.min(bgLum, lightLum) + 0.05);
    return contrastWithDark >= contrastWithLight ? '#111827' : '#F8FAFC';
  }

  function normalizeSiteSearchDemoAccentRgb(rgb) {
    const accentRgb = Array.isArray(rgb) && rgb.length === 3
      ? rgb
      : [59, 130, 246];
    const luminance = getSiteSearchDemoLuminance(accentRgb);
    if (luminance < 0.12) {
      return mixNewtabPreviewColor(accentRgb, [255, 255, 255], 0.55);
    }
    if (luminance > 0.9) {
      return mixNewtabPreviewColor(accentRgb, [0, 0, 0], 0.2);
    }
    return accentRgb;
  }

  function getSiteSearchDemoTheme(item) {
    const accentRgb = normalizeSiteSearchDemoAccentRgb(getSiteSearchDemoBrandAccentRgb(item));
    const base = [255, 255, 255];
    const markBg = mixNewtabPreviewColor(accentRgb, base, 0.78);
    const tagBg = mixNewtabPreviewColor(accentRgb, base, 0.74);
    const keyBg = mixNewtabPreviewColor(accentRgb, base, 0.9);
    return {
      accentRgb,
      highlightBg: mixNewtabPreviewColor(accentRgb, base, 0.86),
      highlightBorder: mixNewtabPreviewColor(accentRgb, base, 0.62),
      markBg,
      markText: getSiteSearchDemoReadableTextColor(markBg),
      tagBg,
      tagText: getSiteSearchDemoReadableTextColor(tagBg),
      tagBorder: mixNewtabPreviewColor(accentRgb, base, 0.58),
      keyBg,
      keyText: getSiteSearchDemoReadableTextColor(keyBg),
      keyBorder: mixNewtabPreviewColor(accentRgb, base, 0.18),
      buttonText: getSiteSearchDemoLuminance(accentRgb) > 0.8
        ? mixNewtabPreviewColor(accentRgb, [0, 0, 0], 0.6)
        : accentRgb,
      buttonBg: mixNewtabPreviewColor(accentRgb, base, 0.94),
      buttonBorder: mixNewtabPreviewColor(accentRgb, base, 0.7)
    };
  }


  function renderVisualSurface(slide) {
    if (!visualStage) {
      return;
    }
    visualSurfaceController.clear();
    visualStage.classList.remove('is-visual-exit');
    if (cursorLayer) {
      cursorLayer.classList.remove('is-visual-exit');
    }
    visualStage.dataset.visualKind = slide.visual.kind;
    if (slide.visual.visible) {
      visualSurfaceController.render({
          ariaLabel: 'Lumno',
          bookmarkFocus: {
            hoverLeadMs: LUMNO_OVERLAY_HOVER_LEAD_MS,
            hoverStartMs: LUMNO_OVERLAY_HOVER_START_MS,
            hoverStepMs: LUMNO_OVERLAY_HOVER_STEP_MS,
            hoverWrapStepMs: LUMNO_OVERLAY_HOVER_WRAP_STEP_MS,
            openLabel: getRuntimeMiscText('openLabel', 'Open'),
            overlayAriaLabel: 'Lumno overlay demo',
            panelId: ONBOARDING_OVERLAY_DEMO_PANEL_ID,
            query: getLumnoOverlayQuery(),
            reducedMotion: prefersReducedMotion(),
            removeHistoryLabel: getRuntimeMiscText(
              'removeHistoryLabel',
              'Remove history item'
            ),
            results: getLumnoOverlayResults(),
            searchAriaLabel: 'Search Lumno demo',
            settingsLabel: getRuntimeMiscText('settingsLabel', 'Settings')
          },
          butterflyDValues: LUMNO_WEB_BUTTERFLY_D_VALUES,
          butterflyRestPath: LUMNO_WEB_BUTTERFLY_REST_PATH,
          featureAwards: getFeatureAwards(),
          featureCardAriaJoiner: getRuntimeMiscText('featureCardAriaJoiner', ', '),
          featureCards: getFeatureCards(),
          homepagePipArtSrc: HOMEPAGE_PIP_ART_SRC,
          kind: slide.visual.kind,
          newtabPreview: {
            ariaLabel: getRuntimeMiscText(
              'newtabPreviewAriaLabel',
              'Lumno new tab preview'
            ),
            bookmarkManagerLabel: getRuntimeMiscText(
              'bookmarkManagerLabel',
              'Open bookmark manager'
            ),
            bookmarks: getNewtabPreviewBookmarks(),
            bookmarksSectionTitle: getNewtabPreviewSectionTitle(
              'bookmarks',
              'Bookmarks'
            ),
            hoverHoldMs: NEWTAB_PREVIEW_HOVER_HOLD_MS,
            hoverMoveMs: NEWTAB_PREVIEW_HOVER_MOVE_MS,
            hoverSettleMs: NEWTAB_PREVIEW_HOVER_SETTLE_MS,
            hoverStartMs: NEWTAB_PREVIEW_HOVER_START_MS,
            nextLabelTemplate: getRuntimeMiscText(
              'nextLabelTemplate',
              '{label} next'
            ),
            openItemAriaTemplate: getRuntimeMiscText(
              'openItemAriaTemplate',
              'Open {title}'
            ),
            previousLabelTemplate: getRuntimeMiscText(
              'previousLabelTemplate',
              '{label} previous'
            ),
            query: getNewtabPreviewQuery(),
            recentSectionTitle: getNewtabPreviewSectionTitle(
              'recent',
              'Recent'
            ),
            recentSites: getNewtabPreviewRecentSites(),
            reducedMotion: prefersReducedMotion(),
            searchAriaLabel: getRuntimeMiscText(
              'newtabSearchPreviewAriaLabel',
              'Lumno new tab search preview'
            ),
            searchPlaceholder: getRuntimeMiscText(
              'newtabSearchPlaceholder',
              'Search or enter URL…'
            ),
            sectionModeBookmarksLabel: getRuntimeMiscText(
              'sectionModeBookmarksLabel',
              'Bookmarks display mode'
            ),
            sectionModeRecentLabel: getRuntimeMiscText(
              'sectionModeRecentLabel',
              'Recent display mode'
            ),
            settingsLabel: getRuntimeMiscText('settingsLabel', 'Settings'),
            visitLabel: getRuntimeMiscText('goLabel', 'Visit'),
            wordmarkSrc: NEWTAB_PREVIEW_WORDMARK_SRC
          },
          newtabFiltersArtSrc: NEWTAB_FILTERS_ART_SRC,
          practicalFeaturesAriaLabel: getRuntimeMiscText(
            'practicalFeaturesAriaLabel',
            'Lumno practical features'
          ),
          principlesAriaLabel: getRuntimeMiscText(
            'principlesAriaLabel',
            'Lumno principles'
          ),
          siteSearchCases: getSiteSearchDemoCases().map((item) => (
            Object.assign({}, item, { theme: getSiteSearchDemoTheme(item) })
          )),
          siteSearchDemoAriaLabel: getRuntimeMiscText(
            'siteSearchDemoAriaLabel',
            'Lumno site search demo'
          ),
          siteSearchOpenLabel: getRuntimeMiscText('openLabel', 'Open'),
          siteSearchSettingsLabel: getRuntimeMiscText(
            'settingsLabel',
            'Settings'
          ),
          siteSearchTabHintTemplate: String(
            getRuntimeSection('siteSearchDemo').tabHintTemplate ||
              'Search with {provider}'
          ),
          wordmarkSrc: LUMNO_WEB_WORDMARK_SRC
        });
    }
    renderCursor(slide);
  }

  function prepareVisualExit(nextState) {
    if (!blueprint || !state || !nextState || !visualStage || prefersReducedMotion()) {
      return;
    }
    const currentSlide = MODEL.getSlideByIndex(blueprint, state.index);
    const nextSlide = MODEL.getSlideByIndex(blueprint, nextState.index);
    const shouldBlurOut =
      currentSlide &&
      nextSlide &&
      currentSlide.visual &&
      nextSlide.visual &&
      currentSlide.visual.kind === 'bookmark-focus-surface' &&
      nextSlide.visual.kind === 'lumno-web-wordmark-surface';
    if (!shouldBlurOut) {
      return;
    }
    visualStage.classList.add('is-visual-exit');
    if (cursorLayer) {
      cursorLayer.classList.add('is-visual-exit');
    }
  }

  function renderCopyActions(slide) {
    if (!copyActions) {
      return;
    }
    copyActionsController.render(slide.actions || {});
  }

  function renderCursor(slide) {
    if (!cursorLayer) {
      return;
    }
    cursorLayerController.render({
      enabled: slide.cursor.enabled,
      mode: slide.cursor.enabled ? slide.id : ''
    });
  }

  function renderBodyCopy(slide) {
    if (!body) {
      return;
    }
    bodyCopyController.render({
      note: String(slide.copy.note || ''),
      shortcutLabel: currentShortcutLabel,
      shortcutPlaceholder: SHORTCUT_PLACEHOLDER,
      shortcutTokens: getShortcutDisplayTokens(currentShortcutValue),
      shortcutValue: normalizeShortcutValue(currentShortcutValue),
      value: String(slide.copy.body || '')
    });
  }

  function renderPageStrip() {
    if (!pageStrip || !blueprint || !state) {
      return;
    }
    const wasPageStripHidden = pageStrip.hidden;
    pageStrip.hidden = state.index <= 0;
    pageStrip.dataset.entering =
      wasPageStripHidden && !pageStrip.hidden ? 'true' : 'false';
    const pageCount = Math.max(1, blueprint.slides.length - 1);
    const currentPageIndex = Math.max(0, state.index - 1);
    pageStrip.style.setProperty('--page-strip-count', String(pageCount));
    const ariaLabel = formatRuntimeTemplate(
      getRuntimeMiscText(
        'pageStripAriaTemplate',
        'Onboarding navigation, page {current} of {total}'
      ),
      { current: currentPageIndex + 1, total: pageCount }
    );
    pageStrip.setAttribute('aria-label', ariaLabel);
    pageStripController.render({
      pageCount,
      currentPageIndex,
      hidden: pageStrip.hidden,
      entering: pageStrip.dataset.entering === 'true',
      ariaLabel,
      segmentAriaLabels: Array.from(
        { length: pageCount },
        (_, pageIndex) =>
          formatRuntimeTemplate(
            getRuntimeMiscText('pageSegmentAriaTemplate', 'Page {page}'),
            { page: pageIndex + 1 }
          )
      )
    });
  }

  function getTitleFitLines() {
    if (!title) {
      return [];
    }
    const lines = Array.from(title.querySelectorAll('.title-line'));
    return lines.length > 0 ? lines : [title];
  }

  function updateTitleFitScale() {
    if (!title) {
      return;
    }
    title.style.setProperty('--title-fit-scale', '1');
    if (title.dataset.empty === 'true') {
      return;
    }
    const availableWidth = title.clientWidth;
    if (!availableWidth) {
      return;
    }
    const widestLine = getTitleFitLines().reduce((maxWidth, line) => {
      return Math.max(maxWidth, line.scrollWidth || line.getBoundingClientRect().width || 0);
    }, 0);
    if (!widestLine) {
      return;
    }
    const scale = Math.max(0.78, Math.min(1, availableWidth / widestLine));
    title.style.setProperty('--title-fit-scale', scale.toFixed(3));
  }

  function scheduleTitleFitUpdate() {
    if (!title || typeof window.requestAnimationFrame !== 'function') {
      updateTitleFitScale();
      return;
    }
    if (titleFitFrame) {
      window.cancelAnimationFrame(titleFitFrame);
    }
    titleFitFrame = window.requestAnimationFrame(() => {
      titleFitFrame = 0;
      updateTitleFitScale();
    });
  }

  function isFrameScaledOnboardingLayout() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 1240px) and (min-width: 860px), (max-height: 760px) and (min-height: 560px) and (min-width: 860px)').matches;
  }

  function isStackedOnboardingLayout() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 859px), (max-height: 559px)').matches;
  }

  function resetStackedLayoutScroll() {
    if (!root || !isStackedOnboardingLayout()) {
      return;
    }
    root.scrollTop = 0;
    if (typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    window.requestAnimationFrame(() => {
      if (!root || !isStackedOnboardingLayout()) {
        return;
      }
      root.scrollTop = 0;
    });
  }

  function updateOnboardingFrameScale() {
    if (!root) {
      return;
    }
    const shouldScaleFrame = isFrameScaledOnboardingLayout();
    const viewportWidth = window.innerWidth || root.clientWidth || ONBOARDING_FRAME_WIDTH;
    const viewportHeight = window.innerHeight || root.clientHeight || ONBOARDING_FRAME_HEIGHT;
    const scale = shouldScaleFrame
      ? Math.max(0.1, Math.min(1, viewportWidth / ONBOARDING_FRAME_WIDTH, viewportHeight / ONBOARDING_FRAME_HEIGHT))
      : 1;
    root.style.setProperty('--onboarding-frame-scale', scale.toFixed(3));
    root.style.setProperty('--onboarding-frame-rendered-width', `${(ONBOARDING_FRAME_WIDTH * scale).toFixed(2)}px`);
    root.style.setProperty('--onboarding-frame-rendered-height', `${(ONBOARDING_FRAME_HEIGHT * scale).toFixed(2)}px`);
  }

  function getCompactCopyContentHeight() {
    if (!copyPanel) {
      return 0;
    }
    const panelStyle = window.getComputedStyle(copyPanel);
    const paddingTop = parseFloat(panelStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(panelStyle.paddingBottom) || 0;
    const rowGap = parseFloat(panelStyle.rowGap || panelStyle.gap) || 0;
    const rows = [
      copyPanel.querySelector('.copy-block'),
      copyPanel.querySelector('.interaction-slots'),
      copyPanel.querySelector('.onboarding-copy-actions')
    ].filter((element) => {
      if (!element || element.hidden) {
        return false;
      }
      const elementStyle = window.getComputedStyle(element);
      return elementStyle.display !== 'none' && elementStyle.visibility !== 'hidden';
    });
    const rowsHeight = rows.reduce((sum, element) => (
      sum + element.getBoundingClientRect().height
    ), 0);
    return paddingTop + paddingBottom + rowsHeight + (Math.max(0, rows.length - 1) * rowGap);
  }

  function updateVisualCanvasScale() {
    if (!root || !visualSlot || !visualPanel || !visualCanvas) {
      return;
    }
    updateOnboardingFrameScale();
    const rect = visualSlot.getBoundingClientRect();
    const isCompactLayout = isStackedOnboardingLayout();
    const viewportWidth = window.innerWidth || root.clientWidth || VISUAL_CANVAS_WIDTH;
    const viewportHeight = window.innerHeight || root.clientHeight || VISUAL_CANVAS_HEIGHT;
    const availableWidth = isCompactLayout
      ? Math.min(viewportWidth, visualSlot.clientWidth || rect.width || viewportWidth)
      : (visualSlot.clientWidth || rect.width || 0);
    if (isCompactLayout) {
      // A previous oversized visual squeezes the copy rows (min-height: 0), so
      // collapse it first and measure the copy at its natural height.
      root.style.setProperty('--onboarding-visual-rendered-height', '0px');
    }
    const compactVisualHeight = Math.max(0, viewportHeight - getCompactCopyContentHeight());
    const availableHeight = isCompactLayout
      ? compactVisualHeight
      : (visualSlot.clientHeight || rect.height || 0);
    if (!availableWidth || (!isCompactLayout && !availableHeight)) {
      return;
    }
    const scale = isCompactLayout
      ? Math.max(0.1, Math.min(availableWidth / VISUAL_CANVAS_WIDTH, availableHeight / VISUAL_CANVAS_HEIGHT))
      : Math.max(0.1, Math.min(1, availableWidth / VISUAL_CANVAS_WIDTH, availableHeight / VISUAL_CANVAS_HEIGHT));
    root.style.setProperty('--onboarding-visual-scale', scale.toFixed(3));
    root.style.setProperty('--onboarding-visual-rendered-width', `${(VISUAL_CANVAS_WIDTH * scale).toFixed(2)}px`);
    root.style.setProperty('--onboarding-visual-rendered-height', `${(VISUAL_CANVAS_HEIGHT * scale).toFixed(2)}px`);
  }

  function scheduleVisualCanvasScaleUpdate() {
    if (!visualCanvas || typeof window.requestAnimationFrame !== 'function') {
      updateVisualCanvasScale();
      return;
    }
    if (visualScaleFrame) {
      window.cancelAnimationFrame(visualScaleFrame);
    }
    visualScaleFrame = window.requestAnimationFrame(() => {
      visualScaleFrame = 0;
      updateVisualCanvasScale();
    });
  }


  function renderTitleCopy(slide) {
    if (!title) {
      return;
    }
    copyHeadingController.render({
      cycleFirstDelayMs: TITLE_CYCLE_FIRST_DELAY_MS,
      cycleIntervalMs: TITLE_CYCLE_INTERVAL_MS,
      eyebrow: String(slide.copy.eyebrow || ''),
      reducedMotion: prefersReducedMotion(),
      swapDurationMs: getTextSwapDurationMs(),
      title: String(slide.copy.title || ''),
      titleCycle: slide.copy.titleCycle || null,
      titleLines: Array.isArray(slide.copy.titleLines)
        ? slide.copy.titleLines
        : [],
      titleLogo: slide.copy.titleLogo || null
    });
  }

  function render() {
    if (!blueprint || !state) {
      return;
    }
    const slide = MODEL.getSlideByIndex(blueprint, state.index);
    if (!slide || !root) {
      return;
    }
    root.dataset.activeSlide = slide.id;
    root.dataset.activeIndex = String(state.index);
    root.dataset.direction = state.direction;
    root.dataset.cursorReady = slide.cursor.enabled ? 'true' : 'false';
    root.dataset.visualVisible = slide.visual.visible ? 'true' : 'false';
    document.documentElement.lang = blueprint.htmlLang || 'en';
    document.title = `${blueprint.brand} Onboarding`;

    if (copyPanel) {
      copyPanel.dataset.slideId = slide.id;
    }
    renderPageStrip();
    renderTitleCopy(slide);
    renderBodyCopy(slide);
    renderInteractions(slide);
    renderCopyActions(slide);
    renderVisualSurface(slide);
    scheduleVisualCanvasScaleUpdate();
  }

  function getCopySwapTargets() {
    return [title, body].filter(Boolean);
  }

  function clearCopySwapClasses() {
    getCopySwapTargets().forEach((element) => {
      element.classList.remove('t-copy-swap', 'is-exit', 'is-enter-start');
    });
  }

  function clearCursorTransitionStart() {
    if (!root) {
      return;
    }
    root.style.removeProperty('--onboarding-cursor-transition-left');
    root.style.removeProperty('--onboarding-cursor-transition-top');
    root.style.removeProperty('--onboarding-cursor-transition-transform');
  }

  function captureCursorTransitionStart(nextState) {
    if (!root || !blueprint || !state || !nextState || !cursorLayer) {
      clearCursorTransitionStart();
      return;
    }
    const currentSlide = MODEL.getSlideByIndex(blueprint, state.index);
    const nextSlide = MODEL.getSlideByIndex(blueprint, nextState.index);
    const shouldCapture =
      currentSlide &&
      nextSlide &&
      (
        (currentSlide.id === 'intro' && nextSlide.id === 'setup') ||
        (currentSlide.id === 'setup' && nextSlide.id === 'search') ||
        (currentSlide.id === 'search' && nextSlide.id === 'newtab') ||
        (currentSlide.id === 'newtab' && nextSlide.id === 'finish')
      ) &&
      nextState.direction === 'forward';
    if (!shouldCapture) {
      clearCursorTransitionStart();
      return;
    }
    const cursor = cursorLayer.querySelector('.demo-cursor');
    if (!cursor) {
      clearCursorTransitionStart();
      return;
    }
    const style = getComputedStyle(cursor);
    const leftPx = Number.parseFloat(style.left);
    const topPx = Number.parseFloat(style.top);
    const layerWidth = cursorLayer.clientWidth;
    const layerHeight = cursorLayer.clientHeight;
    if (!Number.isFinite(leftPx) || !Number.isFinite(topPx) || !layerWidth || !layerHeight) {
      clearCursorTransitionStart();
      return;
    }
    const left = (leftPx / layerWidth) * 100;
    const top = (topPx / layerHeight) * 100;
    const transform = String(style.transform || '').trim();
    root.style.setProperty('--onboarding-cursor-transition-left', `${Math.max(0, Math.min(100, left)).toFixed(2)}%`);
    root.style.setProperty('--onboarding-cursor-transition-top', `${Math.max(0, Math.min(100, top)).toFixed(2)}%`);
    if (transform && transform !== 'none') {
      root.style.setProperty('--onboarding-cursor-transition-transform', transform);
    } else {
      root.style.removeProperty('--onboarding-cursor-transition-transform');
    }
  }

  function commitState(nextState) {
    state = nextState;
    syncOnboardingSlideParam(state.index);
    render();
    resetStackedLayoutScroll();
  }

  function animateCopySwap(nextState) {
    if (copySwapTimeout) {
      window.clearTimeout(copySwapTimeout);
      copySwapTimeout = 0;
    }
    const targets = getCopySwapTargets();
    if (targets.length === 0 || prefersReducedMotion()) {
      clearCopySwapClasses();
      captureCursorTransitionStart(nextState);
      commitState(nextState);
      return;
    }
    prepareVisualExit(nextState);
    targets.forEach((element) => {
      element.classList.add('t-copy-swap');
      element.classList.remove('is-enter-start');
      element.classList.add('is-exit');
    });
    copySwapTimeout = window.setTimeout(() => {
      copySwapTimeout = 0;
      captureCursorTransitionStart(nextState);
      commitState(nextState);
      const nextTargets = getCopySwapTargets();
      nextTargets.forEach((element) => {
        element.classList.add('t-copy-swap', 'is-enter-start');
        element.classList.remove('is-exit');
      });
      nextTargets.forEach((element) => {
        void element.offsetHeight;
      });
      nextTargets.forEach((element) => {
        element.classList.remove('is-enter-start');
      });
    }, getTextSwapDurationMs());
  }

  function dispatch(action) {
    if (!state || !blueprint) {
      return;
    }
    const nextState = MODEL.reduceOnboardingState(state, action);
    if (nextState.index === state.index || nextState.direction === 'none') {
      commitState(nextState);
      return;
    }
    animateCopySwap(nextState);
  }

  function runExtensionAction(actionTarget, event) {
    const target = typeof actionTarget === 'string' ? null : actionTarget;
    const id = typeof actionTarget === 'string'
      ? String(actionTarget || '')
      : String(target && target.dataset && target.dataset.action || '');
    if (!id) {
      return;
    }
    const disposition = getOpenDisposition(event, 'newTab');
    if (id === 'next') {
      dispatch({ type: 'NEXT' });
      return;
    }
    if (id === 'prev') {
      dispatch({ type: 'PREV' });
      return;
    }
    if (id === 'toggleInteractionAccordion') {
      toggleInteractionAccordion(target && target.dataset && target.dataset.accordionId);
      return;
    }
    if (id === 'openChromeWebStore') {
      openExternalTab(COMMUNITY_LINKS.getStoreListing().url, disposition);
      return;
    }
    if (id === 'openNewtab') {
      if (disposition !== 'backgroundTab') {
        if (navigateOnboardingToNewtab()) {
          return;
        }
      }
    }

    const chromeApi = getChromeApi();
    const messageAction = ACTION_MESSAGE_BY_ID[id];
    if (!messageAction || !chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.sendMessage !== 'function') {
      if (id === 'openSiteSearchOptions') {
        openSiteSearchOptionsFallback(disposition);
      }
      return;
    }
    try {
      chromeApi.runtime.sendMessage({
        action: messageAction,
        disposition
      }, (response) => {
        const lastError = chromeApi.runtime && chromeApi.runtime.lastError;
        if (id === 'openSiteSearchOptions' && (lastError || !response || response.ok === false)) {
          openSiteSearchOptionsFallback(disposition);
        }
      });
    } catch (error) {
      if (id === 'openSiteSearchOptions') {
        openSiteSearchOptionsFallback(disposition);
      }
    }
  }

  document.addEventListener('click', (event) => {
    const accordionLinkTarget = event.target && event.target.closest
      ? event.target.closest('.interaction-accordion-link[data-action]')
      : null;
    if (accordionLinkTarget) {
      event.preventDefault();
      runExtensionAction(accordionLinkTarget, event);
      return;
    }
    if (event.target && event.target.closest && event.target.closest('.interaction-accordion-panel')) {
      return;
    }
    const target = event.target && event.target.closest
      ? event.target.closest('[data-action], [data-slide-target]')
      : null;
    if (!target) {
      return;
    }
    event.preventDefault();
    if (target.dataset.slideTarget) {
      dispatch({ type: 'GOTO', index: Number(target.dataset.slideTarget) });
      return;
    }
    runExtensionAction(target, event);
  });

  document.addEventListener('auxclick', (event) => {
    if (!event || Number(event.button) !== 1) {
      return;
    }
    const target = event.target && event.target.closest
      ? event.target.closest('.interaction-accordion-link[data-action]')
      : null;
    if (!target) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    runExtensionAction(target, event);
  });

  document.addEventListener('keydown', (event) => {
    if (!event || event.defaultPrevented) {
      return;
    }
    if (shortcutHotkeyMatchesEvent(currentShortcutValue, event)) {
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      triggerOnboardingSearchOverlay();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      dispatch({ type: 'NEXT' });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      dispatch({ type: 'PREV' });
    } else if (event.key === 'Home') {
      event.preventDefault();
      dispatch({ type: 'HOME' });
    } else if (event.key === 'End') {
      event.preventDefault();
      dispatch({ type: 'END' });
    }
  });

  const initialChromeApi = getChromeApi();
  if (initialChromeApi &&
      initialChromeApi.runtime &&
      initialChromeApi.runtime.onMessage &&
      typeof initialChromeApi.runtime.onMessage.addListener === 'function') {
    initialChromeApi.runtime.onMessage.addListener(handleOnboardingCommandMessage);
  }

  scheduleTitleFitUpdate();
  scheduleVisualCanvasScaleUpdate();
  window.addEventListener('resize', () => {
    scheduleTitleFitUpdate();
    scheduleVisualCanvasScaleUpdate();
  });
  if (visualSlot && typeof ResizeObserver === 'function') {
    visualResizeObserver = new ResizeObserver(scheduleVisualCanvasScaleUpdate);
    visualResizeObserver.observe(visualSlot);
  }

  getRuntimeLocale((locale) => {
    blueprint = MODEL.getOnboardingBlueprint(locale);
    runtimeCopy = blueprint.runtimeCopy || runtimeCopy;
    const requestedIndex = Number(params.get('slide') || 0);
    state = MODEL.createOnboardingState(blueprint.slides.length, requestedIndex);
    updateVersionChip();
    render();
    refreshCurrentShortcut(true);
  });

  window.addEventListener('focus', () => refreshCurrentShortcut(true), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshCurrentShortcut(true);
    }
  }, true);
})();
