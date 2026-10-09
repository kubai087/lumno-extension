(function(root) {
  // The wordmark/clock area above the search box and the layout motion
  // around it.
  function createTopContentRuntime(deps) {
    const {
      root,
      COMMUNITY_LINKS,
      bookmarkSection,
      recentSection,
      recentCards,
      SETTINGS,
      updateSearchEntryLayout,
      updateSuggestionsFloatingLayout,
      scheduleWallpaperAdaptiveToneUpdate,
      normalizeNewtabTopContentMode,
      normalizeNewtabTimeFontWeight,
      normalizeNewtabTimeSecondsVisible
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let wordmarkSolidEl = null;
    const topContentLayoutAnimations = new Set();
    const recentResizeLayoutAnimations = new Set();
    let wordmarkEntryTransitionTimer = 0;
    const WORDMARK_ENTRY_ANIMATION_TOTAL_MS = 380;
    const WORDMARK_WALLPAPER_COVER_DARK_OPACITY = '0.32';
    const WORDMARK_WALLPAPER_COVER_LIGHT_OPACITY = '0.32';
    const WORDMARK_WALLPAPER_SOLID_OPACITY = '0.6';
    const TOP_CONTENT_LAYOUT_TRANSITION_MS = 260;
    const TOP_CONTENT_LAYOUT_TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

    function getTopContentMotionElements() {
      return [
        pageState.topContentContainer,
        root,
        pageState.shortcutSection,
        bookmarkSection,
        recentSection,
        pageState.updateNoticeController && pageState.updateNoticeController.element,
        pageState.engagementNoticeController && pageState.engagementNoticeController.element
      ].filter((element, index, elements) => (
        element &&
        element.isConnected &&
        typeof element.getBoundingClientRect === 'function' &&
        elements.indexOf(element) === index
      ));
    }

    function captureTopContentLayout() {
      const positions = new Map();
      getTopContentMotionElements().forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
            (rect.width <= 0 && rect.height <= 0)) {
          return;
        }
        positions.set(element, { left: rect.left, top: rect.top });
      });
      return positions;
    }

    function captureRecentCardLayout() {
      const positions = new Map();
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

    function cancelTopContentLayoutAnimations() {
      topContentLayoutAnimations.forEach((animation) => animation.cancel());
      topContentLayoutAnimations.clear();
    }

    function cancelRecentResizeLayoutAnimations() {
      recentResizeLayoutAnimations.forEach((animation) => animation.cancel());
      recentResizeLayoutAnimations.clear();
    }

    function prefersSystemReducedMotion() {
      return Boolean(
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    }

    function shouldSkipNewtabEntryMotion() {
      const motionEffectsEnabled = !document.documentElement ||
        document.documentElement.getAttribute('data-lumno-motion-effects') !== 'off';
      return SETTINGS.shouldSkipEntryMotion(window, motionEffectsEnabled);
    }

    function shouldAnimateNewtabLayoutShift() {
      const body = document.body;
      return Boolean(
        body &&
        body.getAttribute('data-nt-ready') === '1' &&
        body.getAttribute('data-nt-enter') !== 'run' &&
        body.getAttribute('data-nt-suggestions-open') !== 'true' &&
        !prefersSystemReducedMotion()
      );
    }

    function animateLayoutShift(fromPositions, animations) {
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
            duration: TOP_CONTENT_LAYOUT_TRANSITION_MS,
            easing: TOP_CONTENT_LAYOUT_TRANSITION_EASING,
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

    function animateTopContentLayout(fromPositions) {
      animateLayoutShift(fromPositions, topContentLayoutAnimations);
    }

    function animateRecentResizeLayout(fromPositions) {
      animateLayoutShift(fromPositions, recentResizeLayoutAnimations);
    }

    function applyNewtabTopContentVisibility(options) {
      if (!pageState.topContentContainer) {
        return;
      }
      const transitionOptions = options || {};
      const body = document.body;
      const nextVisible = Boolean(pageState.newtabTopContentMode !== 'off' && !pageState.zenModeEnabled);
      const wasVisible = pageState.topContentContainer.getAttribute('data-visible') !== 'false';
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
      const fromLayout = shouldAnimate
        ? (transitionOptions.fromLayout || captureTopContentLayout())
        : null;
      cancelTopContentLayoutAnimations();
      pageState.topContentContainer.setAttribute('data-visible', nextVisible ? 'true' : 'false');
      pageState.topContentContainer.style.setProperty('display', 'flex');
      pageState.topContentContainer.style.setProperty('transition', 'none');
      if (nextVisible) {
        pageState.topContentContainer.style.removeProperty('height');
      } else {
        pageState.topContentContainer.style.setProperty('height', '0px');
      }
      pageState.topContentContainer.style.setProperty('max-height', nextVisible ? '74px' : '0');
      pageState.topContentContainer.style.setProperty('margin-bottom', nextVisible ? '28px' : '0');
      pageState.topContentContainer.style.setProperty('opacity', nextVisible ? '1' : '0');
      pageState.topContentContainer.style.removeProperty('transform');
      pageState.topContentContainer.style.setProperty('pointer-events', nextVisible ? 'auto' : 'none');
      pageState.topContentContainer.inert = !nextVisible;
      if (nextVisible) {
        pageState.topContentContainer.removeAttribute('aria-hidden');
      } else {
        pageState.topContentContainer.setAttribute('aria-hidden', 'true');
      }
      if (stateChanged && !nextVisible) {
        finishWordmarkEntryAnimation();
      } else if (stateChanged && shouldAnimate && nextVisible) {
        restartWordmarkEntryAnimation();
      }
      updateSearchEntryLayout();
      updateSuggestionsFloatingLayout();
      if (shouldAnimate) {
        animateTopContentLayout(fromLayout);
      }
      scheduleWallpaperAdaptiveToneUpdate();
    }

    function finishWordmarkEntryAnimation() {
      if (wordmarkEntryTransitionTimer) {
        window.clearTimeout(wordmarkEntryTransitionTimer);
        wordmarkEntryTransitionTimer = 0;
      }
      if (pageState.topContentContainer) {
        pageState.topContentContainer.setAttribute('data-enter', 'done');
      }
    }

    function restartWordmarkEntryAnimation() {
      if (!pageState.topContentContainer) {
        return;
      }
      if (prefersSystemReducedMotion()) {
        finishWordmarkEntryAnimation();
        return;
      }
      const wordmarkContent = pageState.topContentContainer.querySelector('.x-nt-wordmark-content');
      if (wordmarkEntryTransitionTimer) {
        window.clearTimeout(wordmarkEntryTransitionTimer);
        wordmarkEntryTransitionTimer = 0;
      }
      pageState.topContentContainer.setAttribute('data-enter', 'done');
      if (wordmarkContent) {
        void wordmarkContent.offsetWidth;
      }
      pageState.topContentContainer.setAttribute('data-enter', 'run');
      wordmarkEntryTransitionTimer = window.setTimeout(
        finishWordmarkEntryAnimation,
        WORDMARK_ENTRY_ANIMATION_TOTAL_MS
      );
    }

    function getWordmarkSolidFill(wallpaperActive, wallpaperInk, theme) {
      if (wallpaperActive) {
        return wallpaperInk === 'dark'
          ? 'var(--x-nt-wallpaper-wordmark-ink, rgb(238 240 242))'
          : 'var(--x-nt-wallpaper-wordmark-ink, rgb(78 84 94))';
      }
      return theme === 'dark' ? 'rgb(248 250 252)' : 'rgb(31 41 55)';
    }

    function applyWordmarkSolidFill(fill) {
      if (!pageState.topContentContainer) {
        return;
      }
      pageState.topContentContainer.style.setProperty('--x-nt-wordmark-solid-fill', fill);
    }

    function applyWordmarkSolidLayerVisible(visible) {
      if (!wordmarkSolidEl) {
        return;
      }
      wordmarkSolidEl.style.setProperty(
        'opacity',
        visible ? WORDMARK_WALLPAPER_SOLID_OPACITY : '0'
      );
    }

    function applyWordmarkThemeAppearance(resolvedTheme) {
      const theme = resolvedTheme || (document.body ? document.body.getAttribute('data-theme') : 'light');
      const wallpaperActive = document.body &&
        document.body.getAttribute('data-wallpaper-active') === 'true';
      const wallpaperInk = pageState.topContentContainer
        ? pageState.topContentContainer.getAttribute('data-wallpaper-ink')
        : '';
      applyWordmarkSolidFill(getWordmarkSolidFill(wallpaperActive, wallpaperInk, theme));
      if (!pageState.wordmarkImageEl) {
        return;
      }
      const lightSrc = '../../assets/images/lumno-wordmark.svg';
      const darkSrc = '../../assets/images/lumno-wordmark-dark.svg';
      if (wallpaperActive) {
        const wallpaperOverlayCover = pageState.topContentContainer &&
          pageState.topContentContainer.getAttribute('data-wallpaper-overlay-cover') === 'true';
        if (wallpaperOverlayCover) {
          applyWordmarkSolidLayerVisible(false);
          const themeSrc = theme === 'dark' ? darkSrc : lightSrc;
          if (pageState.wordmarkImageEl.getAttribute('src') !== themeSrc) {
            pageState.wordmarkImageEl.setAttribute('src', themeSrc);
          }
          applyWordmarkSolidFill(getWordmarkSolidFill(false, '', theme));
          pageState.wordmarkImageEl.style.setProperty(
            'opacity',
            theme === 'dark'
              ? WORDMARK_WALLPAPER_COVER_DARK_OPACITY
              : WORDMARK_WALLPAPER_COVER_LIGHT_OPACITY
          );
          return;
        }
        const wallpaperSrc = wallpaperInk === 'dark' ? lightSrc : darkSrc;
        if (pageState.wordmarkImageEl.getAttribute('src') !== wallpaperSrc) {
          pageState.wordmarkImageEl.setAttribute('src', wallpaperSrc);
        }
        applyWordmarkSolidFill(getWordmarkSolidFill(true, wallpaperInk, theme));
        applyWordmarkSolidLayerVisible(true);
        pageState.wordmarkImageEl.style.setProperty('opacity', '0');
        return;
      }
      applyWordmarkSolidLayerVisible(false);
      if (theme === 'dark') {
        if (pageState.wordmarkImageEl.getAttribute('src') !== darkSrc) {
          pageState.wordmarkImageEl.setAttribute('src', darkSrc);
        }
        applyWordmarkSolidFill(getWordmarkSolidFill(false, '', theme));
        pageState.wordmarkImageEl.style.setProperty('opacity', '0.9');
        return;
      }
      if (pageState.wordmarkImageEl.getAttribute('src') !== lightSrc) {
        pageState.wordmarkImageEl.setAttribute('src', lightSrc);
      }
      applyWordmarkSolidFill(getWordmarkSolidFill(false, '', theme));
      pageState.wordmarkImageEl.style.setProperty('opacity', '0.82');
    }

    function renderNewtabTopContent(animateEntry) {
      if (!pageState.topContentController) {
        return;
      }
      pageState.topContentController.render({
        animateEntry: Boolean(animateEntry),
        ariaLabel: `Lumno ${COMMUNITY_LINKS.getStoreListing().name}`,
        fontWeight: pageState.newtabTimeFontWeight,
        imageSrc: '../../assets/images/lumno-wordmark.svg',
        locale: document.documentElement ? document.documentElement.lang : undefined,
        mode: pageState.newtabTopContentMode === 'time' ? 'time' : 'brand',
        showSeconds: pageState.newtabTimeSecondsVisible
      });
      pageState.wordmarkImageEl = pageState.topContentController.getImage();
      wordmarkSolidEl = pageState.topContentController.getSolid();
      applyWordmarkThemeAppearance();
      scheduleWallpaperAdaptiveToneUpdate();
    }

    function setNewtabTopContentMode(value) {
      const nextMode = normalizeNewtabTopContentMode(value);
      const contentChanged = nextMode !== pageState.newtabTopContentMode;
      if (!contentChanged) {
        return;
      }
      const fromLayout = captureTopContentLayout();
      pageState.newtabTopContentMode = nextMode;
      if (nextMode !== 'off') {
        renderNewtabTopContent(false);
      }
      applyNewtabTopContentVisibility({ contentChanged, fromLayout });
    }

    function updateNewtabTimeSecondsVisibleUi() {
      if (pageState.wallpaperRuntime && typeof pageState.wallpaperRuntime.updateTimeSecondsVisibleUi === 'function') {
        pageState.wallpaperRuntime.updateTimeSecondsVisibleUi();
      }
    }

    function updateNewtabTimeFontWeightUi() {
      if (pageState.wallpaperRuntime && typeof pageState.wallpaperRuntime.updateTimeFontWeightUi === 'function') {
        pageState.wallpaperRuntime.updateTimeFontWeightUi();
      }
    }

    function setNewtabTimeFontWeight(value) {
      const nextValue = normalizeNewtabTimeFontWeight(value);
      const changed = nextValue !== pageState.newtabTimeFontWeight;
      pageState.newtabTimeFontWeight = nextValue;
      if (changed && pageState.newtabTopContentMode === 'time') {
        renderNewtabTopContent(false);
      }
      updateNewtabTimeFontWeightUi();
      return nextValue;
    }

    function setNewtabTimeSecondsVisible(value) {
      const nextValue = normalizeNewtabTimeSecondsVisible(value);
      const changed = nextValue !== pageState.newtabTimeSecondsVisible;
      pageState.newtabTimeSecondsVisible = nextValue;
      if (changed && pageState.newtabTopContentMode === 'time') {
        renderNewtabTopContent(false);
      }
      updateNewtabTimeSecondsVisibleUi();
      return nextValue;
    }

    return {
      captureTopContentLayout,
      captureRecentCardLayout,
      cancelTopContentLayoutAnimations,
      cancelRecentResizeLayoutAnimations,
      shouldSkipNewtabEntryMotion,
      shouldAnimateNewtabLayoutShift,
      animateTopContentLayout,
      animateRecentResizeLayout,
      applyNewtabTopContentVisibility,
      finishWordmarkEntryAnimation,
      applyWordmarkThemeAppearance,
      renderNewtabTopContent,
      setNewtabTopContentMode,
      setNewtabTimeFontWeight,
      setNewtabTimeSecondsVisible
    };
  }

  root.LumnoNewtabTopContentRuntime = { createTopContentRuntime };
})(globalThis);
