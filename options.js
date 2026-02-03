(function() {
  const panel = document.getElementById('_x_extension_settings_panel_2024_unique_');
  const themeButtons = Array.from(document.querySelectorAll('._x_extension_theme_option_2024_unique_'));
  const themePicker = document.querySelector('._x_extension_theme_picker_2024_unique_');
  const themeIndicator = themePicker ? themePicker.querySelector('._x_extension_theme_indicator_2024_unique_') : null;
  const tabButtons = Array.from(document.querySelectorAll('._x_extension_settings_tab_button_2024_unique_'));
  const tabContents = Array.from(document.querySelectorAll('._x_extension_settings_content_2024_unique_'));
  const tabsContainer = document.getElementById('_x_extension_settings_tabs_2024_unique_');
  const tabsIndicator = tabsContainer ? tabsContainer.querySelector('._x_extension_tabs_indicator_2024_unique_') : null;
  const settingsVersion = document.getElementById('_x_extension_settings_version_2024_unique_');
  const languageSelect = document.getElementById('_x_extension_language_select_2024_unique_');
  const recentCountSelect = document.getElementById('_x_extension_recent_count_select_2024_unique_');
  const restrictedActionSelect = document.getElementById('_x_extension_restricted_action_select_2024_unique_');
  const syncStatus = document.getElementById('_x_extension_sync_status_2024_unique_');
  const syncStatusText = document.getElementById('_x_extension_sync_status_text_2024_unique_');
  const syncNowButton = document.getElementById('_x_extension_sync_now_2024_unique_');
  const syncExportButton = document.getElementById('_x_extension_sync_export_2024_unique_');
  const syncImportButton = document.getElementById('_x_extension_sync_import_2024_unique_');
  const syncImportInput = document.getElementById('_x_extension_sync_import_input_2024_unique_');
  const openShortcutsButton = document.getElementById('_x_extension_open_shortcuts_2024_unique_');
  const shortcutsStatus = document.getElementById('_x_extension_shortcuts_status_2024_unique_');
  const customSelectWraps = Array.from(document.querySelectorAll('._x_extension_custom_select_2024_unique_'));
  const siteSearchCustomList = document.getElementById('_x_extension_site_search_custom_list_2024_unique_');
  const siteSearchBuiltinList = document.getElementById('_x_extension_site_search_builtin_list_2024_unique_');
  const siteSearchKeyInput = document.getElementById('_x_extension_site_search_key_2024_unique_');
  const siteSearchNameInput = document.getElementById('_x_extension_site_search_name_2024_unique_');
  const siteSearchTemplateInput = document.getElementById('_x_extension_site_search_template_2024_unique_');
  const siteSearchAliasInput = document.getElementById('_x_extension_site_search_alias_2024_unique_');
  const siteSearchForm = document.querySelector('._x_extension_shortcut_form_2024_unique_');
  const siteSearchFormTrigger = document.getElementById('_x_extension_site_search_expand_2024_unique_');
  const siteSearchAddButton = document.getElementById('_x_extension_site_search_add_2024_unique_');
  const siteSearchCancelButton = document.getElementById('_x_extension_site_search_cancel_2024_unique_');
  const siteSearchError = document.getElementById('_x_extension_site_search_error_2024_unique_');
  const builtinResetButton = document.getElementById('_x_extension_builtin_reset_2024_unique_');
  const customClearButton = document.getElementById('_x_extension_custom_clear_2024_unique_');
  const toastElement = document.getElementById('_x_extension_toast_2024_unique_');
  const confirmMask = document.getElementById('_x_extension_confirm_mask_2024_unique_');
  const confirmMessage = document.getElementById('_x_extension_confirm_message_2024_unique_');
  const confirmOk = document.getElementById('_x_extension_confirm_ok_2024_unique_');
  const confirmCancel = document.getElementById('_x_extension_confirm_cancel_2024_unique_');
  const confirmDialog = document.querySelector('._x_extension_confirm_dialog_2024_unique_');
  const extensionName = (chrome && chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().name) || 'Lumno';

  // 使用系统字体，避免外链字体依赖。
  if (!panel || themeButtons.length === 0 || tabButtons.length === 0) {
    return;
  }

  const storageArea = (chrome && chrome.storage && chrome.storage.sync)
    ? chrome.storage.sync
    : (chrome && chrome.storage ? chrome.storage.local : null);
  const storageAreaName = storageArea
    ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null;

  const RI_SPRITE_URL = (chrome && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('remixicon.symbol.svg')
    : 'remixicon.symbol.svg';

  function getRiSvg(id, sizeClass) {
    const size = sizeClass || 'ri-size-12';
    return `<svg class="ri-icon ${size}" aria-hidden="true" focusable="false"><use href="${RI_SPRITE_URL}#${id}"></use></svg>`;
  }

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
  const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
  const RESTRICTED_ACTION_STORAGE_KEY = '_x_extension_restricted_action_2024_unique_';
  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
  const SYNC_META_KEY = '_x_extension_sync_meta_2024_unique_';
  const SYNC_KEYS = [
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    LANGUAGE_MESSAGES_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    RESTRICTED_ACTION_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY
  ];
  const DEBUG_DUPLICATE_CUSTOM_KEY = 'dup';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;
  let defaultSiteSearchProviders = [];
  let customSiteSearchProviders = [];
  let disabledSiteSearchKeys = new Set();
  let toastTimer = null;
  let confirmResolver = null;
  let confirmOffset = { x: 0, y: 0 };
  let confirmClosingTimer = null;
  let bodyFixedSnapshot = null;
  let tooltipEl = null;
  let editingSiteSearchKey = null;
  let activePopconfirm = null;
  let siteSearchFormExpanded = false;
  let siteSearchRefreshSuppressUntil = 0;
  let siteSearchRefreshTimer = null;
  let currentShortcutLabel = null;
  const fallbackSiteSearchProviders = [
    { key: 'yt', aliases: ['youtube'], name: 'YouTube', template: 'https://www.youtube.com/results?search_query={query}' },
    { key: 'bb', aliases: ['bilibili', 'bili'], name: 'Bilibili', template: 'https://search.bilibili.com/all?keyword={query}' },
    { key: 'gh', aliases: ['github'], name: 'GitHub', template: 'https://github.com/search?q={query}' },
    { key: 'so', aliases: ['baidu', 'bd'], name: '百度', template: 'https://www.baidu.com/s?wd={query}' },
    { key: 'bi', aliases: ['bing'], name: 'Bing', template: 'https://www.bing.com/search?q={query}' },
    { key: 'gg', aliases: ['google'], name: 'Google', template: 'https://www.google.com/search?q={query}' },
    { key: 'zh', aliases: ['zhihu'], name: '知乎', template: 'https://www.zhihu.com/search?q={query}' },
    { key: 'db', aliases: ['douban'], name: '豆瓣', template: 'https://www.douban.com/search?q={query}' },
    { key: 'jj', aliases: ['juejin'], name: '掘金', template: 'https://juejin.cn/search?query={query}' },
    { key: 'tb', aliases: ['taobao'], name: '淘宝', template: 'https://s.taobao.com/search?q={query}' },
    { key: 'tm', aliases: ['tmall'], name: '天猫', template: 'https://list.tmall.com/search_product.htm?q={query}' },
    { key: 'wx', aliases: ['weixin', 'wechat'], name: '微信', template: 'https://weixin.sogou.com/weixin?query={query}' },
    { key: 'tw', aliases: ['twitter', 'x'], name: 'X', template: 'https://x.com/search?q={query}' },
    { key: 'rd', aliases: ['reddit'], name: 'Reddit', template: 'https://www.reddit.com/search/?q={query}' },
    { key: 'wk', aliases: ['wiki', 'wikipedia'], name: 'Wikipedia', template: 'https://en.wikipedia.org/wiki/Special:Search?search={query}' },
    { key: 'zw', aliases: ['zhwiki'], name: '维基百科', template: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}' }
  ];

  let currentMessages = null;
  let openCustomSelect = null;

  function migrateStorageIfNeeded(keys) {
    if (!storageArea || !chrome || !chrome.storage || !chrome.storage.local) {
      return;
    }
    if (storageArea === chrome.storage.local) {
      return;
    }
    chrome.storage.local.get(keys, (localResult) => {
      const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
      if (!hasLocal) {
        return;
      }
      storageArea.get(keys, (syncResult) => {
        const hasSync = keys.some((key) => typeof syncResult[key] !== 'undefined');
        if (hasSync) {
          return;
        }
        storageArea.set(localResult);
      });
    });
  }

  function getMessage(key, fallback) {
    if (currentMessages && currentMessages[key] && currentMessages[key].message) {
      return currentMessages[key].message;
    }
    if (chrome && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        return message;
      }
    }
    return fallback || '';
  }

  function formatTemplate(text, params) {
    return String(text || '').replace(/\{(\w+)\}/g, (match, key) => {
      if (params && Object.prototype.hasOwnProperty.call(params, key)) {
        return String(params[key]);
      }
      return match;
    });
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (!key) {
        return;
      }
      const fallback = node.textContent || '';
      const rawMessage = getMessage(key, fallback);
      const message = formatTemplate(rawMessage, { name: extensionName });
      if (message) {
        node.textContent = message;
        if (node.tagName === 'OPTION') {
          node.label = message;
        }
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.getAttribute('data-i18n-placeholder');
      if (!key) {
        return;
      }
      const fallback = node.getAttribute('placeholder') || '';
      const message = getMessage(key, fallback);
      if (message) {
        node.setAttribute('placeholder', message);
      }
    });
    document.querySelectorAll('[data-i18n-tooltip]').forEach((node) => {
      const key = node.getAttribute('data-i18n-tooltip');
      if (!key) {
        return;
      }
      const fallback = node.getAttribute('data-tooltip') || '';
      const message = getMessage(key, fallback);
      if (message) {
        node.setAttribute('data-tooltip', message);
        if (node.getAttribute('title')) {
          node.setAttribute('title', message);
        }
        if (node.getAttribute('aria-label')) {
          node.setAttribute('aria-label', message);
        }
      }
    });
  }

  function ensureTooltipElement() {
    if (tooltipEl) {
      return tooltipEl;
    }
    tooltipEl = document.createElement('div');
    tooltipEl.className = '_x_extension_tooltip_2024_unique_';
    tooltipEl.setAttribute('data-show', 'false');
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function showTooltipFor(target) {
    if (!target) {
      return;
    }
    const text = target.getAttribute('data-tooltip');
    if (!text) {
      return;
    }
    const el = ensureTooltipElement();
    el.textContent = text;
    const rect = target.getBoundingClientRect();
    const tooltipRect = el.getBoundingClientRect();
    const spacing = 8;
    let top = rect.top - tooltipRect.height - spacing;
    let left = rect.left + (rect.width - tooltipRect.width) / 2;
    if (top < 8) {
      top = rect.bottom + spacing;
    }
    if (left < 8) {
      left = 8;
    }
    const maxLeft = window.innerWidth - tooltipRect.width - 8;
    if (left > maxLeft) {
      left = Math.max(8, maxLeft);
    }
    el.style.top = `${Math.round(top)}px`;
    el.style.left = `${Math.round(left)}px`;
    el.setAttribute('data-show', 'true');
  }

  function hideTooltip() {
    if (!tooltipEl) {
      return;
    }
    tooltipEl.setAttribute('data-show', 'false');
  }

  function initTooltips() {
    const nodes = Array.from(document.querySelectorAll('[data-tooltip]'));
    nodes.forEach((node) => {
      if (node.dataset.tooltipBound === 'true') {
        return;
      }
      node.dataset.tooltipBound = 'true';
      node.classList.add('_x_extension_tooltip_host_2024_unique_');
      node.addEventListener('mouseenter', () => showTooltipFor(node));
      node.addEventListener('mouseleave', hideTooltip);
      node.addEventListener('focus', () => showTooltipFor(node));
      node.addEventListener('blur', hideTooltip);
    });
  }

  function getCustomSelectElements(wrapper) {
    if (!wrapper) {
      return {};
    }
    const selectId = wrapper.getAttribute('data-select');
    const select = selectId ? document.getElementById(selectId) : wrapper.querySelector('select');
    const trigger = wrapper.querySelector('._x_extension_select_trigger_2024_unique_');
    const menu = wrapper.querySelector('._x_extension_select_menu_2024_unique_');
    return { select, trigger, menu };
  }

  function setCustomSelectActiveIndex(wrapper, nextIndex) {
    const { menu } = getCustomSelectElements(wrapper);
    if (!menu) {
      return;
    }
    const items = Array.from(menu.children);
    if (items.length === 0) {
      return;
    }
    let index = Number.isFinite(nextIndex) ? nextIndex : 0;
    if (index < 0) {
      index = items.length - 1;
    }
    if (index >= items.length) {
      index = 0;
    }
    wrapper.setAttribute('data-active-index', String(index));
    items.forEach((item, itemIndex) => {
      if (itemIndex === index) {
        item.setAttribute('data-active', 'true');
      } else {
        item.removeAttribute('data-active');
      }
    });
  }

  function getCustomSelectActiveIndex(wrapper) {
    if (!wrapper) {
      return 0;
    }
    const raw = wrapper.getAttribute('data-active-index');
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function closeCustomSelect() {
    if (!openCustomSelect) {
      return;
    }
    openCustomSelect.setAttribute('data-open', 'false');
    const trigger = openCustomSelect.querySelector('._x_extension_select_trigger_2024_unique_');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
    openCustomSelect = null;
  }

  function setCustomSelectOpen(wrapper, nextOpen) {
    if (!wrapper) {
      return;
    }
    if (nextOpen) {
      if (openCustomSelect && openCustomSelect !== wrapper) {
        closeCustomSelect();
      }
      wrapper.setAttribute('data-open', 'true');
      const trigger = wrapper.querySelector('._x_extension_select_trigger_2024_unique_');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'true');
      }
      const { select, menu } = getCustomSelectElements(wrapper);
      if (select && menu) {
        const selectedIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
        setCustomSelectActiveIndex(wrapper, selectedIndex);
      }
      requestAnimationFrame(() => updateCustomSelectMenuWidth(wrapper));
      openCustomSelect = wrapper;
    } else if (openCustomSelect === wrapper) {
      closeCustomSelect();
    }
  }

  function syncCustomSelectUI(select, wrapper) {
    if (!select || !wrapper) {
      return;
    }
    const { trigger, menu } = getCustomSelectElements(wrapper);
    if (!trigger || !menu) {
      return;
    }
    const selected = select.options[select.selectedIndex];
    const label = selected ? (selected.label || selected.textContent || '') : '';
    let labelEl = trigger.querySelector('._x_extension_select_label_2024_unique_');
    if (!labelEl) {
      labelEl = document.createElement('span');
      labelEl.className = '_x_extension_select_label_2024_unique_';
      trigger.insertBefore(labelEl, trigger.firstChild);
    }
    labelEl.textContent = label;
    Array.from(menu.children).forEach((item) => {
      const value = item.getAttribute('data-value');
      const isSelected = value === select.value;
      item.setAttribute('data-selected', isSelected ? 'true' : 'false');
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  function buildCustomSelectMenu(select, wrapper) {
    if (!select || !wrapper) {
      return;
    }
    const { menu } = getCustomSelectElements(wrapper);
    if (!menu) {
      return;
    }
    menu.innerHTML = '';
    Array.from(select.options).forEach((option) => {
      const item = document.createElement('div');
      item.className = '_x_extension_select_option_2024_unique_';
      item.setAttribute('role', 'option');
      item.setAttribute('data-value', option.value);
      item.textContent = option.label || option.textContent || '';
      item.addEventListener('click', () => {
        if (select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncCustomSelectUI(select, wrapper);
        setCustomSelectOpen(wrapper, false);
      });
      menu.appendChild(item);
    });
    syncCustomSelectUI(select, wrapper);
    updateCustomSelectMenuWidth(wrapper);
  }

  function refreshCustomSelects() {
    customSelectWraps.forEach((wrapper) => {
      const { select } = getCustomSelectElements(wrapper);
      if (!select) {
        return;
      }
      buildCustomSelectMenu(select, wrapper);
    });
  }

  function updateCustomSelectMenuWidth(wrapper) {
    const { menu, trigger } = getCustomSelectElements(wrapper);
    if (!menu || !trigger) {
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const baseWidth = Math.round(triggerRect.width);
    if (!Number.isFinite(baseWidth) || baseWidth <= 0) {
      return;
    }
    menu.style.minWidth = `${baseWidth}px`;
    menu.style.width = `${baseWidth}px`;
    menu.style.right = '0';

    const menuStyle = window.getComputedStyle(menu);
    const padLeft = Number.parseFloat(menuStyle.paddingLeft) || 0;
    const padRight = Number.parseFloat(menuStyle.paddingRight) || 0;
    const availableWidth = Math.max(0, menu.clientWidth - padLeft - padRight);
    let needsExpand = false;
    Array.from(menu.children).forEach((item) => {
      if (item.scrollWidth > availableWidth + 1) {
        needsExpand = true;
      }
    });

    if (!needsExpand) {
      return;
    }

    let maxItemWidth = 0;
    Array.from(menu.children).forEach((item) => {
      if (item.scrollWidth > maxItemWidth) {
        maxItemWidth = item.scrollWidth;
      }
    });
    const naturalWidth = Math.ceil(maxItemWidth + padLeft + padRight);
    if (Number.isFinite(naturalWidth) && naturalWidth > baseWidth) {
      menu.style.width = `${naturalWidth}px`;
    }
  }

  function updateBuiltinResetTooltip() {
    if (!builtinResetButton) {
      return;
    }
    const text = getMessage('shortcuts_reset_builtin', '重置为初始列表');
    builtinResetButton.title = text;
    builtinResetButton.setAttribute('aria-label', text);
    builtinResetButton.setAttribute('data-tooltip', text);
  }

  function updateCustomClearTooltip() {
    if (!customClearButton) {
      return;
    }
    const text = getMessage('shortcuts_clear_custom', '清空自定义');
    customClearButton.title = text;
    customClearButton.setAttribute('aria-label', text);
    customClearButton.setAttribute('data-tooltip', text);
  }

  function showToast(message, isError) {
    if (!toastElement) {
      return;
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastElement.textContent = message;
    if (isError) {
      toastElement.style.setProperty('background', 'rgba(153, 27, 27, 0.92)');
    } else {
      toastElement.style.removeProperty('background');
    }
    toastElement.setAttribute('data-show', 'true');
    toastTimer = setTimeout(() => {
      toastElement.setAttribute('data-show', 'false');
    }, 2200);
  }

  function setSyncButtonEnabled(button, enabled) {
    if (!button) {
      return;
    }
    button.setAttribute('data-disabled', enabled ? 'false' : 'true');
  }


  function formatSyncTime(timestamp) {
    if (!timestamp) {
      return '';
    }
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return '';
    }
  }

  function updateSyncStatusText(statusKey, fallback, params) {
    if (!syncStatus) {
      return;
    }
    let statusStyle = '';
    let tooltipKey = 'sync_status_hint';
    if (statusKey === 'sync_status_ready' || statusKey === 'sync_status_done') {
      statusStyle = 'success';
      tooltipKey = 'sync_status_hint';
    } else if (statusKey === 'sync_status_failed' || statusKey === 'sync_status_failed_reason' || statusKey === 'sync_status_unavailable') {
      statusStyle = 'danger';
      tooltipKey = 'sync_status_unavailable_hint';
    }
    if (statusStyle) {
      syncStatus.setAttribute('data-status', statusStyle);
    } else {
      syncStatus.removeAttribute('data-status');
    }
    if (syncStatus.hasAttribute('data-i18n-tooltip')) {
      syncStatus.setAttribute('data-i18n-tooltip', tooltipKey);
    }
    syncStatus.setAttribute('data-tooltip', getMessage(tooltipKey, syncStatus.getAttribute('data-tooltip') || ''));
    const template = getMessage(statusKey, fallback);
    const target = syncStatusText || syncStatus;
    target.textContent = params ? formatTemplate(template, params) : template;
  }

  function updateSyncNowTooltip(timeText) {
    if (!syncNowButton) {
      return;
    }
    if (!timeText) {
      syncNowButton.setAttribute('data-tooltip', getMessage('sync_tooltip_default', '手动同步'));
      return;
    }
    const template = getMessage('sync_tooltip_last_manual', '最近导入/手动同步 {time}');
    syncNowButton.setAttribute('data-tooltip', formatTemplate(template, { time: timeText }));
    if (syncNowButton.matches(':hover') || syncNowButton.matches(':focus')) {
      showTooltipFor(syncNowButton);
    }
  }

  function refreshSyncStatus() {
    if (!syncStatus) {
      return;
    }
    if (!storageArea) {
      updateSyncStatusText('sync_status_unavailable', '同步不可用');
      setSyncButtonEnabled(syncNowButton, false);
      setSyncButtonEnabled(syncExportButton, false);
      setSyncButtonEnabled(syncImportButton, false);
      return;
    }
    if (storageAreaName !== 'sync') {
      updateSyncStatusText('sync_status_unavailable', '同步不可用');
      setSyncButtonEnabled(syncNowButton, false);
      setSyncButtonEnabled(syncExportButton, true);
      setSyncButtonEnabled(syncImportButton, true);
      return;
    }
    setSyncButtonEnabled(syncNowButton, true);
    setSyncButtonEnabled(syncExportButton, true);
    setSyncButtonEnabled(syncImportButton, true);
    updateSyncStatusText('sync_status_ready', '同步已开启');
    storageArea.get([SYNC_META_KEY], (result) => {
      const meta = result ? result[SYNC_META_KEY] : null;
      const lastSyncAt = meta && meta.lastSyncAt ? meta.lastSyncAt : '';
      updateSyncNowTooltip(lastSyncAt ? formatSyncTime(lastSyncAt) : '');
    });
  }

  function buildSyncPayload(result) {
    const data = {};
    SYNC_KEYS.forEach((key) => {
      if (typeof result[key] !== 'undefined') {
        data[key] = result[key];
      }
    });
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /*
  function showConfirm(message, trigger) {
    if (!confirmMask || !confirmMessage || !confirmOk || !confirmCancel || !confirmDialog) {
      return Promise.resolve(false);
    }
    if (confirmClosingTimer) {
      clearTimeout(confirmClosingTimer);
      confirmClosingTimer = null;
    }
    confirmMessage.textContent = message;
    confirmMask.setAttribute('data-show', 'true');
    if (confirmDialog) {
      confirmDialog.style.removeProperty('transform');
      confirmDialog.style.removeProperty('opacity');
    }
    if (!bodyFixedSnapshot) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      bodyFixedSnapshot = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width
      };
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.dataset._xScrollY = String(scrollY);
    }
    const rect = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const offsetX = centerX - window.innerWidth / 2;
    const offsetY = centerY - window.innerHeight / 2;
    confirmOffset = { x: offsetX, y: offsetY };
    confirmDialog.style.setProperty('transform', `translate(${offsetX}px, ${offsetY}px) scale(0.6)`);
    confirmDialog.style.setProperty('opacity', '0');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        confirmDialog.style.setProperty('transform', 'translate(0, 0) scale(1)');
        confirmDialog.style.setProperty('opacity', '1');
      });
    });
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function closeConfirm(result) {
    if (!confirmMask) {
      return;
    }
    if (confirmDialog) {
      confirmDialog.style.setProperty('transform', `translate(${confirmOffset.x}px, ${confirmOffset.y}px) scale(0.6)`);
      confirmDialog.style.setProperty('opacity', '0');
    }
    confirmClosingTimer = setTimeout(() => {
      confirmMask.setAttribute('data-show', 'false');
      if (confirmDialog) {
        confirmDialog.style.removeProperty('transform');
        confirmDialog.style.removeProperty('opacity');
      }
      if (bodyFixedSnapshot) {
        const restoreY = Number.parseFloat(document.body.dataset._xScrollY || '0') || 0;
        document.body.style.position = bodyFixedSnapshot.position;
        document.body.style.top = bodyFixedSnapshot.top;
        document.body.style.left = bodyFixedSnapshot.left;
        document.body.style.right = bodyFixedSnapshot.right;
        document.body.style.width = bodyFixedSnapshot.width;
        bodyFixedSnapshot = null;
        delete document.body.dataset._xScrollY;
        window.scrollTo(0, restoreY);
      }
      confirmClosingTimer = null;
    }, 340);
    if (confirmResolver) {
      confirmResolver(result);
      confirmResolver = null;
    }
  }
  */

  function closeActivePopconfirm() {
    if (activePopconfirm) {
      activePopconfirm.setAttribute('data-open', 'false');
      activePopconfirm = null;
    }
  }

  function attachPopconfirm(trigger, messageKey, fallbackMessage, onConfirm) {
    if (!trigger || !trigger.parentNode) {
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = '_x_extension_popconfirm_wrap_2024_unique_';
    const popconfirm = document.createElement('div');
    popconfirm.className = '_x_extension_popconfirm_2024_unique_';
    popconfirm.setAttribute('data-open', 'false');
    const popText = document.createElement('div');
    popText.className = '_x_extension_popconfirm_text_2024_unique_';
    popText.setAttribute('data-i18n', messageKey);
    popText.textContent = getMessage(messageKey, fallbackMessage);
    const popActions = document.createElement('div');
    popActions.className = '_x_extension_popconfirm_actions_2024_unique_';
    const popCancel = document.createElement('button');
    popCancel.className = '_x_extension_shortcut_secondary_2024_unique_';
    popCancel.setAttribute('data-i18n', 'confirm_cancel');
    popCancel.textContent = getMessage('confirm_cancel', '取消');
    const popOk = document.createElement('button');
    popOk.className = '_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_submit_primary_2024_unique_ _x_extension_shortcut_save_2024_unique_';
    popOk.setAttribute('data-i18n', 'confirm_ok');
    popOk.textContent = getMessage('confirm_ok', '确认');
    popActions.appendChild(popCancel);
    popActions.appendChild(popOk);
    popconfirm.appendChild(popText);
    popconfirm.appendChild(popActions);
    const parent = trigger.parentNode;
    parent.insertBefore(wrap, trigger);
    wrap.appendChild(trigger);
    wrap.appendChild(popconfirm);

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      if (activePopconfirm && activePopconfirm !== popconfirm) {
        closeActivePopconfirm();
      }
      const isOpen = popconfirm.getAttribute('data-open') === 'true';
      if (isOpen) {
        popconfirm.setAttribute('data-open', 'false');
        activePopconfirm = null;
      } else {
        popconfirm.setAttribute('data-open', 'true');
        activePopconfirm = popconfirm;
      }
    });

    popCancel.addEventListener('click', (event) => {
      event.stopPropagation();
      popconfirm.setAttribute('data-open', 'false');
      if (activePopconfirm === popconfirm) {
        activePopconfirm = null;
      }
    });

    popOk.addEventListener('click', (event) => {
      event.stopPropagation();
      popconfirm.setAttribute('data-open', 'false');
      if (activePopconfirm === popconfirm) {
        activePopconfirm = null;
      }
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });
  }

  function removeSiteSearchItem(key, isBuiltin) {
    if (isBuiltin) {
      disabledSiteSearchKeys.add(key.toLowerCase());
      saveDisabledSiteSearchKeys(disabledSiteSearchKeys).then(() => {
        refreshSiteSearchProviders();
        if (editingSiteSearchKey === key) {
          resetSiteSearchForm();
        }
        showToast(getMessage('toast_removed', '已移除'), false);
      }).catch(() => {
        showToast(getMessage('toast_error', '操作失败，请重试'), true);
      });
      return;
    }
    customSiteSearchProviders = customSiteSearchProviders.filter((item) => String(item.key || '') !== key);
    saveCustomSiteSearchProviders(customSiteSearchProviders).then(() => {
      refreshSiteSearchProviders();
      if (editingSiteSearchKey === key) {
        resetSiteSearchForm();
      }
      showToast(getMessage('toast_removed', '已移除'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试'), true);
    });
  }

  function normalizeLocale(locale) {
    const raw = String(locale || '').trim();
    if (!raw) {
      return 'en';
    }
    const lower = raw.toLowerCase();
    if (lower.startsWith('zh')) {
      if (lower.includes('hk')) {
        return 'zh_HK';
      }
      if (lower.includes('tw') || lower.includes('mo') || lower.includes('hant')) {
        return 'zh_TW';
      }
      return 'zh_CN';
    }
    return 'en';
  }

  function getSystemLocale() {
    if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
      return normalizeLocale(chrome.i18n.getUILanguage());
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function loadLocaleMessages(locale) {
    const normalized = normalizeLocale(locale);
    const localePath = chrome.runtime.getURL(`_locales/${normalized}/messages.json`);
    return fetch(localePath)
      .then((response) => response.json())
      .catch(() => ({}));
  }

  function applyLanguageMode(mode, options) {
    const targetLocale = mode === 'system' ? getSystemLocale() : normalizeLocale(mode);
    const shouldPersist = Boolean(options && options.persist);
    loadLocaleMessages(targetLocale).then((messages) => {
      currentMessages = messages || {};
      applyI18n();
      refreshCustomSelects();
      requestAnimationFrame(() => {
        updateTabIndicator();
        updateThemeIndicator();
      });
      if (languageSelect) {
        languageSelect.value = mode || 'system';
      }
      setEditingState(editingSiteSearchKey);
      updateBuiltinResetTooltip();
      updateCustomClearTooltip();
      refreshSyncStatus();
      refreshShortcutsStatus();
      if (confirmCancel) confirmCancel.textContent = getMessage('confirm_cancel', '取消');
      if (confirmOk) confirmOk.textContent = getMessage('confirm_ok', '确认');
      renderSiteSearchList();
      if (shouldPersist) {
        if (!storageArea) {
          return;
        }
        storageArea.set({
          [LANGUAGE_STORAGE_KEY]: mode || 'system',
          [LANGUAGE_MESSAGES_STORAGE_KEY]: {
            locale: targetLocale,
            messages: currentMessages
          }
        });
      }
    });
  }

  function refreshShortcutsStatus() {
    if (!shortcutsStatus) return;
    const fallback = `当前快捷键 ${currentShortcutLabel || '未设置'}`;
    const template = getMessage('settings_shortcuts_status', fallback);
    shortcutsStatus.textContent = formatTemplate(template, {
      shortcut: currentShortcutLabel || getMessage('settings_shortcuts_unset', '未设置')
    });
  }


  function loadCurrentShortcut() {
    if (!chrome || !chrome.commands || !chrome.commands.getAll) {
      currentShortcutLabel = null;
      refreshShortcutsStatus();
      return;
    }
    chrome.commands.getAll((commands) => {
      const items = Array.isArray(commands) ? commands : [];
      const showSearch = items.find((command) => command && command.name === 'show-search');
      currentShortcutLabel = showSearch && showSearch.shortcut ? showSearch.shortcut : null;
      refreshShortcutsStatus();
    });
  }


  function setActiveTab(tabKey) {
    tabButtons.forEach((button) => {
      const isActive = button.getAttribute('data-tab') === tabKey;
      button.setAttribute('data-active', isActive ? 'true' : 'false');
    });
    tabContents.forEach((content) => {
      const isActive = content.getAttribute('data-content') === tabKey;
      content.setAttribute('data-active', isActive ? 'true' : 'false');
    });
    requestAnimationFrame(updateTabIndicator);
    if (tabKey === 'appearance') {
      requestAnimationFrame(() => {
        requestAnimationFrame(updateThemeIndicator);
      });
    }
    if (tabKey) {
      const nextHash = `#${tabKey}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    }
  }

  function updateTabIndicator() {
    if (!tabsContainer || !tabsIndicator) return;
    const activeButton = tabButtons.find((button) => button.getAttribute('data-active') === 'true');
    if (!activeButton) return;
    const containerRect = tabsContainer.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const inset = 4;
    const offset = Math.round(buttonRect.left - containerRect.left - inset);
    tabsIndicator.style.width = `${Math.round(buttonRect.width)}px`;
    tabsIndicator.style.transform = `translateX(${offset}px)`;
  }

  if (settingsVersion && chrome?.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.version) {
      settingsVersion.textContent = `v${manifest.version}`;
    }
  }

  function applyResolvedTheme(resolvedTheme) {
    document.body.setAttribute('data-theme', resolvedTheme);
    panel.setAttribute('data-theme', resolvedTheme);
  }

  function resolveTheme(mode) {
    if (mode === 'dark') {
      return 'dark';
    }
    if (mode === 'light') {
      return 'light';
    }
    return mediaQuery.matches ? 'dark' : 'light';
  }

  function updateThemeButtons(mode) {
    themeButtons.forEach((button) => {
      const isActive = button.getAttribute('data-mode') === mode;
      button.setAttribute('data-active', isActive ? 'true' : 'false');
    });
    requestAnimationFrame(updateThemeIndicator);
  }

  function updateThemeIndicator() {
    if (!themePicker || !themeIndicator) return;
    const activeButton = themeButtons.find((button) => button.getAttribute('data-active') === 'true');
    if (!activeButton) return;
    const containerRect = themePicker.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const inset = 3;
    const offset = Math.round(buttonRect.left - containerRect.left - inset);
    themeIndicator.style.width = `${Math.round(buttonRect.width)}px`;
    themeIndicator.style.transform = `translateX(${offset}px)`;
  }

  function onMediaChange() {
    if (!storageArea) {
      return;
    }
    storageArea.get([THEME_STORAGE_KEY], (result) => {
      const mode = result[THEME_STORAGE_KEY] || 'system';
      if (mode === 'system') {
        applyResolvedTheme(resolveTheme(mode));
      }
    });
  }

  function setThemeMode(mode) {
    if (!storageArea) {
      return;
    }
    storageArea.set({ [THEME_STORAGE_KEY]: mode }, () => {
      updateThemeButtons(mode);
      applyResolvedTheme(resolveTheme(mode));
      if (mode === 'system' && !mediaListenerAttached) {
        mediaQuery.addEventListener('change', onMediaChange);
        mediaListenerAttached = true;
        return;
      }
      if (mode !== 'system' && mediaListenerAttached) {
        mediaQuery.removeEventListener('change', onMediaChange);
        mediaListenerAttached = false;
      }
    });
  }

  function getStoredThemeMode() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve('system');
        return;
      }
      storageArea.get([THEME_STORAGE_KEY], (result) => {
        resolve((result && result[THEME_STORAGE_KEY]) || 'system');
      });
    });
  }

  async function initTheme() {
    let ready = false;
    const fallbackTimer = setTimeout(() => {
      if (ready) {
        return;
      }
      applyResolvedTheme(resolveTheme('system'));
      document.documentElement.setAttribute('data-theme-ready', 'true');
    }, 800);
    try {
      const storedMode = await getStoredThemeMode();
      updateThemeButtons(storedMode);
      applyResolvedTheme(resolveTheme(storedMode));
      if (storedMode === 'system' && !mediaListenerAttached) {
        mediaQuery.addEventListener('change', onMediaChange);
        mediaListenerAttached = true;
      }
      ready = true;
      clearTimeout(fallbackTimer);
      document.documentElement.setAttribute('data-theme-ready', 'true');
    } catch (e) {
      ready = true;
      clearTimeout(fallbackTimer);
      applyResolvedTheme(resolveTheme('system'));
      document.documentElement.setAttribute('data-theme-ready', 'true');
    }
  }

  initTheme();

  themeButtons.forEach((button) => {
    button.addEventListener('click', function() {
      setThemeMode(button.getAttribute('data-mode'));
    });
  });

  applyLanguageMode('system');
  initTooltips();

  function getInitialTabKey() {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash) {
      return 'general';
    }
    const match = tabButtons.find((button) => button.getAttribute('data-tab') === hash);
    return match ? hash : 'general';
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', function() {
      const tabKey = button.getAttribute('data-tab');
      setActiveTab(tabKey);
      if (tabKey === 'shortcuts') {
        refreshSiteSearchProviders();
      }
    });
  });

  const initialTab = getInitialTabKey();
  setActiveTab(initialTab);
  if (initialTab === 'shortcuts') {
    refreshSiteSearchProviders();
  }
  window.addEventListener('resize', updateTabIndicator);
  window.addEventListener('resize', updateThemeIndicator);
  migrateStorageIfNeeded([
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    LANGUAGE_MESSAGES_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY
  ]);
  refreshSyncStatus();

  function normalizeSiteSearchTemplate(template) {
    if (!template) {
      return '';
    }
    return template
      .replace(/\{\{\{s\}\}\}/g, '{query}')
      .replace(/\{s\}/g, '{query}')
      .replace(/\{searchTerms\}/g, '{query}');
  }

  function isDuplicateTemplate(template, defaults) {
    const normalized = normalizeSiteSearchTemplate(String(template || '').trim());
    if (!normalized) {
      return false;
    }
    return (defaults || []).some((item) => normalizeSiteSearchTemplate(String(item.template || '').trim()) === normalized);
  }

  function normalizeAliases(input) {
    if (!input) {
      return [];
    }
    return Array.from(new Set(
      input
        .split(/[,，]/)
        .map((alias) => alias.trim())
        .filter(Boolean)
    ));
  }

  function setSiteSearchError(message) {
    if (!siteSearchError) {
      return;
    }
    if (!message) {
      siteSearchError.textContent = '';
      siteSearchError.style.display = 'none';
      return;
    }
    siteSearchError.textContent = message;
    siteSearchError.style.display = 'block';
  }

  function setSiteSearchFormExpanded(expanded) {
    siteSearchFormExpanded = Boolean(expanded);
    if (siteSearchForm) {
      siteSearchForm.setAttribute('data-expanded', siteSearchFormExpanded ? 'true' : 'false');
    }
    if (siteSearchFormTrigger) {
      siteSearchFormTrigger.setAttribute('aria-expanded', siteSearchFormExpanded ? 'true' : 'false');
    }
    if (siteSearchCancelButton) {
      siteSearchCancelButton.style.display = siteSearchFormExpanded ? 'inline-flex' : 'none';
      if (siteSearchCancelButton.textContent) {
        siteSearchCancelButton.textContent = getMessage('shortcuts_cancel', siteSearchCancelButton.textContent);
      }
    }
    if (siteSearchFormExpanded && siteSearchKeyInput) {
      siteSearchKeyInput.focus();
    }
  }

  function setEditingState(key) {
    editingSiteSearchKey = key;
    if (siteSearchAddButton) {
      siteSearchAddButton.textContent = key
        ? getMessage('shortcuts_save', '保存修改')
        : getMessage('shortcuts_add', '添加站内搜索');
      siteSearchAddButton.classList.add('_x_extension_shortcut_save_2024_unique_');
    }
  }

  function attachSaveButtonAnimation(button) {
    if (!button) {
      return;
    }
    button.addEventListener('click', () => {
      if (!button.classList.contains('_x_extension_shortcut_save_2024_unique_')) {
        return;
      }
      button.classList.remove('_x_extension_shortcut_save_pulse_2024_unique_');
      void button.offsetWidth;
      button.classList.add('_x_extension_shortcut_save_pulse_2024_unique_');
    });
    button.addEventListener('animationend', () => {
      button.classList.remove('_x_extension_shortcut_save_pulse_2024_unique_');
    });
  }

  function suspendSiteSearchRefresh(durationMs) {
    const now = Date.now();
    siteSearchRefreshSuppressUntil = Math.max(siteSearchRefreshSuppressUntil, now + durationMs);
  }

  if (languageSelect) {
    languageSelect.addEventListener('change', () => {
      const next = languageSelect.value || 'system';
      applyLanguageMode(next, { persist: true });
    });
  }

  if (recentCountSelect) {
    recentCountSelect.addEventListener('change', () => {
      const raw = recentCountSelect.value;
      const parsed = Number.parseInt(raw, 10);
      const nextCount = Number.isFinite(parsed) ? parsed : 4;
      if (!storageArea) {
        return;
      }
      storageArea.set({ [RECENT_COUNT_STORAGE_KEY]: nextCount });
    });
  }

  if (restrictedActionSelect) {
    restrictedActionSelect.addEventListener('change', () => {
      const next = restrictedActionSelect.value || 'lumno';
      if (!storageArea) {
        return;
      }
      storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: next });
    });
  }

  if (openShortcutsButton) {
    openShortcutsButton.addEventListener('click', () => {
      if (chrome && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      } else {
        window.open('chrome://extensions/shortcuts', '_blank');
      }
    });
  }

  loadCurrentShortcut();

  if (syncNowButton) {
    syncNowButton.addEventListener('click', () => {
      if (!storageArea || storageAreaName !== 'sync') {
        updateSyncStatusText('sync_status_unavailable', '同步不可用');
        return;
      }
      const isRotated = syncNowButton.getAttribute('data-rotated') === 'true';
      syncNowButton.setAttribute('data-rotated', isRotated ? 'false' : 'true');
      storageArea.get(SYNC_KEYS, (result) => {
        const payload = {};
        SYNC_KEYS.forEach((key) => {
          if (typeof result[key] !== 'undefined') {
            payload[key] = result[key];
          }
        });
        payload[SYNC_META_KEY] = {
          lastSyncAt: Date.now(),
          source: 'manual'
        };
        storageArea.set(payload, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            const reason = chrome.runtime && chrome.runtime.lastError
              ? chrome.runtime.lastError.message
              : '';
            setTimeout(() => {
              showToast(formatTemplate(getMessage('sync_status_failed_reason', '同步失败：{reason}'), {
                reason: reason || getMessage('sync_status_failed', '同步失败')
              }), true);
            }, 360);
            return;
          }
          const toastDelay = 360;
          setTimeout(() => {
            showToast(getMessage('sync_status_done', '同步完成'), false);
          }, toastDelay);
          setTimeout(() => {
            updateSyncNowTooltip(formatSyncTime(Date.now()));
          }, toastDelay + 60);
        });
      });
    });
  }

  if (syncExportButton) {
    syncExportButton.addEventListener('click', () => {
      if (!storageArea) {
        return;
      }
      storageArea.get(SYNC_KEYS, (result) => {
        const payload = buildSyncPayload(result || {});
        downloadJson(`lumno-settings-${Date.now()}.json`, payload);
        showToast(getMessage('sync_export_done', '已导出配置'), false);
      });
    });
  }

  if (syncImportButton && syncImportInput) {
    syncImportButton.addEventListener('click', () => {
      syncImportInput.click();
    });
    syncImportInput.addEventListener('change', (event) => {
      const file = event.target && event.target.files ? event.target.files[0] : null;
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        let parsed = null;
        try {
          parsed = JSON.parse(String(reader.result || ''));
        } catch (e) {
          parsed = null;
        }
        const data = parsed && parsed.data ? parsed.data : parsed;
        if (!data || typeof data !== 'object') {
          showToast(getMessage('sync_import_invalid', '配置文件无效'), true);
          syncImportInput.value = '';
          return;
        }
        const payload = {};
        SYNC_KEYS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            payload[key] = data[key];
          }
        });
        if (Object.keys(payload).length === 0) {
          showToast(getMessage('sync_import_invalid', '配置文件无效'), true);
          syncImportInput.value = '';
          return;
        }
        if (storageArea) {
          payload[SYNC_META_KEY] = {
            lastSyncAt: Date.now(),
            source: 'import'
          };
          storageArea.set(payload, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              const reason = chrome.runtime && chrome.runtime.lastError
                ? chrome.runtime.lastError.message
                : '';
              showToast(formatTemplate(getMessage('sync_status_failed_reason', '同步失败：{reason}'), {
                reason: reason || getMessage('sync_status_failed', '同步失败')
              }), true);
              syncImportInput.value = '';
              return;
            }
            showToast(getMessage('sync_import_done', '导入完成'), false);
            refreshSyncStatus();
          });
        }
        syncImportInput.value = '';
      };
      reader.readAsText(file);
    });
  }


  if (storageArea) {
    storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
      const hasStored = Object.prototype.hasOwnProperty.call(result, LANGUAGE_STORAGE_KEY);
      const stored = hasStored ? result[LANGUAGE_STORAGE_KEY] : 'system';
      if (!hasStored) {
        storageArea.set({ [LANGUAGE_STORAGE_KEY]: 'system' });
      }
      applyLanguageMode(stored || 'system');
    });

    storageArea.get([RECENT_COUNT_STORAGE_KEY], (result) => {
      const stored = result[RECENT_COUNT_STORAGE_KEY];
      const hasStored = Number.isFinite(stored);
      const count = hasStored ? stored : 4;
      if (recentCountSelect) {
        recentCountSelect.value = String(count);
      }
      if (!hasStored) {
        storageArea.set({ [RECENT_COUNT_STORAGE_KEY]: count });
      }
      refreshCustomSelects();
    });

    storageArea.get([RESTRICTED_ACTION_STORAGE_KEY], (result) => {
      const stored = result[RESTRICTED_ACTION_STORAGE_KEY];
      const hasStored = typeof stored === 'string';
      const nextAction = hasStored ? stored : 'lumno';
      if (restrictedActionSelect) {
        restrictedActionSelect.value = nextAction;
      }
      if (!hasStored) {
        storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: nextAction });
      }
      refreshCustomSelects();
    });
  }

  customSelectWraps.forEach((wrapper) => {
    const { select, trigger } = getCustomSelectElements(wrapper);
    if (!select || !trigger) {
      return;
    }
    trigger.addEventListener('click', () => {
      const isOpen = wrapper.getAttribute('data-open') === 'true';
      setCustomSelectOpen(wrapper, !isOpen);
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setCustomSelectOpen(wrapper, true);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = getCustomSelectActiveIndex(wrapper) + delta;
        setCustomSelectActiveIndex(wrapper, nextIndex);
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const isOpen = wrapper.getAttribute('data-open') === 'true';
        if (!isOpen) {
          setCustomSelectOpen(wrapper, true);
          return;
        }
        const { menu } = getCustomSelectElements(wrapper);
        const activeIndex = getCustomSelectActiveIndex(wrapper);
        const item = menu && menu.children ? menu.children[activeIndex] : null;
        if (item) {
          item.click();
        }
      }
    });
    select.addEventListener('change', () => {
      syncCustomSelectUI(select, wrapper);
    });
  });

  document.addEventListener('click', (event) => {
    if (!openCustomSelect) {
      return;
    }
    if (openCustomSelect.contains(event.target)) {
      return;
    }
    closeCustomSelect();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCustomSelect();
    }
    if (!openCustomSelect) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = getCustomSelectActiveIndex(openCustomSelect) + delta;
      setCustomSelectActiveIndex(openCustomSelect, nextIndex);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const { menu } = getCustomSelectElements(openCustomSelect);
      const activeIndex = getCustomSelectActiveIndex(openCustomSelect);
      const item = menu && menu.children ? menu.children[activeIndex] : null;
      if (item) {
        item.click();
      }
    }
  });

  document.addEventListener('click', (event) => {
    if (!activePopconfirm) {
      return;
    }
    const wrap = activePopconfirm.closest('._x_extension_popconfirm_wrap_2024_unique_');
    if (wrap && wrap.contains(event.target)) {
      return;
    }
    closeActivePopconfirm();
  });

  function resetSiteSearchForm() {
    if (siteSearchKeyInput) siteSearchKeyInput.value = '';
    if (siteSearchNameInput) siteSearchNameInput.value = '';
    if (siteSearchTemplateInput) siteSearchTemplateInput.value = '';
    if (siteSearchAliasInput) siteSearchAliasInput.value = '';
    setSiteSearchError('');
    setEditingState(null);
    setSiteSearchFormExpanded(false);
  }

  setSiteSearchFormExpanded(false);

  function renderSiteSearchList() {
    if (!siteSearchCustomList || !siteSearchBuiltinList) {
      return;
    }
    siteSearchCustomList.innerHTML = '';
    siteSearchBuiltinList.innerHTML = '';
    const builtinRowByTemplate = new Map();
    const customKeys = new Set(customSiteSearchProviders.map((item) => String(item.key || '').toLowerCase()));
    const displayDefaults = defaultSiteSearchProviders.filter((item) => {
      const key = String(item.key || '').toLowerCase();
      return key && !customKeys.has(key) && !disabledSiteSearchKeys.has(key);
    });
    const builtinTemplateSet = new Set(defaultSiteSearchProviders.map((item) => normalizeSiteSearchTemplate(String(item.template || '').trim())).filter(Boolean));
    const renderItem = (item, list) => {
      const row = document.createElement('div');
      row.className = '_x_extension_shortcut_item_2024_unique_';
      row.setAttribute('data-expanded', 'false');
      row.dataset.key = item.key || '';
      row.dataset.type = item._xIsCustom ? 'custom' : 'builtin';
      const normalizedTemplate = normalizeSiteSearchTemplate(String(item.template || '').trim());
      if (!item._xIsCustom && normalizedTemplate) {
        row.dataset.template = normalizedTemplate;
        builtinRowByTemplate.set(normalizedTemplate, row);
      }
      const header = document.createElement('div');
      header.className = '_x_extension_shortcut_item_header_2024_unique_';
      const info = document.createElement('div');
      info.className = '_x_extension_shortcut_item_info_2024_unique_';
      const title = document.createElement('div');
      title.className = '_x_extension_shortcut_item_title_2024_unique_';
      const badge = document.createElement('div');
      badge.className = '_x_extension_shortcut_badge_2024_unique_';
      badge.textContent = item._xIsCustom
        ? getMessage('shortcuts_badge_custom', '自定义')
        : getMessage('shortcuts_badge_builtin', '内置');
      const titleText = document.createElement('span');
      titleText.textContent = item.name || item.key;
      title.appendChild(badge);
      if (item._xIsCustom && normalizedTemplate && builtinTemplateSet.has(normalizedTemplate)) {
        const duplicateTag = document.createElement('button');
        duplicateTag.type = 'button';
        duplicateTag.className = '_x_extension_shortcut_badge_2024_unique_ _x_extension_shortcut_badge_warn_2024_unique_';
        duplicateTag.setAttribute('data-template', normalizedTemplate);
        duplicateTag.setAttribute('title', getMessage('shortcuts_duplicate_action', '定位内置项'));
        duplicateTag.setAttribute('aria-label', getMessage('shortcuts_duplicate_action', '定位内置项'));
        duplicateTag.innerHTML = `${getRiSvg('ri-question-line', 'ri-size-12')}${getMessage('shortcuts_duplicate_tag', '与内置重复')}`;
        duplicateTag.addEventListener('click', (event) => {
          event.stopPropagation();
          const targetRow = builtinRowByTemplate.get(normalizedTemplate);
          if (!targetRow) {
            return;
          }
          targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetRow.removeAttribute('data-flash');
          void targetRow.offsetWidth;
          targetRow.setAttribute('data-flash', 'true');
          const onFlashEnd = () => {
            targetRow.removeAttribute('data-flash');
            targetRow.removeEventListener('animationend', onFlashEnd);
          };
          targetRow.addEventListener('animationend', onFlashEnd);
        });
        title.appendChild(duplicateTag);
      }
      title.appendChild(titleText);
      const meta = document.createElement('div');
      meta.className = '_x_extension_shortcut_item_meta_2024_unique_';
      meta.textContent = `${item.key} · ${item.template || ''}`;
      info.appendChild(title);
      info.appendChild(meta);
      const actions = document.createElement('div');
      actions.className = '_x_extension_shortcut_item_actions_2024_unique_';
      const editButton = document.createElement('button');
      editButton.className = '_x_extension_shortcut_edit_2024_unique_';
      editButton.innerHTML = getRiSvg('ri-edit-line', 'ri-size-14');
      editButton.dataset.editKey = item.key || '';
      editButton.dataset.editType = item._xIsCustom ? 'custom' : 'builtin';
      actions.appendChild(editButton);
      const removeButton = document.createElement('button');
      removeButton.className = '_x_extension_shortcut_remove_2024_unique_';
      removeButton.innerHTML = getRiSvg('ri-delete-bin-4-line', 'ri-size-14');
      removeButton.setAttribute('aria-label', getMessage('shortcuts_remove', '移除'));
      actions.appendChild(removeButton);
      const popconfirm = document.createElement('div');
      popconfirm.className = '_x_extension_popconfirm_2024_unique_';
      popconfirm.setAttribute('data-open', 'false');
      const popText = document.createElement('div');
      popText.className = '_x_extension_popconfirm_text_2024_unique_';
      popText.textContent = getMessage('confirm_remove_item', '确认移除该项？');
      const popActions = document.createElement('div');
      popActions.className = '_x_extension_popconfirm_actions_2024_unique_';
      const popCancel = document.createElement('button');
      popCancel.className = '_x_extension_shortcut_secondary_2024_unique_';
      popCancel.textContent = getMessage('confirm_cancel', '取消');
      const popOk = document.createElement('button');
      popOk.className = '_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_submit_primary_2024_unique_ _x_extension_shortcut_save_2024_unique_';
      popOk.textContent = getMessage('confirm_ok', '确认');
      popActions.appendChild(popCancel);
      popActions.appendChild(popOk);
      popconfirm.appendChild(popText);
      popconfirm.appendChild(popActions);
      const popWrap = document.createElement('div');
      popWrap.className = '_x_extension_popconfirm_wrap_2024_unique_';
      popWrap.appendChild(removeButton);
      popWrap.appendChild(popconfirm);
      actions.appendChild(popWrap);
      header.appendChild(info);
      header.appendChild(actions);
      row.appendChild(header);
      const editor = document.createElement('div');
      editor.className = '_x_extension_shortcut_editor_2024_unique_';
      const templateField = document.createElement('div');
      templateField.className = '_x_extension_shortcut_field_2024_unique_';
      const templateLabelRow = document.createElement('div');
      templateLabelRow.className = '_x_extension_shortcut_label_row_2024_unique_';
      const templateLabel = document.createElement('label');
      templateLabel.className = '_x_extension_shortcut_label_2024_unique_';
      const templateLabelText = document.createElement('span');
      templateLabelText.setAttribute('data-i18n', 'shortcuts_label_template');
      templateLabelText.textContent = getMessage('shortcuts_label_template', '搜索模板');
      const templateRequired = document.createElement('span');
      templateRequired.className = '_x_extension_shortcut_required_2024_unique_';
      templateRequired.textContent = '*';
      const templateHint = document.createElement('span');
      templateHint.className = '_x_extension_shortcut_hint_2024_unique_ _x_extension_shortcut_group_action_2024_unique_';
      templateHint.setAttribute('data-tooltip', getMessage(
        'shortcuts_template_help',
        '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
      ));
      templateHint.setAttribute('aria-label', getMessage(
        'shortcuts_template_help',
        '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
      ));
      templateHint.innerHTML = getRiSvg('ri-question-line', 'ri-size-14');
      templateLabel.appendChild(templateLabelText);
      templateLabel.appendChild(templateRequired);
      templateLabelRow.appendChild(templateLabel);
      templateLabelRow.appendChild(templateRequired);
      templateLabelRow.appendChild(templateHint);
      const templateInput = document.createElement('input');
      templateInput.className = '_x_extension_shortcut_input_2024_unique_';
      templateInput.value = item.template || '';
      templateInput.disabled = !item._xIsCustom;
      templateField.appendChild(templateLabelRow);
      templateField.appendChild(templateInput);

      const keyField = document.createElement('div');
      keyField.className = '_x_extension_shortcut_field_2024_unique_';
      const keyLabel = document.createElement('label');
      keyLabel.className = '_x_extension_shortcut_label_2024_unique_';
      const keyLabelText = document.createElement('span');
      keyLabelText.setAttribute('data-i18n', 'shortcuts_label_key');
      keyLabelText.textContent = getMessage('shortcuts_label_key', '触发词');
      const keyRequired = document.createElement('span');
      keyRequired.className = '_x_extension_shortcut_required_2024_unique_';
      keyRequired.textContent = '*';
      keyLabel.appendChild(keyLabelText);
      keyLabel.appendChild(keyRequired);
      const keyInput = document.createElement('input');
      keyInput.className = '_x_extension_shortcut_input_2024_unique_';
      keyInput.value = item.key || '';
      keyInput.placeholder = getMessage('shortcuts_placeholder_required', '必填，如有多个用英文逗号分隔，如 jd,bili');
      keyField.appendChild(keyLabel);
      keyField.appendChild(keyInput);

      const nameField = document.createElement('div');
      nameField.className = '_x_extension_shortcut_field_2024_unique_';
      const nameLabel = document.createElement('label');
      nameLabel.className = '_x_extension_shortcut_label_2024_unique_';
      nameLabel.textContent = getMessage('shortcuts_label_name', '显示名称');
      const nameInput = document.createElement('input');
      nameInput.className = '_x_extension_shortcut_input_2024_unique_';
      nameInput.value = item.name || item.key || '';
      nameInput.placeholder = getMessage('shortcuts_placeholder_optional_default', '选填，默认使用触发词');
      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);

      const aliasField = document.createElement('div');
      aliasField.className = '_x_extension_shortcut_field_2024_unique_';
      const aliasLabel = document.createElement('label');
      aliasLabel.className = '_x_extension_shortcut_label_2024_unique_';
      const aliasLabelText = document.createElement('span');
      aliasLabelText.setAttribute('data-i18n', 'shortcuts_label_alias');
      aliasLabelText.textContent = getMessage('shortcuts_label_alias', '别名');
      const aliasRequired = document.createElement('span');
      aliasRequired.className = '_x_extension_shortcut_required_2024_unique_';
      aliasRequired.textContent = '*';
      aliasLabel.appendChild(aliasLabelText);
      aliasLabel.appendChild(aliasRequired);
      const aliasInput = document.createElement('input');
      aliasInput.className = '_x_extension_shortcut_input_2024_unique_';
      aliasInput.value = Array.isArray(item.aliases) ? item.aliases.join(',') : '';
      aliasInput.placeholder = getMessage('shortcuts_placeholder_alias', '选填，例如 小破站、油管等');
      aliasField.appendChild(aliasLabel);
      aliasField.appendChild(aliasInput);

      const editorActions = document.createElement('div');
      editorActions.className = '_x_extension_shortcut_editor_actions_2024_unique_';
      const saveButton = document.createElement('button');
      saveButton.className = '_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_submit_primary_2024_unique_ _x_extension_shortcut_save_2024_unique_';
      saveButton.textContent = getMessage('shortcuts_save', '保存修改');
      const cancelButton = document.createElement('button');
      cancelButton.className = '_x_extension_shortcut_secondary_2024_unique_';
      cancelButton.textContent = getMessage('shortcuts_cancel', '取消');
      editorActions.appendChild(cancelButton);
      editorActions.appendChild(saveButton);
      attachSaveButtonAnimation(saveButton);

      cancelButton.addEventListener('click', () => {
        row.setAttribute('data-expanded', 'false');
      });
      saveButton.addEventListener('click', () => {
        suspendSiteSearchRefresh(260);
        const nextKeyRaw = String(keyInput.value || '').trim();
        if (!nextKeyRaw) {
          showToast(getMessage('shortcuts_error_key', '请填写触发词。'), true);
          return;
        }
        if (/\s/.test(nextKeyRaw)) {
          showToast(getMessage('shortcuts_error_key_space', '触发词不能包含空格。'), true);
          return;
        }
        const templateRaw = String(templateInput.value || '').trim();
        const template = normalizeSiteSearchTemplate(templateRaw);
        if (!template || !template.includes('{query}')) {
          showToast(getMessage('toast_error_template', '搜索模板必须包含 {query}。'), true);
          return;
        }
        const aliases = normalizeAliases(aliasInput.value || '');
        const normalizedKey = nextKeyRaw.toLowerCase();
        let next = customSiteSearchProviders.filter((entry) => String(entry.key || '').toLowerCase() !== normalizedKey);
        const previousKey = String(item.key || '').toLowerCase();
        if (previousKey && previousKey !== normalizedKey) {
          next = next.filter((entry) => String(entry.key || '').toLowerCase() !== previousKey);
        }
        const shouldDisable = isDuplicateTemplate(template, defaultSiteSearchProviders);
        next.unshift({
          key: nextKeyRaw,
          name: String(nameInput.value || '').trim() || nextKeyRaw,
          template: template,
          aliases: aliases,
          disabled: shouldDisable,
          disabledReason: shouldDisable ? 'duplicate' : ''
        });
        disabledSiteSearchKeys.delete(normalizedKey);
        Promise.all([
          saveCustomSiteSearchProviders(next),
          saveDisabledSiteSearchKeys(disabledSiteSearchKeys)
        ]).then(() => {
          customSiteSearchProviders = next;
          row.setAttribute('data-expanded', 'false');
          const finalize = () => {
            showToast(getMessage('toast_saved', '已保存'), false);
          };
          if (saveButton.classList.contains('_x_extension_shortcut_save_2024_unique_')) {
            setTimeout(finalize, 220);
          } else {
            finalize();
          }
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试'), true);
        });
      });

      editor.appendChild(templateField);
      editor.appendChild(keyField);
      editor.appendChild(nameField);
      editor.appendChild(aliasField);
      editor.appendChild(editorActions);
      row.appendChild(editor);
      removeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (activePopconfirm && activePopconfirm !== popconfirm) {
          closeActivePopconfirm();
        }
        const isOpen = popconfirm.getAttribute('data-open') === 'true';
        if (isOpen) {
          popconfirm.setAttribute('data-open', 'false');
          activePopconfirm = null;
        } else {
          popconfirm.setAttribute('data-open', 'true');
          activePopconfirm = popconfirm;
        }
      });
      popCancel.addEventListener('click', (event) => {
        event.stopPropagation();
        popconfirm.setAttribute('data-open', 'false');
        if (activePopconfirm === popconfirm) {
          activePopconfirm = null;
        }
      });
      popOk.addEventListener('click', (event) => {
        event.stopPropagation();
        popconfirm.setAttribute('data-open', 'false');
        if (activePopconfirm === popconfirm) {
          activePopconfirm = null;
        }
        removeSiteSearchItem(item.key || '', !item._xIsCustom);
      });
      list.appendChild(row);
    };
    if (customSiteSearchProviders.length === 0) {
      // 保留虚线添加框即可
    } else {
      customSiteSearchProviders.forEach((item) => {
        renderItem({ ...item, _xIsCustom: true }, siteSearchCustomList);
      });
    }
    if (displayDefaults.length === 0) {
      const empty = document.createElement('div');
      empty.className = '_x_extension_settings_placeholder_2024_unique_';
      empty.textContent = getMessage('shortcuts_empty_builtin', '暂无内置站内搜索');
      siteSearchBuiltinList.appendChild(empty);
    } else {
      displayDefaults.forEach((item) => {
        renderItem({ ...item, _xIsCustom: false }, siteSearchBuiltinList);
      });
    }
    initTooltips();
  }

  function loadDefaultSiteSearchProviders() {
    const localUrl = chrome.runtime.getURL('site-search.json');
    return fetch(localUrl)
      .then((resp) => resp.json())
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        return items.length > 0 ? items : fallbackSiteSearchProviders;
      })
      .catch(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getSiteSearchProviders' }, (response) => {
          const items = response && Array.isArray(response.items) ? response.items : [];
          resolve(items.length > 0 ? items : fallbackSiteSearchProviders);
        });
      }));
  }

  function normalizeAliasList(list) {
    const items = Array.isArray(list) ? list : [];
    const cleaned = items
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(cleaned)).sort();
  }

  function isSameProviderContent(a, b) {
    if (!a || !b) {
      return false;
    }
    const nameA = String(a.name || a.key || '').trim();
    const nameB = String(b.name || b.key || '').trim();
    const templateA = normalizeSiteSearchTemplate(String(a.template || '').trim());
    const templateB = normalizeSiteSearchTemplate(String(b.template || '').trim());
    if (nameA !== nameB || templateA !== templateB) {
      return false;
    }
    const aliasA = normalizeAliasList(a.aliases);
    const aliasB = normalizeAliasList(b.aliases);
    return JSON.stringify(aliasA) === JSON.stringify(aliasB);
  }

  function filterRedundantCustomProviders(defaults, custom) {
    const map = new Map((defaults || []).map((item) => [String(item.key || '').toLowerCase(), item]));
    return (custom || []).filter((item) => {
      const key = String(item.key || '').toLowerCase();
      const base = map.get(key);
      if (!base) {
        return true;
      }
      return !isSameProviderContent(item, base);
    });
  }

  function loadCustomSiteSearchProviders() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SITE_SEARCH_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
        resolve(items);
      });
    });
  }

  function loadDisabledSiteSearchKeys() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
          ? result[SITE_SEARCH_DISABLED_STORAGE_KEY]
          : [];
        resolve(items.map((item) => String(item).toLowerCase()).filter(Boolean));
      });
    });
  }

  function saveDisabledSiteSearchKeys(keys) {
    const payload = Array.from(keys || [])
      .map((item) => String(item).toLowerCase())
      .filter(Boolean);
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve();
        return;
      }
      storageArea.set({ [SITE_SEARCH_DISABLED_STORAGE_KEY]: payload }, () => resolve());
    });
  }

  function saveCustomSiteSearchProviders(items) {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve();
        return;
      }
      storageArea.set({ [SITE_SEARCH_STORAGE_KEY]: items }, () => resolve());
    });
  }

  function refreshSiteSearchProviders() {
    if (!siteSearchCustomList || !siteSearchBuiltinList) {
      return;
    }
    if (defaultSiteSearchProviders.length === 0) {
      defaultSiteSearchProviders = fallbackSiteSearchProviders.slice();
      renderSiteSearchList();
    }
    Promise.all([
      loadDefaultSiteSearchProviders(),
      loadCustomSiteSearchProviders(),
      loadDisabledSiteSearchKeys()
    ]).then(([defaults, custom, disabled]) => {
      defaultSiteSearchProviders = defaults;
      const filteredCustom = filterRedundantCustomProviders(defaults, custom);
      const withoutDebug = filteredCustom.filter((item) => String(item.key || '').toLowerCase() !== DEBUG_DUPLICATE_CUSTOM_KEY);
      const didFilter = filteredCustom.length !== (custom || []).length;
      const didRemoveDebug = withoutDebug.length !== filteredCustom.length;
      let nextCustom = withoutDebug.map((item) => {
        const shouldDisable = isDuplicateTemplate(item.template, defaults);
        return {
          ...item,
          disabled: shouldDisable,
          disabledReason: shouldDisable ? 'duplicate' : ''
        };
      });
      const didUpdateDisabled = nextCustom.some((item, index) => {
        const before = filteredCustom[index] || {};
        return Boolean(before.disabled) !== Boolean(item.disabled) ||
          String(before.disabledReason || '') !== String(item.disabledReason || '');
      });
      customSiteSearchProviders = nextCustom;
      disabledSiteSearchKeys = new Set(disabled || []);
      if (didFilter || didUpdateDisabled || didRemoveDebug) {
        saveCustomSiteSearchProviders(nextCustom);
      }
      const filteredBase = defaultSiteSearchProviders.filter((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        return key && !disabledSiteSearchKeys.has(key);
      });
      if (filteredBase.length === 0 && customSiteSearchProviders.length === 0 && defaultSiteSearchProviders.length > 0) {
        disabledSiteSearchKeys = new Set();
        saveDisabledSiteSearchKeys(disabledSiteSearchKeys);
      }
      renderSiteSearchList();
    });
  }

  if (siteSearchCustomList && siteSearchBuiltinList) {
    refreshSiteSearchProviders();
  }

  function handleSiteSearchListClick(event) {
      const target = event.target;
      if (!target) {
        return;
      }
      const editTarget = target.closest ? target.closest('button[data-edit-key]') : null;
      if (editTarget) {
        const key = String(editTarget.dataset.editKey || '');
        const isBuiltin = editTarget.dataset.editType === 'builtin';
        const match = isBuiltin
          ? defaultSiteSearchProviders.find((item) => String(item.key || '') === key)
          : customSiteSearchProviders.find((item) => String(item.key || '') === key);
        if (match) {
          const row = editTarget.closest('._x_extension_shortcut_item_2024_unique_');
          if (row) {
            row.setAttribute('data-expanded', row.getAttribute('data-expanded') === 'true' ? 'false' : 'true');
          }
          return;
        }
        return;
      }
      if (target.closest && target.closest('._x_extension_popconfirm_2024_unique_')) {
        return;
      }
    }

  if (siteSearchCustomList) {
    siteSearchCustomList.addEventListener('click', handleSiteSearchListClick);
  }
  if (siteSearchBuiltinList) {
    siteSearchBuiltinList.addEventListener('click', handleSiteSearchListClick);
  }
  document.addEventListener('click', (event) => {
    if (!activePopconfirm) {
      return;
    }
    if (event.target && event.target.closest && event.target.closest('._x_extension_popconfirm_2024_unique_')) {
      return;
    }
    if (event.target && event.target.closest && event.target.closest('._x_extension_shortcut_remove_2024_unique_')) {
      return;
    }
    closeActivePopconfirm();
  });

  if (siteSearchCancelButton) {
    siteSearchCancelButton.addEventListener('click', function() {
      resetSiteSearchForm();
    });
  }

  if (siteSearchFormTrigger) {
    siteSearchFormTrigger.addEventListener('click', () => {
      setSiteSearchFormExpanded(true);
    });
  }

  if (siteSearchAddButton) {
    attachSaveButtonAnimation(siteSearchAddButton);
    siteSearchAddButton.addEventListener('click', function() {
      if (!siteSearchFormExpanded) {
        setSiteSearchFormExpanded(true);
        return;
      }
      suspendSiteSearchRefresh(260);
      setSiteSearchError('');
      const key = String(siteSearchKeyInput ? siteSearchKeyInput.value : '').trim();
      const name = String(siteSearchNameInput ? siteSearchNameInput.value : '').trim();
      const templateRaw = String(siteSearchTemplateInput ? siteSearchTemplateInput.value : '').trim();
      const aliases = normalizeAliases(siteSearchAliasInput ? siteSearchAliasInput.value : '');
      if (!key) {
        setSiteSearchError('请填写触发词。');
        return;
      }
      if (/\s/.test(key)) {
        setSiteSearchError('触发词不能包含空格。');
        return;
      }
      const template = normalizeSiteSearchTemplate(templateRaw);
      if (!template || !template.includes('{query}')) {
        setSiteSearchError('搜索模板必须包含 {query}。');
        return;
      }
      const normalizedKey = key.toLowerCase();
      let next = customSiteSearchProviders.filter((item) => String(item.key || '').toLowerCase() !== normalizedKey);
      if (editingSiteSearchKey && editingSiteSearchKey.toLowerCase() !== normalizedKey) {
        next = next.filter((item) => String(item.key || '').toLowerCase() !== editingSiteSearchKey.toLowerCase());
      }
      next.unshift({
        key: key,
        name: name || key,
        template: template,
        aliases: aliases
      });
      const lowerKey = normalizedKey;
      disabledSiteSearchKeys.delete(lowerKey);
      Promise.all([
        saveCustomSiteSearchProviders(next),
        saveDisabledSiteSearchKeys(disabledSiteSearchKeys)
      ]).then(() => {
        customSiteSearchProviders = next;
        renderSiteSearchList();
        refreshSiteSearchProviders();
        resetSiteSearchForm();
        setTimeout(() => {
          showToast(getMessage('toast_saved', '已保存'), false);
        }, 220);
      });
    });
  }

  if (builtinResetButton) {
    attachPopconfirm(
      builtinResetButton,
      'confirm_reset_builtin',
      '确认重置内置列表？',
      () => {
        Promise.all([loadDefaultSiteSearchProviders(), loadCustomSiteSearchProviders()]).then(([defaults, custom]) => {
          const defaultKeys = new Set((defaults || []).map((item) => String(item.key || '').toLowerCase()));
          const filteredCustom = (custom || []).filter((item) => {
            const key = String(item && item.key ? item.key : '').toLowerCase();
            return key && !defaultKeys.has(key);
          });
          Promise.all([
            saveCustomSiteSearchProviders(filteredCustom),
            saveDisabledSiteSearchKeys(new Set())
          ]).then(() => {
            customSiteSearchProviders = filteredCustom;
            disabledSiteSearchKeys = new Set();
            renderSiteSearchList();
            showToast(getMessage('toast_reset', '已重置'), false);
          }).catch(() => {
            showToast(getMessage('toast_error', '操作失败，请重试'), true);
          });
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试'), true);
        });
      }
    );
  }

  if (customClearButton) {
    attachPopconfirm(
      customClearButton,
      'confirm_clear_custom',
      '确认清空自定义搜索？',
      () => {
        saveCustomSiteSearchProviders([]).then(() => {
          customSiteSearchProviders = [];
          renderSiteSearchList();
          showToast(getMessage('toast_cleared', '已清空'), false);
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试'), true);
        });
      }
    );
  }

  /*
  if (confirmOk) {
    confirmOk.addEventListener('click', () => closeConfirm(true));
  }
  if (confirmCancel) {
    confirmCancel.addEventListener('click', () => closeConfirm(false));
  }
  if (confirmMask) {
    confirmMask.addEventListener('click', (event) => {
      if (event.target === confirmMask) {
        closeConfirm(false));
      }
    });
  }
  */

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!storageAreaName || areaName !== storageAreaName) {
      return;
    }
    if (changes[SYNC_META_KEY] ||
        changes[THEME_STORAGE_KEY] ||
        changes[LANGUAGE_STORAGE_KEY] ||
        changes[RECENT_COUNT_STORAGE_KEY] ||
        changes[RESTRICTED_ACTION_STORAGE_KEY] ||
        changes[SITE_SEARCH_STORAGE_KEY] ||
        changes[SITE_SEARCH_DISABLED_STORAGE_KEY] ||
        changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY]) {
      refreshSyncStatus();
    }
    if (changes[THEME_STORAGE_KEY]) {
      const nextMode = changes[THEME_STORAGE_KEY].newValue || 'system';
      updateThemeButtons(nextMode);
      applyResolvedTheme(resolveTheme(nextMode));
    }
    if (changes[LANGUAGE_STORAGE_KEY]) {
      applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
    }
    if (changes[RECENT_COUNT_STORAGE_KEY] && recentCountSelect) {
      const stored = Number.parseInt(changes[RECENT_COUNT_STORAGE_KEY].newValue, 10);
      const count = Number.isFinite(stored) ? stored : 4;
      recentCountSelect.value = String(count);
      refreshCustomSelects();
    }
    if (changes[RESTRICTED_ACTION_STORAGE_KEY] && restrictedActionSelect) {
      const nextValue = changes[RESTRICTED_ACTION_STORAGE_KEY].newValue || 'lumno';
      restrictedActionSelect.value = nextValue;
      refreshCustomSelects();
    }
    if (!changes[SITE_SEARCH_STORAGE_KEY] && !changes[SITE_SEARCH_DISABLED_STORAGE_KEY]) {
      return;
    }
    const now = Date.now();
    if (siteSearchRefreshSuppressUntil && now < siteSearchRefreshSuppressUntil) {
      if (siteSearchRefreshTimer) {
        clearTimeout(siteSearchRefreshTimer);
      }
      const delay = Math.max(siteSearchRefreshSuppressUntil - now, 0) + 40;
      siteSearchRefreshTimer = setTimeout(() => {
        siteSearchRefreshTimer = null;
        refreshSiteSearchProviders();
      }, delay);
      return;
    }
    refreshSiteSearchProviders();
  });
})();
