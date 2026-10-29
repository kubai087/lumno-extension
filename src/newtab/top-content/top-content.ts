// The wordmark/clock area above the search box. Moving the blocks around
// it when it shows, hides or changes height is layout-motion.ts's job.
import { getWordmarkContent } from '../dom/top-content';
import { createTopContentController } from '../react/wordmark';
import type { TopContentState } from '../react/wordmark';
import { createViewStore } from '../../shared/react/view-store';
import type { WordmarkAppearance } from '../react/wordmark';
import type { PageNavigation } from '../page-navigation';
import { WORDMARK_ENTRY_ANIMATION_NAME } from '../newtab-config';
import * as SettingsStorage from '../../platform/settings-storage';
import type { SettingsStore } from '../../platform/settings-store';
import type { SettingPreview } from '../setting-preview';
import {
  NEWTAB_TOP_CONTENT_SETTINGS,
  getFixedTimeInk,
  newtabTime12Hour,
  newtabTimeFont,
  newtabTimeFontSize,
  newtabTimeFontWeight,
  newtabTimeInk,
  newtabTimeOpacity,
  newtabTimeSecondsVisible,
  newtabTopContentMode
} from '../../domain/settings/newtab-time';
import { newtabZenMode } from '../../domain/settings/newtab-page';
import * as COMMUNITY_LINKS from '../../platform/community-links';
import * as SETTINGS from '../../domain/settings';
import { adaptiveToneEvents } from '../wallpaper/tone-requests';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';


// A card's place on screen before a layout change.
type LayoutPosition = { left: number; top: number };


interface TopContentDeps {
  recentCards: readonly HTMLElement[];
  updateSearchEntryLayout(): void;
  updateSuggestionsFloatingLayout(): void;
  settings: Pick<SettingsStore, 'get' | 'include' | 'subscribe'>;
  preview: SettingPreview;
  topContentContainer: HTMLElement;
  openExternalNewTabUrl: PageNavigation['openExternalNewTabUrl'];
  locale: Pick<SurfaceLocale, 'store'>;
  appliedTheme: Pick<AppliedThemeMode, 'events'>;
}

function createTopContentRuntime(deps: TopContentDeps) {
  const {
    topContentContainer,
    openExternalNewTabUrl,
    recentCards,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    settings,
    preview,
    locale,
    appliedTheme
  } = deps;


  // What the wordmark or clock shows; nothing until it is first set.
  const topContentState = createViewStore<TopContentState>({ model: null });
  createTopContentController(topContentContainer, {
    onActivate(disposition) {
      openExternalNewTabUrl(COMMUNITY_LINKS.getStoreListing().url, disposition);
    },
    onEntryAnimationComplete(animationName) {
      if (!animationName || animationName === WORDMARK_ENTRY_ANIMATION_NAME) {
        finishWordmarkEntryAnimation();
      }
    }
  }, topContentState);

  // What the clock area last drew with.
  let shown = readTopContentSettings();

  const recentResizeLayoutAnimations = new Set<Animation>();
  let wordmarkEntryTransitionTimer = 0;
  const WORDMARK_ENTRY_ANIMATION_TOTAL_MS = 260;
  const WORDMARK_WALLPAPER_COVER_OPACITY = 0.32;
  const WORDMARK_WALLPAPER_SOLID_OPACITY = 0.6;
  const WORDMARK_LIGHT_SRC = '../../assets/images/lumno-wordmark.svg';
  const WORDMARK_DARK_SRC = '../../assets/images/lumno-wordmark-dark.svg';
  const RECENT_RESIZE_LAYOUT_TRANSITION_MS = 260;
  const RECENT_RESIZE_LAYOUT_TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  // The area fits the wordmark and the default 54px clock; a larger clock
  // gets the same headroom for its size.
  const TOP_CONTENT_MAX_HEIGHT_PX = 74;
  const TOP_CONTENT_DEFAULT_TIME_FONT_SIZE = Number(SETTINGS.NEWTAB_TIME_FONT_SIZE_DEFAULT) || 54;

  function getTopContentMaxHeight(): number {
    if (shown.mode !== 'time') {
      return TOP_CONTENT_MAX_HEIGHT_PX;
    }
    const fontSize = preview.get(newtabTimeFontSize);
    return Math.max(
      TOP_CONTENT_MAX_HEIGHT_PX,
      Math.ceil((fontSize * TOP_CONTENT_MAX_HEIGHT_PX) / TOP_CONTENT_DEFAULT_TIME_FONT_SIZE)
    );
  }

  function captureRecentCardLayout(): Map<HTMLElement, LayoutPosition> {
    const positions = new Map<HTMLElement, LayoutPosition>();
    recentCards.forEach((card) => {
      if (!card || !card.isConnected || typeof card.getBoundingClientRect !== 'function') {
        return;
      }
      const rect = card.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
          (rect.width <= 0 && rect.height <= 0)) {
        return;
      }
      positions.set(card, { left: rect.left, top: rect.top });
    });
    return positions;
  }

  function cancelRecentResizeLayoutAnimations(): void {
    recentResizeLayoutAnimations.forEach((animation) => animation.cancel());
    recentResizeLayoutAnimations.clear();
  }

  function prefersSystemReducedMotion(): boolean {
    return Boolean(
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function shouldSkipNewtabEntryMotion(): boolean {
    // The search shortcut's focus reload replaces a page already on screen.
    if (document.documentElement &&
        document.documentElement.getAttribute('data-nt-focus-resume') === 'true') {
      return true;
    }
    const motionEffectsEnabled = !document.documentElement ||
      document.documentElement.getAttribute('data-lumno-motion-effects') !== 'off';
    return SettingsStorage.shouldSkipEntryMotion(window, motionEffectsEnabled);
  }

  function shouldAnimateNewtabLayoutShift(): boolean {
    const body = document.body;
    return Boolean(
      body &&
      body.getAttribute('data-nt-ready') === '1' &&
      body.getAttribute('data-nt-enter') !== 'run' &&
      body.getAttribute('data-nt-suggestions-open') !== 'true' &&
      !prefersSystemReducedMotion()
    );
  }

  function animateLayoutShift(
    fromPositions: ReadonlyMap<Element, LayoutPosition> | null | undefined,
    animations: Set<Animation>
  ): void {
    if (!fromPositions || fromPositions.size === 0) {
      return;
    }
    fromPositions.forEach((fromPosition, element) => {
      if (!element || !element.isConnected || typeof element.animate !== 'function') {
        return;
      }
      const rect = element.getBoundingClientRect();
      const deltaX = fromPosition.left - rect.left;
      const deltaY = fromPosition.top - rect.top;
      if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
          (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5)) {
        return;
      }
      const animation = element.animate(
        [
          { translate: `${deltaX}px ${deltaY}px` },
          { translate: '0 0' }
        ],
        {
          duration: RECENT_RESIZE_LAYOUT_TRANSITION_MS,
          easing: RECENT_RESIZE_LAYOUT_TRANSITION_EASING,
          fill: 'both'
        }
      );
      animations.add(animation);
      animation.oncancel = () => {
        animations.delete(animation);
      };
      animation.onfinish = () => {
        animations.delete(animation);
        animation.cancel();
      };
    });
  }

  function animateRecentResizeLayout(fromPositions: ReadonlyMap<Element, LayoutPosition> | null | undefined): void {
    animateLayoutShift(fromPositions, recentResizeLayoutAnimations);
  }

  function applyNewtabTopContentVisibility(options?: { contentChanged?: boolean } | null): void {
    const container = topContentContainer;
    if (!container) {
      return;
    }
    const transitionOptions = options || {};
    const body = document.body;
    const nextVisible = Boolean(shown.mode !== 'off' && !settings.get(newtabZenMode));
    const wasVisible = container.getAttribute('data-visible') !== 'false';
    const stateChanged = wasVisible !== nextVisible;
    const layoutChanged = stateChanged || Boolean(transitionOptions.contentChanged);
    const suggestionsOpen = Boolean(
      body && body.getAttribute('data-nt-suggestions-open') === 'true'
    );
    const shouldAnimate = Boolean(
      body &&
      body.getAttribute('data-nt-ready') === '1' &&
      layoutChanged &&
      !suggestionsOpen &&
      !prefersSystemReducedMotion()
    );
    container.setAttribute('data-visible', nextVisible ? 'true' : 'false');
    container.style.setProperty('display', 'flex');
    container.style.setProperty('transition', 'none');
    if (nextVisible) {
      container.style.removeProperty('height');
    } else {
      container.style.setProperty('height', '0px');
    }
    container.style.setProperty('max-height', nextVisible ? `${getTopContentMaxHeight()}px` : '0');
    container.style.setProperty('margin-bottom', nextVisible ? '28px' : '0');
    container.style.setProperty('opacity', nextVisible ? '1' : '0');
    container.style.removeProperty('transform');
    container.style.setProperty('pointer-events', nextVisible ? 'auto' : 'none');
    container.inert = !nextVisible;
    if (nextVisible) {
      container.removeAttribute('aria-hidden');
    } else {
      container.setAttribute('aria-hidden', 'true');
    }
    if (stateChanged && !nextVisible) {
      finishWordmarkEntryAnimation();
    } else if (stateChanged && shouldAnimate && nextVisible) {
      restartWordmarkEntryAnimation();
    }
    updateSearchEntryLayout();
    updateSuggestionsFloatingLayout();
    adaptiveToneEvents.emit('stale', {});
  }

  function finishWordmarkEntryAnimation(): void {
    if (wordmarkEntryTransitionTimer) {
      window.clearTimeout(wordmarkEntryTransitionTimer);
      wordmarkEntryTransitionTimer = 0;
    }
    if (topContentContainer) {
      topContentContainer.setAttribute('data-enter', 'done');
    }
  }

  function restartWordmarkEntryAnimation(): void {
    const container = topContentContainer;
    if (!container) {
      return;
    }
    if (prefersSystemReducedMotion()) {
      finishWordmarkEntryAnimation();
      return;
    }
    const wordmarkContent = getWordmarkContent(container);
    if (wordmarkEntryTransitionTimer) {
      window.clearTimeout(wordmarkEntryTransitionTimer);
      wordmarkEntryTransitionTimer = 0;
    }
    container.setAttribute('data-enter', 'done');
    if (wordmarkContent) {
      void wordmarkContent.offsetWidth;
    }
    container.setAttribute('data-enter', 'run');
    wordmarkEntryTransitionTimer = window.setTimeout(
      finishWordmarkEntryAnimation,
      WORDMARK_ENTRY_ANIMATION_TOTAL_MS
    );
  }

  function getWordmarkSolidFill(wallpaperActive: boolean, wallpaperInk: string | null, theme: string | null): string {
    // A fixed clock ink keeps its tone off the wallpaper too (the adaptive
    // tone already sampled it in that ink on a wallpaper).
    const fixedInk = getFixedTimeInk(shown.mode, settings.get(newtabTimeInk));
    if (fixedInk && !wallpaperActive) {
      return fixedInk === 'light' ? 'rgb(248 250 252)' : 'rgb(31 41 55)';
    }
    // Until the wallpaper is sampled, the fallback draws the ink already known.
    if (wallpaperActive) {
      return (fixedInk || wallpaperInk) === 'light'
        ? 'var(--x-nt-wallpaper-wordmark-ink, rgb(238 240 242))'
        : 'var(--x-nt-wallpaper-wordmark-ink, rgb(78 84 94))';
    }
    return theme === 'dark' ? 'rgb(248 250 252)' : 'rgb(31 41 55)';
  }

  // The brand image for the theme; on a wallpaper, a solid layer in the
  // sampled ink, or the theme's image faintly when an overlay covers it.
  function getWordmarkAppearance(resolvedTheme?: string | null): WordmarkAppearance {
    const theme = resolvedTheme || (document.body ? document.body.getAttribute('data-theme') : 'light');
    const container = topContentContainer;
    const wallpaperActive = Boolean(document.body &&
      document.body.getAttribute('data-wallpaper-active') === 'true');
    const wallpaperInk = container ? container.getAttribute('data-wallpaper-ink') : '';
    const themeSrc = theme === 'dark' ? WORDMARK_DARK_SRC : WORDMARK_LIGHT_SRC;
    if (wallpaperActive && container && container.getAttribute('data-wallpaper-overlay-cover') === 'true') {
      return {
        imageSrc: themeSrc,
        imageOpacity: WORDMARK_WALLPAPER_COVER_OPACITY,
        solidOpacity: 0,
        solidFill: getWordmarkSolidFill(false, '', theme)
      };
    }
    if (wallpaperActive) {
      return {
        imageSrc: wallpaperInk === 'dark' ? WORDMARK_LIGHT_SRC : WORDMARK_DARK_SRC,
        imageOpacity: 0,
        solidOpacity: WORDMARK_WALLPAPER_SOLID_OPACITY,
        solidFill: getWordmarkSolidFill(true, wallpaperInk, theme)
      };
    }
    return {
      imageSrc: themeSrc,
      imageOpacity: theme === 'dark' ? 0.9 : 0.82,
      solidOpacity: 0,
      solidFill: getWordmarkSolidFill(false, '', theme)
    };
  }

  function applyWordmarkThemeAppearance(resolvedTheme?: string | null): void {
    // A new appearance leaves the entry motion alone.
    const { model } = topContentState.getSnapshot();
    if (model) {
      topContentState.setState({ model: { ...model, appearance: getWordmarkAppearance(resolvedTheme) } });
    }
  }

  function renderNewtabTopContent(animateEntry?: boolean): void {
    const timeFont = SETTINGS.getNewtabTimeFont(shown.font);
    topContentState.setState({ model: {
      animateEntry: Boolean(animateEntry),
      ariaLabel: `Lumno ${COMMUNITY_LINKS.getStoreListing().name}`,
      font: {
        id: timeFont.id,
        colonGap: timeFont.colonGap,
        colonShift: timeFont.colonShift,
        family: timeFont.family,
        stretch: timeFont.stretch,
        tracking: SETTINGS.getNewtabTimeFontTracking(timeFont.id, shown.fontWeight)
      },
      fontSize: preview.get(newtabTimeFontSize),
      fontWeight: SETTINGS.resolveNewtabTimeFontWeight(timeFont.id, shown.fontWeight),
      appearance: getWordmarkAppearance(),
      locale: document.documentElement ? document.documentElement.lang : undefined,
      mode: shown.mode === 'time' ? 'time' : 'brand',
      opacity: preview.get(newtabTimeOpacity) / 100,
      showSeconds: shown.secondsVisible,
      twelveHour: shown.twelveHour
    } });
    adaptiveToneEvents.emit('stale', {});
  }

  function readTopContentSettings() {
    return {
      mode: settings.get(newtabTopContentMode),
      font: settings.get(newtabTimeFont),
      fontWeight: settings.get(newtabTimeFontWeight),
      fontSize: settings.get(newtabTimeFontSize),
      opacity: settings.get(newtabTimeOpacity),
      ink: settings.get(newtabTimeInk),
      secondsVisible: settings.get(newtabTimeSecondsVisible),
      twelveHour: settings.get(newtabTime12Hour)
    };
  }

  // The clock grows or shrinks: the area's cap and the blocks below follow.
  function applyTimeFontSize(): void {
    renderNewtabTopContent(false);
    if (topContentContainer &&
        topContentContainer.getAttribute('data-visible') !== 'false') {
      topContentContainer.style.setProperty('max-height', `${getTopContentMaxHeight()}px`);
      updateSearchEntryLayout();
      updateSuggestionsFloatingLayout();
    }
  }

  // A dragged slider's value shows at once.
  let previewed = { fontSize: preview.get(newtabTimeFontSize), opacity: preview.get(newtabTimeOpacity) };
  function applySettingPreview(): void {
    const next = { fontSize: preview.get(newtabTimeFontSize), opacity: preview.get(newtabTimeOpacity) };
    const previous = previewed;
    previewed = next;
    if (shown.mode !== 'time') {
      return;
    }
    if (next.fontSize !== previous.fontSize) {
      applyTimeFontSize();
    } else if (next.opacity !== previous.opacity) {
      renderNewtabTopContent(false);
    }
  }

  // Draws what changed since the area last drew.
  function applyTopContentSettings(): void {
    const previous = shown;
    const next = readTopContentSettings();
    shown = next;
    if (next.mode !== previous.mode) {
      if (next.mode !== 'off') {
        renderNewtabTopContent(false);
      }
      applyNewtabTopContentVisibility({ contentChanged: true });
    } else if (next.mode === 'time') {
      if (next.font !== previous.font) {
        void loadNewtabTimeFont(next.font).then(() => {
          if (shown.font === next.font && shown.mode === 'time') {
            renderNewtabTopContent(false);
          }
        });
      } else if (next.fontSize !== previous.fontSize) {
        applyTimeFontSize();
      } else if (next.fontWeight !== previous.fontWeight || next.opacity !== previous.opacity ||
          next.secondsVisible !== previous.secondsVisible || next.twelveHour !== previous.twelveHour) {
        renderNewtabTopContent(false);
      }
    }
    if (next.ink !== previous.ink) {
      applyWordmarkThemeAppearance();
      adaptiveToneEvents.emit('stale', {});
    }
  }

  // Draws the stored settings once read, then follows them.
  function followTopContentSettings(): Promise<boolean> {
    settings.subscribe(NEWTAB_TOP_CONTENT_SETTINGS, applyTopContentSettings);
    preview.store.subscribe(applySettingPreview);
    return settings.include(NEWTAB_TOP_CONTENT_SETTINGS).then(() => {
      // The face loads before the first clock draws, and the startup reveal waits for it.
      const fontReady = settings.get(newtabTopContentMode) === 'time'
        ? loadNewtabTimeFont(settings.get(newtabTimeFont))
        : Promise.resolve(true);
      applyTopContentSettings();
      return fontReady;
    });
  }

  // Starts loading the face so the clock never draws in a fallback; the
  // promise settles once the face is usable (or failed to load).
  function loadNewtabTimeFont(fontId: unknown): Promise<boolean> {
    const timeFont = SETTINGS.getNewtabTimeFont(fontId);
    if (!document.fonts || typeof document.fonts.load !== 'function') {
      return Promise.resolve(true);
    }
    const weight = SETTINGS.resolveNewtabTimeFontWeight(timeFont.id, shown.fontWeight);
    return document.fonts.load(`${weight} 54px ${timeFont.family}`, '0123456789:')
      .then(() => true, () => true);
  }


  // The mark draws in the page's theme and in the ink the wallpaper's tone gives it.
  appliedTheme.events.on('changed', () => applyWordmarkThemeAppearance());
  adaptiveToneEvents.on('applied', () => applyWordmarkThemeAppearance());
  // The clock reads its labels in the page's language.
  locale.store.subscribe(() => {
    if (shown.mode === 'time') {
      renderNewtabTopContent(false);
    }
  });
  return {
    captureRecentCardLayout,
    cancelRecentResizeLayoutAnimations,
    shouldSkipNewtabEntryMotion,
    shouldAnimateNewtabLayoutShift,
    animateRecentResizeLayout,
    applyNewtabTopContentVisibility,
    finishWordmarkEntryAnimation,
    applyWordmarkThemeAppearance,
    renderNewtabTopContent,
    followTopContentSettings
  };
}

type TopContentRuntime = ReturnType<typeof createTopContentRuntime>;

export { createTopContentRuntime };
export type { TopContentDeps, TopContentRuntime };
