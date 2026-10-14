(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LumnoNewtabSectionPanelSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  // Appearance panel controls for the bookmark and site-card sections. The page owns the
  // values and stores them under the same keys as the Options page and the sections' own
  // menus, so the panel reads through getters, writes through setters and re-reads whenever
  // one of those keys changes elsewhere.
  const BOOKMARK_VIEW_MODES = ['folder', 'list', 'top'];
  const BOOKMARK_TOPBAR_SURFACE_MODES = ['adaptive', 'clear', 'transparent', 'custom'];
  // Section counts are stored in multiples of four, one row each.
  const ITEMS_PER_ROW = 4;
  const BOOKMARK_ROWS_MIN = 1;
  const BOOKMARK_ROWS_MAX = 8;
  // Turning a section back on restores its last row count, or the stored defaults.
  const BOOKMARK_COUNT_DEFAULT = 8;
  const RECENT_COUNT_DEFAULT = 4;
  const SLIDER_SAVE_DELAY_MS = 140;

  function createRuntime(options) {
    const config = options || {};
    const window = config.windowObj || root.window;
    const t = config.t;
    const watchedKeys = new Set(config.watchedKeys || []);
    let refs = null;
    let view = null;
    let helpers = {};
    let bookmarkExpanded = false;
    let recentExpanded = false;
    let lastBookmarkCount = 0;
    let lastRecentCount = 0;
    let updateTimer = 0;
    let unsubscribe = null;
    const saveTimers = new Map();
    let tabResizeObserver = null;

    const call = (name, ...args) => (typeof config[name] === 'function' ? config[name](...args) : undefined);
    const getBookmarkCount = () => Number(call('getBookmarkCount')) || 0;
    const getRecentCount = () => Number(call('getRecentCount')) || 0;

    function rememberCounts() {
      const bookmarkCount = getBookmarkCount();
      const recentCount = getRecentCount();
      if (bookmarkCount > 0) lastBookmarkCount = bookmarkCount;
      if (recentCount > 0) lastRecentCount = recentCount;
    }

    function syncTabs(group, attribute, value) {
      if (!group) return;
      group.querySelectorAll(`[${attribute}]`).forEach((button) => {
        const active = button.getAttribute(attribute) === String(value);
        button.setAttribute('data-active', active ? 'true' : 'false');
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const segmentedIndicator = root.LumnoSegmentedIndicator;
      if (segmentedIndicator) segmentedIndicator.sync(group.querySelector('.x-nt-segmented-tabs-indicator'));
    }

    function setSectionState(trigger, toggle, body, enabled, expanded) {
      toggle.checked = enabled;
      toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
      trigger.disabled = !enabled;
      trigger.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      trigger.setAttribute('aria-expanded', enabled && expanded ? 'true' : 'false');
      body.hidden = !(enabled && expanded);
    }

    function setSlider(slider, value, label) {
      if (!slider) return;
      const min = Number(slider.min);
      const max = Number(slider.max);
      slider.value = String(value);
      slider.setAttribute('aria-label', label);
      slider.setAttribute('aria-valuenow', String(value));
      slider.setAttribute('aria-valuetext', String(value));
      slider.style.setProperty('--x-range-slider-percent', `${max > min ? (value - min) / (max - min) * 100 : 0}%`);
      if (helpers.syncSliderValueInput) helpers.syncSliderValueInput(slider);
    }

    function renderBookmarkSelects(viewMode, surfaceMode) {
      if (!view) return;
      if (view.renderBookmarkViewModeSelect) {
        view.renderBookmarkViewModeSelect({
          ariaLabel: t('display_mode_title', 'Display mode'),
          options: [
            { value: 'folder', label: t('bookmark_view_mode_folder', 'Multi-layer folder view') },
            { value: 'list', label: t('bookmark_view_mode_list', 'Multi-level list view') },
            { value: 'top', label: t('bookmark_view_mode_top', 'Top bookmarks bar') }
          ],
          value: viewMode,
          onChange: (mode) => {
            if (BOOKMARK_VIEW_MODES.includes(mode)) call('setBookmarkViewMode', mode);
            update();
          }
        });
      }
      if (view.renderBookmarkTopbarSurfaceSelect) {
        // Same choices as the bar's own menu; "Custom color" opens the screen color picker and
        // only becomes the selection once a color is picked.
        const surfaceOption = (value, labelKey, fallback, extra) => Object.assign({
          value,
          label: t(labelKey, fallback),
          radio: true,
          checked: surfaceMode === value
        }, extra);
        view.renderBookmarkTopbarSurfaceSelect({
          ariaLabel: t('bookmark_topbar_surface_title', 'Bar background'),
          options: [
            surfaceOption('adaptive', 'bookmark_topbar_surface_adaptive', 'Adaptive mist'),
            surfaceOption('clear', 'bookmark_topbar_surface_clear', 'Liquid glass'),
            surfaceOption('transparent', 'bookmark_topbar_surface_transparent', 'Transparent'),
            surfaceOption('custom', 'bookmark_topbar_surface_custom', 'Custom color', {
              trailingIconClass: 'ri-dropper-line'
            })
          ],
          value: surfaceMode,
          onChange: (mode) => {
            if (!BOOKMARK_TOPBAR_SURFACE_MODES.includes(mode)) return false;
            if (mode === 'custom') {
              call('pickBookmarkTopbarSurfaceColor');
              return false;
            }
            call('setBookmarkTopbarSurfaceMode', mode);
            update();
            return undefined;
          }
        });
      }
    }

    function update() {
      if (!refs) return;
      window.clearTimeout(updateTimer);
      updateTimer = 0;
      rememberCounts();
      const bookmarkCount = getBookmarkCount();
      const viewMode = BOOKMARK_VIEW_MODES.includes(call('getBookmarkViewMode'))
        ? call('getBookmarkViewMode')
        : 'folder';
      const topbarMode = viewMode === 'top';
      const bookmarkTitle = t('bookmarks_heading', 'Bookmarks');
      refs.bookmarkSettingsTitle.textContent = bookmarkTitle;
      refs.bookmarkSettingsToggle.setAttribute('aria-label', bookmarkTitle);
      refs.bookmarkSettingsTrigger.setAttribute('aria-label', bookmarkTitle);
      setSectionState(
        refs.bookmarkSettingsTrigger,
        refs.bookmarkSettingsToggle,
        refs.bookmarkSettingsBody,
        bookmarkCount > 0,
        bookmarkExpanded
      );
      refs.bookmarkViewModeLabel.textContent = t('display_mode_title', 'Display mode');
      refs.bookmarkGridSettings.hidden = topbarMode;
      refs.bookmarkTopbarSettings.hidden = !topbarMode;
      const rowsLabel = t('settings_bookmarks_title', 'Bookmark rows');
      const columnsLabel = t('settings_bookmark_columns_title', 'Bookmarks per row');
      const folderIconsLabel = t('settings_bookmark_folder_icons_visible_title', 'Show icons inside bookmark folders');
      refs.bookmarkRowsLabel.textContent = rowsLabel;
      refs.bookmarkColumnsLabel.textContent = columnsLabel;
      refs.bookmarkFolderIconsTitle.textContent = folderIconsLabel;
      // A drag in progress keeps its thumb; the page already previews that value.
      if (!saveTimers.has(refs.bookmarkRowsSlider)) {
        const rows = Math.round((bookmarkCount || lastBookmarkCount || BOOKMARK_COUNT_DEFAULT) / ITEMS_PER_ROW);
        setSlider(refs.bookmarkRowsSlider, Math.min(BOOKMARK_ROWS_MAX, Math.max(BOOKMARK_ROWS_MIN, rows)), rowsLabel);
      }
      if (!saveTimers.has(refs.bookmarkColumnsSlider)) {
        setSlider(refs.bookmarkColumnsSlider, Number(call('getBookmarkColumns')) || 6, columnsLabel);
      }
      const folderIconsVisible = call('getBookmarkFolderIconsVisible') !== false;
      refs.bookmarkFolderIconsToggle.checked = folderIconsVisible;
      refs.bookmarkFolderIconsToggle.setAttribute('aria-checked', folderIconsVisible ? 'true' : 'false');
      refs.bookmarkFolderIconsToggle.setAttribute('aria-label', folderIconsLabel);
      refs.bookmarkTopbarLayoutLabel.textContent = t('bookmark_topbar_layout_title', 'Bar style');
      refs.bookmarkTopbarLayoutTabs.setAttribute('aria-label', t('bookmark_topbar_layout_title', 'Bar style'));
      refs.bookmarkTopbarLayoutTabs.querySelectorAll('[data-bookmark-topbar-layout]').forEach((button) => {
        button.textContent = button.getAttribute('data-bookmark-topbar-layout') === 'floating'
          ? t('bookmark_topbar_layout_floating', 'Floating')
          : t('bookmark_topbar_layout_docked', 'Docked to top');
      });
      syncTabs(
        refs.bookmarkTopbarLayoutTabs,
        'data-bookmark-topbar-layout',
        call('getBookmarkTopbarLayout') === 'floating' ? 'floating' : 'docked'
      );
      refs.bookmarkTopbarSurfaceLabel.textContent = t('bookmark_topbar_surface_title', 'Bar background');
      const surfaceMode = BOOKMARK_TOPBAR_SURFACE_MODES.includes(call('getBookmarkTopbarSurfaceMode'))
        ? call('getBookmarkTopbarSurfaceMode')
        : 'adaptive';
      renderBookmarkSelects(viewMode, surfaceMode);

      const recentCount = getRecentCount();
      const recentTitle = t('settings_recent_sites_title', 'Site cards');
      refs.recentSettingsTitle.textContent = recentTitle;
      refs.recentSettingsToggle.setAttribute('aria-label', recentTitle);
      refs.recentSettingsTrigger.setAttribute('aria-label', recentTitle);
      setSectionState(
        refs.recentSettingsTrigger,
        refs.recentSettingsToggle,
        refs.recentSettingsBody,
        recentCount > 0,
        recentExpanded
      );
      refs.recentModeLabel.textContent = t('display_mode_title', 'Display mode');
      refs.recentModeTabs.setAttribute('aria-label', t('display_mode_title', 'Display mode'));
      refs.recentModeTabs.querySelectorAll('[data-recent-mode]').forEach((button) => {
        button.textContent = button.getAttribute('data-recent-mode') === 'custom'
          ? t('recent_mode_custom', 'Custom')
          : button.getAttribute('data-recent-mode') === 'most'
          ? t('recent_mode_most', 'Most visited')
          : t('recent_mode_latest', 'Recent');
      });
      syncTabs(refs.recentModeTabs, 'data-recent-mode', call('getRecentMode') || 'latest');
      const recentRowsLabel = t('newtab_recent_rows_title', 'Site card rows');
      refs.recentRowsLabel.textContent = recentRowsLabel;
      refs.recentRowsTabs.setAttribute('aria-label', recentRowsLabel);
      syncTabs(
        refs.recentRowsTabs,
        'data-recent-rows',
        Math.round((recentCount || lastRecentCount || RECENT_COUNT_DEFAULT) / ITEMS_PER_ROW)
      );
    }

    // Storage listeners run in registration order; reading after them sees the page's new values.
    function scheduleUpdate() {
      if (!refs || updateTimer) return;
      updateTimer = window.setTimeout(update, 0);
    }

    function handleStorageChange(changes) {
      if (changes && Object.keys(changes).some((key) => watchedKeys.has(key))) scheduleUpdate();
    }

    // The page previews each step; storage (and so sync) only sees where the thumb settles.
    function bindSlider(slider, toValue, setter) {
      const persist = () => {
        window.clearTimeout(saveTimers.get(slider));
        saveTimers.delete(slider);
        call(setter, toValue(slider.value), { persist: true });
        update();
      };
      slider.addEventListener('input', () => {
        call(setter, toValue(slider.value), { persist: false });
        setSlider(slider, Number(slider.value), slider.getAttribute('aria-label') || '');
        window.clearTimeout(saveTimers.get(slider));
        saveTimers.set(slider, window.setTimeout(persist, SLIDER_SAVE_DELAY_MS));
      });
      slider.addEventListener('change', persist);
      if (helpers.bindSliderValueInput) helpers.bindSliderValueInput(slider);
    }

    function bindSettings(nextRefs, nextView, nextHelpers) {
      if (!nextRefs || !nextRefs.bookmarkSettingsSection || !nextRefs.recentSettingsSection) return;
      refs = nextRefs;
      view = nextView || null;
      helpers = nextHelpers || {};
      refs.bookmarkSettingsTrigger.addEventListener('click', () => {
        if (getBookmarkCount() <= 0) return;
        bookmarkExpanded = !bookmarkExpanded;
        update();
      });
      refs.bookmarkSettingsToggle.addEventListener('change', () => {
        rememberCounts();
        call(
          'setBookmarkCount',
          refs.bookmarkSettingsToggle.checked ? lastBookmarkCount || BOOKMARK_COUNT_DEFAULT : 0,
          { persist: true }
        );
        update();
      });
      bindSlider(refs.bookmarkRowsSlider, (value) => Number(value) * ITEMS_PER_ROW, 'setBookmarkCount');
      bindSlider(refs.bookmarkColumnsSlider, Number, 'setBookmarkColumns');
      refs.bookmarkFolderIconsToggle.addEventListener('change', () => {
        call('setBookmarkFolderIconsVisible', refs.bookmarkFolderIconsToggle.checked, { persist: true });
        update();
      });
      refs.bookmarkTopbarLayoutTabs.querySelectorAll('[data-bookmark-topbar-layout]').forEach((button) => {
        button.addEventListener('click', () => {
          call('setBookmarkTopbarLayout', button.getAttribute('data-bookmark-topbar-layout'));
          update();
        });
      });
      refs.recentSettingsTrigger.addEventListener('click', () => {
        if (getRecentCount() <= 0) return;
        recentExpanded = !recentExpanded;
        update();
      });
      refs.recentSettingsToggle.addEventListener('change', () => {
        rememberCounts();
        call(
          'setRecentCount',
          refs.recentSettingsToggle.checked ? lastRecentCount || RECENT_COUNT_DEFAULT : 0,
          { persist: true }
        );
        update();
      });
      refs.recentModeTabs.querySelectorAll('[data-recent-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          call('setRecentMode', button.getAttribute('data-recent-mode'));
          update();
        });
      });
      refs.recentRowsTabs.querySelectorAll('[data-recent-rows]').forEach((button) => {
        button.addEventListener('click', () => {
          call('setRecentCount', Number(button.getAttribute('data-recent-rows')) * ITEMS_PER_ROW, { persist: true });
          update();
        });
      });
      if (typeof window.ResizeObserver === 'function') {
        // Re-measure the tab indicators once a collapsed body lays out, and when labels change width.
        tabResizeObserver = new window.ResizeObserver((entries) => entries.forEach((entry) => {
          const segmentedIndicator = root.LumnoSegmentedIndicator;
          if (segmentedIndicator) segmentedIndicator.sync(entry.target.querySelector('.x-nt-segmented-tabs-indicator'));
        }));
        [refs.bookmarkTopbarLayoutTabs, refs.recentModeTabs, refs.recentRowsTabs]
          .forEach((group) => tabResizeObserver.observe(group));
      }
      const onChanged = config.chromeObj && config.chromeObj.storage && config.chromeObj.storage.onChanged;
      if (onChanged) {
        onChanged.addListener(handleStorageChange);
        unsubscribe = () => onChanged.removeListener(handleStorageChange);
      }
      // The bodies ship hidden and are bound on the panel's first open; flush their first state
      // with transitions off so it does not play the collapsible entry animation.
      const bodies = [
        refs.bookmarkSettingsBody,
        refs.bookmarkGridSettings,
        refs.bookmarkTopbarSettings,
        refs.recentSettingsBody
      ];
      bodies.forEach((body) => { body.style.transition = 'none'; });
      update();
      bodies.forEach((body) => body.getBoundingClientRect());
      bodies.forEach((body) => { body.style.transition = ''; });
    }

    return Object.freeze({
      bindSettings,
      update,
      updateLanguage: update,
      handleStorageChange,
      destroy() {
        window.clearTimeout(updateTimer);
        saveTimers.forEach((timer) => window.clearTimeout(timer));
        saveTimers.clear();
        if (tabResizeObserver) tabResizeObserver.disconnect();
        if (unsubscribe) unsubscribe();
        refs = null;
      }
    });
  }

  return Object.freeze({ createRuntime });
});
