// What the onboarding visuals show, from the slides' copy: the Lumno
// wordmark, the overlay and New Tab demos with their timing, the site search
// demo in each site's colors, and the feature cards.
import * as COMMUNITY_LINKS from '../../platform/community-links';
import type { OnboardingRuntimeCopy } from '../onboarding-content';
import type { NewtabPreviewItem } from '../react/newtab-preview';
import type { SiteSearchTheme } from '../react/site-search-demo';
import type { VisualSurfaceRenderModel } from '../react/visual-surface';

type RuntimeMiscKey = keyof OnboardingRuntimeCopy['misc'];
type SiteSearchCase = OnboardingRuntimeCopy['siteSearchDemo']['cases'][number];
type Rgb = readonly number[];

// The demo recent-site card points at Lumno's own listing, so it follows the
// store this copy was installed from.
const STORE_ACCENT_RGB = Object.freeze({
  chrome: Object.freeze([66, 133, 244]),
  edge: Object.freeze([0, 120, 212]),
  firefox: Object.freeze([255, 113, 57])
});
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

function getRuntimeMiscText(copy: OnboardingRuntimeCopy, key: RuntimeMiscKey, fallback: string): string {
  return String(copy.misc[key] || '').trim() || fallback;
}

function getLumnoOverlayQuery(copy: OnboardingRuntimeCopy): string {
  return String(copy.lumnoOverlay.query || 'extension');
}

function getNewtabPreviewRecentSites(copy: OnboardingRuntimeCopy): NewtabPreviewItem[] {
  return copy.newtabPreview.recentSites.map((item) => {
    if (item.url.trim() !== 'chromeWebStore') {
      return Object.assign({}, item);
    }
    const listing = COMMUNITY_LINKS.getStoreListing();
    return Object.assign({}, item, {
      title: `Lumno - ${listing.name}`,
      siteName: listing.name,
      url: listing.url,
      urlText: listing.host,
      accentRgb: STORE_ACCENT_RGB[listing.id]
    });
  });
}

function getNewtabPreviewSectionTitle(copy: OnboardingRuntimeCopy, key: 'bookmarks' | 'recent', fallback: string): string {
  return String(copy.newtabPreview.sections[key] || fallback);
}

function mixSiteSearchDemoColor(color: Rgb, target: Rgb, amount: number): number[] {
  return [
    Math.round(color[0] + (target[0] - color[0]) * amount),
    Math.round(color[1] + (target[1] - color[1]) * amount),
    Math.round(color[2] + (target[2] - color[2]) * amount)
  ];
}

function getSiteSearchDemoBrandAccentRgb(item: SiteSearchCase): Rgb {
  return item.brandAccentRgb.length === 3 ? item.brandAccentRgb : [59, 130, 246];
}

function getSiteSearchDemoLuminance(rgb: Rgb): number {
  if (rgb.length !== 3) {
    return 0;
  }
  const channels = rgb.map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function getSiteSearchDemoReadableTextColor(bgRgb: Rgb): string {
  const darkText = [17, 24, 39];
  const lightText = [248, 250, 252];
  const bgLum = getSiteSearchDemoLuminance(bgRgb);
  const darkLum = getSiteSearchDemoLuminance(darkText);
  const lightLum = getSiteSearchDemoLuminance(lightText);
  const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
  const contrastWithLight = (Math.max(bgLum, lightLum) + 0.05) / (Math.min(bgLum, lightLum) + 0.05);
  return contrastWithDark >= contrastWithLight ? '#111827' : '#F8FAFC';
}

function normalizeSiteSearchDemoAccentRgb(rgb: Rgb): Rgb {
  const accentRgb = rgb.length === 3 ? rgb : [59, 130, 246];
  const luminance = getSiteSearchDemoLuminance(accentRgb);
  if (luminance < 0.12) {
    return mixSiteSearchDemoColor(accentRgb, [255, 255, 255], 0.55);
  }
  if (luminance > 0.9) {
    return mixSiteSearchDemoColor(accentRgb, [0, 0, 0], 0.2);
  }
  return accentRgb;
}

function getSiteSearchDemoTheme(item: SiteSearchCase): SiteSearchTheme {
  const accentRgb = normalizeSiteSearchDemoAccentRgb(getSiteSearchDemoBrandAccentRgb(item));
  const base = [255, 255, 255];
  const markBg = mixSiteSearchDemoColor(accentRgb, base, 0.78);
  const keyBg = mixSiteSearchDemoColor(accentRgb, base, 0.9);
  return {
    accentRgb,
    highlightBg: mixSiteSearchDemoColor(accentRgb, base, 0.86),
    highlightBorder: mixSiteSearchDemoColor(accentRgb, base, 0.62),
    markBg,
    markText: getSiteSearchDemoReadableTextColor(markBg),
    keyBg,
    keyText: getSiteSearchDemoReadableTextColor(keyBg),
    keyBorder: mixSiteSearchDemoColor(accentRgb, base, 0.18),
    buttonText: getSiteSearchDemoLuminance(accentRgb) > 0.8
      ? mixSiteSearchDemoColor(accentRgb, [0, 0, 0], 0.6)
      : accentRgb,
    buttonBg: mixSiteSearchDemoColor(accentRgb, base, 0.94),
    buttonBorder: mixSiteSearchDemoColor(accentRgb, base, 0.7)
  };
}


function getBookmarkFocusModel(copy: OnboardingRuntimeCopy, reducedMotion: boolean): VisualSurfaceRenderModel['bookmarkFocus'] {
  return {
    hoverLeadMs: LUMNO_OVERLAY_HOVER_LEAD_MS,
    hoverStartMs: LUMNO_OVERLAY_HOVER_START_MS,
    hoverStepMs: LUMNO_OVERLAY_HOVER_STEP_MS,
    hoverWrapStepMs: LUMNO_OVERLAY_HOVER_WRAP_STEP_MS,
    openLabel: getRuntimeMiscText(copy, 'openLabel', 'Open'),
    overlayAriaLabel: 'Lumno overlay demo',
    panelId: ONBOARDING_OVERLAY_DEMO_PANEL_ID,
    query: getLumnoOverlayQuery(copy),
    reducedMotion,
    removeHistoryLabel: getRuntimeMiscText(copy, 'removeHistoryLabel', 'Remove history item'),
    results: copy.lumnoOverlay.results,
    searchAriaLabel: 'Search Lumno demo',
    settingsLabel: getRuntimeMiscText(copy, 'settingsLabel', 'Settings')
  };
}

function getNewtabPreviewModel(copy: OnboardingRuntimeCopy, reducedMotion: boolean): VisualSurfaceRenderModel['newtabPreview'] {
  return {
    ariaLabel: getRuntimeMiscText(copy, 'newtabPreviewAriaLabel', 'Lumno new tab preview'),
    bookmarkManagerLabel: getRuntimeMiscText(copy, 'bookmarkManagerLabel', 'Open bookmark manager'),
    bookmarks: copy.newtabPreview.bookmarks,
    bookmarksSectionTitle: getNewtabPreviewSectionTitle(copy, 'bookmarks', 'Bookmarks'),
    hoverHoldMs: NEWTAB_PREVIEW_HOVER_HOLD_MS,
    hoverMoveMs: NEWTAB_PREVIEW_HOVER_MOVE_MS,
    hoverSettleMs: NEWTAB_PREVIEW_HOVER_SETTLE_MS,
    hoverStartMs: NEWTAB_PREVIEW_HOVER_START_MS,
    nextLabelTemplate: getRuntimeMiscText(copy, 'nextLabelTemplate', '{label} next'),
    openItemAriaTemplate: getRuntimeMiscText(copy, 'openItemAriaTemplate', 'Open {title}'),
    previousLabelTemplate: getRuntimeMiscText(copy, 'previousLabelTemplate', '{label} previous'),
    query: String(copy.newtabPreview.query || ''),
    recentSectionTitle: getNewtabPreviewSectionTitle(copy, 'recent', 'Recent'),
    recentSites: getNewtabPreviewRecentSites(copy),
    reducedMotion,
    searchAriaLabel: getRuntimeMiscText(copy, 'newtabSearchPreviewAriaLabel', 'Lumno new tab search preview'),
    searchPlaceholder: getRuntimeMiscText(copy, 'newtabSearchPlaceholder', 'Search or enter URL…'),
    sectionModeBookmarksLabel: getRuntimeMiscText(copy, 'sectionModeBookmarksLabel', 'Bookmarks display mode'),
    sectionModeRecentLabel: getRuntimeMiscText(copy, 'sectionModeRecentLabel', 'Recent display mode'),
    settingsLabel: getRuntimeMiscText(copy, 'settingsLabel', 'Settings'),
    visitLabel: getRuntimeMiscText(copy, 'goLabel', 'Visit'),
    wordmarkSrc: NEWTAB_PREVIEW_WORDMARK_SRC
  };
}

function getVisualSurfaceModel(copy: OnboardingRuntimeCopy, kind: string, reducedMotion: boolean): VisualSurfaceRenderModel {
  return {
    ariaLabel: 'Lumno',
    bookmarkFocus: getBookmarkFocusModel(copy, reducedMotion),
    butterflyDValues: LUMNO_WEB_BUTTERFLY_D_VALUES,
    butterflyRestPath: LUMNO_WEB_BUTTERFLY_REST_PATH,
    featureAwards: copy.featureAwards,
    featureCardAriaJoiner: getRuntimeMiscText(copy, 'featureCardAriaJoiner', ', '),
    featureCards: copy.featureCards,
    homepagePipArtSrc: HOMEPAGE_PIP_ART_SRC,
    kind,
    newtabPreview: getNewtabPreviewModel(copy, reducedMotion),
    newtabFiltersArtSrc: NEWTAB_FILTERS_ART_SRC,
    practicalFeaturesAriaLabel: getRuntimeMiscText(copy, 'practicalFeaturesAriaLabel', 'Lumno practical features'),
    principlesAriaLabel: getRuntimeMiscText(copy, 'principlesAriaLabel', 'Lumno principles'),
    siteSearchCases: copy.siteSearchDemo.cases.map((item) => (
      Object.assign({}, item, { theme: getSiteSearchDemoTheme(item) })
    )),
    siteSearchDemoAriaLabel: getRuntimeMiscText(copy, 'siteSearchDemoAriaLabel', 'Lumno site search demo'),
    siteSearchOpenLabel: getRuntimeMiscText(copy, 'openLabel', 'Open'),
    siteSearchSettingsLabel: getRuntimeMiscText(copy, 'settingsLabel', 'Settings'),
    siteSearchTabHintTemplate: String(
      copy.siteSearchDemo.tabHintTemplate || 'Search with {provider}'
    ),
    wordmarkSrc: LUMNO_WEB_WORDMARK_SRC
  };
}

export { getRuntimeMiscText, getVisualSurfaceModel };
