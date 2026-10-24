// The Options switches (and the one select) that each store one value under
// one key. The page binds every entry the same way: read and normalize at
// startup, follow storage changes, persist the control's own changes, and
// write the normalized value back when the stored one was missing or
// invalid. Entries are bound in this order, which is also the order their
// startup reads resolve in.
//
//   inputId         the control's element id
//   kind            the React toggle kind it renders as (none for a plain one)
//   key, normalize  storage key and normalizer
//   control         'select' for a select; toggles by default
//   refreshSelects  refresh the custom selects after applying
//   afterApply      page function to run after applying a value (from hooks)
//   load            false when a section reads the key with related keys
//   repairOnLoad/repairOnChange, normalizeInput: see createSettingBinder
//
// hooks: { faviconBlacklistEditor, newtabShortcutSubcontrols,
//          selectionQuickActionsAvailability } — page functions some
//          switches run after a value is applied; tests may leave them out.
function getToggleSettings(settings, hooks) {
  const S = settings;
  const page = hooks || {};
  const isNotFalse = (value) => value !== false;
  const isTrue = (value) => value === true;
  return Object.freeze([
    {
      inputId: '_x_extension_overlay_page_theme_adaptation_toggle_2026_unique_',
      key: S.OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY,
      normalize: S.normalizeOverlayPageThemeAdaptationEnabled
    },
    {
      inputId: '_x_extension_overlay_open_tabs_default_visible_toggle_2026_unique_',
      kind: 'overlay-open-tabs-default-visible',
      key: S.OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY,
      normalize: S.normalizeOverlayOpenTabsDefaultVisible
    },
    {
      inputId: '_x_extension_favicon_enhanced_fetch_toggle_2026_unique_',
      kind: 'favicon-enhanced-fetch',
      key: S.FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
      normalize: S.normalizeFaviconEnhancedFetchEnabled,
      afterApply: page.faviconBlacklistEditor
    },
    {
      inputId: '_x_extension_bookmark_folder_icons_visible_toggle_2026_unique_',
      kind: 'bookmark-folder-icons-visible',
      key: S.BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY,
      normalize: S.normalizeBookmarkFolderIconsVisible
    },
    {
      // Quick switching is always on; the stored value is repaired to true
      // after a stray change, so the switch writes what it shows.
      inputId: '_x_extension_overlay_tab_quick_switch_2024_unique_',
      kind: 'overlay-tab-quick-switch',
      key: S.OVERLAY_TAB_PRIORITY_STORAGE_KEY,
      normalize: () => true,
      normalizeInput: Boolean,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_newtab_time_seconds_toggle_2026_unique_',
      kind: 'newtab-time-seconds',
      key: S.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY,
      normalize: S.normalizeNewtabTimeSecondsVisible
    },
    {
      inputId: '_x_extension_newtab_time_12_hour_toggle_2026_unique_',
      kind: 'newtab-time-12-hour',
      key: S.NEWTAB_TIME_12_HOUR_STORAGE_KEY,
      normalize: S.normalizeNewtabTime12Hour
    },
    {
      inputId: '_x_extension_newtab_input_auto_focus_toggle_2026_unique_',
      kind: 'newtab-input-auto-focus',
      key: S.NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
      normalize: S.normalizeNewtabInputAutoFocusEnabled
    },
    {
      inputId: '_x_extension_newtab_shortcuts_toggle_2026_unique_',
      kind: 'newtab-shortcuts',
      key: S.NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
      normalize: S.normalizeNewtabShortcutsVisible,
      afterApply: page.newtabShortcutSubcontrols,
      load: false
    },
    {
      inputId: '_x_extension_newtab_shortcut_add_toggle_2026_unique_',
      kind: 'newtab-shortcut-add',
      key: S.NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
      normalize: S.normalizeNewtabShortcutAddVisible,
      load: false
    },
    {
      inputId: '_x_extension_newtab_shortcut_dock_magnification_toggle_2026_unique_',
      kind: 'newtab-shortcut-dock-magnification',
      key: S.NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
      normalize: S.normalizeNewtabShortcutDockMagnificationEnabled,
      load: false
    },
    {
      inputId: '_x_extension_newtab_feedback_button_visible_toggle_2026_unique_',
      kind: 'newtab-feedback-button-visible',
      key: S.NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
      normalize: S.normalizeNewtabFeedbackButtonVisible
    },
    {
      inputId: '_x_extension_newtab_appearance_button_visible_toggle_2026_unique_',
      kind: 'newtab-appearance-button-visible',
      key: S.NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY,
      normalize: S.normalizeNewtabAppearanceButtonVisible
    },
    {
      inputId: '_x_extension_update_notice_toggle_2026_unique_',
      kind: 'update-notice',
      key: S.UPDATE_NOTICE_ENABLED_STORAGE_KEY,
      normalize: S.normalizeUpdateNoticeEnabled,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_motion_effects_toggle_2026_unique_',
      kind: 'motion-effects',
      key: S.MOTION_EFFECTS_ENABLED_STORAGE_KEY,
      normalize: S.normalizeMotionEffectsEnabled,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_simple_mode_toggle_2026_unique_',
      kind: 'simple-mode',
      key: S.SIMPLE_MODE_ENABLED_STORAGE_KEY,
      normalize: S.normalizeSimpleModeEnabled,
      refreshSelects: true
    },
    {
      // Shown as stored; Options never rewrites this value.
      inputId: '_x_extension_progress_tracking_toggle_2026_unique_',
      key: S.PROGRESS_TRACKING_ENABLED_STORAGE_KEY,
      normalize: S.normalizeProgressTrackingEnabled,
      repairOnLoad: false,
      repairOnChange: false
    },
    {
      inputId: '_x_extension_number_shortcut_instant_toggle_2026_unique_',
      key: S.NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY,
      normalize: S.normalizeNumberShortcutInstantEnabled,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_search_fuzzy_pinyin_toggle_2026_unique_',
      key: S.SEARCH_FUZZY_PINYIN_ENABLED_STORAGE_KEY,
      normalize: S.normalizeSearchFuzzyPinyinEnabled
    },
    {
      inputId: '_x_extension_macos_ctrl_suggestion_navigation_toggle_2026_unique_',
      key: S.MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY,
      normalize: S.normalizeMacosCtrlSuggestionNavigationEnabled,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_auto_pip_toggle_2024_unique_',
      kind: 'auto-pip',
      key: S.AUTO_PIP_ENABLED_STORAGE_KEY,
      normalize: isNotFalse,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_tab_switcher_toggle_2026_unique_',
      kind: 'tab-switcher',
      key: S.TAB_SWITCHER_ENABLED_STORAGE_KEY,
      normalize: S.normalizeTabSwitcherEnabled,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_tab_switcher_shift_tab_toggle_2026_unique_',
      key: S.TAB_SWITCHER_SHIFT_TAB_ENABLED_STORAGE_KEY,
      normalize: (value) => value === true
    },
    {
      // Read together with the aggregate searches it is derived from.
      inputId: '_x_extension_aggregate_search_auto_group_toggle_2026_unique_',
      kind: 'aggregate-search-auto-group',
      key: S.AGGREGATE_SEARCH_AUTO_GROUP_ENABLED_STORAGE_KEY,
      normalize: S.normalizeAggregateSearchAutoGroupEnabled,
      refreshSelects: true,
      load: false
    },
    {
      inputId: '_x_extension_document_pip_toggle_2026_unique_',
      kind: 'document-pip',
      key: S.DOCUMENT_PIP_ENABLED_STORAGE_KEY,
      normalize: isTrue,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_pinned_tab_recovery_toggle_2026_unique_',
      kind: 'pinned-tab-recovery',
      key: S.PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY,
      normalize: isTrue,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_selection_quick_actions_toggle_2026_unique_',
      kind: 'selection-quick-actions',
      key: S.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY,
      normalize: S.normalizeSelectionQuickActionsEnabled,
      refreshSelects: true,
      afterApply: page.selectionQuickActionsAvailability
    },
    {
      inputId: '_x_extension_selection_quick_actions_provider_select_2026_unique_',
      control: 'select',
      key: S.SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY,
      normalize: S.normalizeSelectionQuickActionsProvider,
      refreshSelects: true
    },
    {
      inputId: '_x_extension_selection_quick_actions_group_toggle_2026_unique_',
      kind: 'selection-quick-actions-group',
      key: S.SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY,
      normalize: S.normalizeSelectionQuickActionsGroupEnabled,
      refreshSelects: true,
      afterApply: page.selectionQuickActionsAvailability
    }
  ].map((entry) => Object.freeze(entry)));
}

export { getToggleSettings };
