(function() {
  const panel = document.getElementById('_x_extension_settings_panel_2024_unique_');
  const themeButtons = Array.from(document.querySelectorAll('._x_extension_theme_option_2024_unique_'));
  const tabButtons = Array.from(document.querySelectorAll('._x_extension_settings_tab_button_2024_unique_'));
  const tabContents = Array.from(document.querySelectorAll('._x_extension_settings_content_2024_unique_'));
  const tabsContainer = document.getElementById('_x_extension_settings_tabs_2024_unique_');
  const tabsIndicator = tabsContainer ? tabsContainer.querySelector('._x_extension_tabs_indicator_2024_unique_') : null;
  const languageSelect = document.getElementById('_x_extension_language_select_2024_unique_');
  const recentCountSelect = document.getElementById('_x_extension_recent_count_select_2024_unique_');
  const siteSearchCustomList = document.getElementById('_x_extension_site_search_custom_list_2024_unique_');
  const siteSearchBuiltinList = document.getElementById('_x_extension_site_search_builtin_list_2024_unique_');
  const siteSearchKeyInput = document.getElementById('_x_extension_site_search_key_2024_unique_');
  const siteSearchNameInput = document.getElementById('_x_extension_site_search_name_2024_unique_');
  const siteSearchTemplateInput = document.getElementById('_x_extension_site_search_template_2024_unique_');
  const siteSearchAliasInput = document.getElementById('_x_extension_site_search_alias_2024_unique_');
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
  if (!panel || themeButtons.length === 0 || tabButtons.length === 0) {
    return;
  }

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
  const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;
  let defaultSiteSearchProviders = [];
  let customSiteSearchProviders = [];
  let disabledSiteSearchKeys = new Set();
  let toastTimer = null;
  let confirmResolver = null;
  let confirmOffset = { x: 0, y: 0 };
  let confirmClosingTimer = null;
  let editingSiteSearchKey = null;
  let activePopconfirm = null;
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

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (!key) {
        return;
      }
      const fallback = node.textContent || '';
      const message = getMessage(key, fallback);
      if (message) {
        node.textContent = message;
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
    document.body.style.overflow = 'hidden';
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
      document.body.style.overflow = '';
      confirmClosingTimer = null;
    }, 340);
    if (confirmResolver) {
      confirmResolver(result);
      confirmResolver = null;
    }
  }

  function closeActivePopconfirm() {
    if (activePopconfirm) {
      activePopconfirm.setAttribute('data-open', 'false');
      activePopconfirm = null;
    }
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
      if (languageSelect) {
        languageSelect.value = mode || 'system';
      }
      setEditingState(editingSiteSearchKey);
      updateBuiltinResetTooltip();
      updateCustomClearTooltip();
      if (confirmCancel) confirmCancel.textContent = getMessage('confirm_cancel', '取消');
      if (confirmOk) confirmOk.textContent = getMessage('confirm_ok', '确认');
      renderSiteSearchList();
      if (shouldPersist) {
        chrome.storage.local.set({
          [LANGUAGE_STORAGE_KEY]: mode || 'system',
          [LANGUAGE_MESSAGES_STORAGE_KEY]: {
            locale: targetLocale,
            messages: currentMessages
          }
        });
      }
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
  }

  function onMediaChange() {
    chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
      const mode = result[THEME_STORAGE_KEY] || 'system';
      if (mode === 'system') {
        applyResolvedTheme(resolveTheme(mode));
      }
    });
  }

  function setThemeMode(mode) {
    chrome.storage.local.set({ [THEME_STORAGE_KEY]: mode }, () => {
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

  chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
    const storedMode = result[THEME_STORAGE_KEY] || 'system';
    setThemeMode(storedMode);
  });

  themeButtons.forEach((button) => {
    button.addEventListener('click', function() {
      setThemeMode(button.getAttribute('data-mode'));
    });
  });

  applyLanguageMode('system');

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

  function normalizeSiteSearchTemplate(template) {
    if (!template) {
      return '';
    }
    return template
      .replace(/\{\{\{s\}\}\}/g, '{query}')
      .replace(/\{s\}/g, '{query}')
      .replace(/\{searchTerms\}/g, '{query}');
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

  function setEditingState(key) {
    editingSiteSearchKey = key;
    if (siteSearchAddButton) {
      siteSearchAddButton.textContent = key
        ? getMessage('shortcuts_save', '保存修改')
        : getMessage('shortcuts_add', '添加站内搜索');
    }
    if (siteSearchCancelButton) {
      siteSearchCancelButton.style.display = key ? 'inline-flex' : 'none';
      if (siteSearchCancelButton.textContent) {
        siteSearchCancelButton.textContent = getMessage('shortcuts_cancel', siteSearchCancelButton.textContent);
      }
    }
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
      chrome.storage.local.set({ [RECENT_COUNT_STORAGE_KEY]: nextCount });
    });
  }

  chrome.storage.local.get([LANGUAGE_STORAGE_KEY], (result) => {
    const stored = result[LANGUAGE_STORAGE_KEY] || 'system';
    applyLanguageMode(stored);
  });

  chrome.storage.local.get([RECENT_COUNT_STORAGE_KEY], (result) => {
    const stored = result[RECENT_COUNT_STORAGE_KEY];
    const count = Number.isFinite(stored) ? stored : 4;
    if (recentCountSelect) {
      recentCountSelect.value = String(count);
    }
  });

  function resetSiteSearchForm() {
    if (siteSearchKeyInput) siteSearchKeyInput.value = '';
    if (siteSearchNameInput) siteSearchNameInput.value = '';
    if (siteSearchTemplateInput) siteSearchTemplateInput.value = '';
    if (siteSearchAliasInput) siteSearchAliasInput.value = '';
    setSiteSearchError('');
    setEditingState(null);
  }

  function renderSiteSearchList() {
    if (!siteSearchCustomList || !siteSearchBuiltinList) {
      return;
    }
    siteSearchCustomList.innerHTML = '';
    siteSearchBuiltinList.innerHTML = '';
    const customKeys = new Set(customSiteSearchProviders.map((item) => String(item.key || '').toLowerCase()));
    const displayDefaults = defaultSiteSearchProviders.filter((item) => {
      const key = String(item.key || '').toLowerCase();
      return key && !customKeys.has(key) && !disabledSiteSearchKeys.has(key);
    });
    const renderItem = (item, list) => {
      const row = document.createElement('div');
      row.className = '_x_extension_shortcut_item_2024_unique_';
      row.setAttribute('data-expanded', 'false');
      row.dataset.key = item.key || '';
      row.dataset.type = item._xIsCustom ? 'custom' : 'builtin';
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
      editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>${getMessage('shortcuts_edit', '编辑')}`;
      editButton.dataset.editKey = item.key || '';
      editButton.dataset.editType = item._xIsCustom ? 'custom' : 'builtin';
      actions.appendChild(editButton);
      const removeButton = document.createElement('button');
      removeButton.className = '_x_extension_shortcut_remove_2024_unique_';
      removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg>`;
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
      popOk.className = '_x_extension_shortcut_edit_2024_unique_';
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
      const keyField = document.createElement('div');
      keyField.className = '_x_extension_shortcut_field_2024_unique_';
      const keyLabel = document.createElement('label');
      keyLabel.className = '_x_extension_shortcut_label_2024_unique_';
      keyLabel.textContent = getMessage('shortcuts_label_key', '触发词（例如 jd、bili）');
      const keyInput = document.createElement('input');
      keyInput.className = '_x_extension_shortcut_input_2024_unique_';
      keyInput.value = item.key || '';
      keyInput.disabled = !item._xIsCustom;
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
      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);

      const templateField = document.createElement('div');
      templateField.className = '_x_extension_shortcut_field_2024_unique_';
      const templateLabel = document.createElement('label');
      templateLabel.className = '_x_extension_shortcut_label_2024_unique_';
      templateLabel.textContent = getMessage('shortcuts_label_template', '搜索模板（必须包含 {query}）');
      const templateInput = document.createElement('input');
      templateInput.className = '_x_extension_shortcut_input_2024_unique_';
      templateInput.value = item.template || '';
      templateField.appendChild(templateLabel);
      templateField.appendChild(templateInput);

      const aliasField = document.createElement('div');
      aliasField.className = '_x_extension_shortcut_field_2024_unique_';
      const aliasLabel = document.createElement('label');
      aliasLabel.className = '_x_extension_shortcut_label_2024_unique_';
      aliasLabel.textContent = getMessage('shortcuts_label_alias', '别名（逗号分隔）');
      const aliasInput = document.createElement('input');
      aliasInput.className = '_x_extension_shortcut_input_2024_unique_';
      aliasInput.value = Array.isArray(item.aliases) ? item.aliases.join(',') : '';
      aliasField.appendChild(aliasLabel);
      aliasField.appendChild(aliasInput);

      const editorActions = document.createElement('div');
      editorActions.className = '_x_extension_shortcut_editor_actions_2024_unique_';
      const saveButton = document.createElement('button');
      saveButton.className = '_x_extension_shortcut_submit_2024_unique_';
      saveButton.textContent = getMessage('shortcuts_save', '保存修改');
      const cancelButton = document.createElement('button');
      cancelButton.className = '_x_extension_shortcut_secondary_2024_unique_';
      cancelButton.textContent = getMessage('shortcuts_cancel', '取消');
      editorActions.appendChild(cancelButton);
      editorActions.appendChild(saveButton);

      cancelButton.addEventListener('click', () => {
        row.setAttribute('data-expanded', 'false');
      });
      saveButton.addEventListener('click', () => {
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
        next.unshift({
          key: nextKeyRaw,
          name: String(nameInput.value || '').trim() || nextKeyRaw,
          template: template,
          aliases: aliases
        });
        disabledSiteSearchKeys.delete(normalizedKey);
        Promise.all([
          saveCustomSiteSearchProviders(next),
          saveDisabledSiteSearchKeys(disabledSiteSearchKeys)
        ]).then(() => {
          customSiteSearchProviders = next;
          row.setAttribute('data-expanded', 'false');
          renderSiteSearchList();
          showToast(getMessage('toast_saved', '已保存'), false);
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试'), true);
        });
      });

      editor.appendChild(keyField);
      editor.appendChild(nameField);
      editor.appendChild(templateField);
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
      const empty = document.createElement('div');
      empty.className = '_x_extension_settings_placeholder_2024_unique_';
      empty.textContent = getMessage('shortcuts_empty_custom', '暂未添加自定义站内搜索');
      siteSearchCustomList.appendChild(empty);
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
      chrome.storage.local.get([SITE_SEARCH_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
        resolve(items);
      });
    });
  }

  function loadDisabledSiteSearchKeys() {
    return new Promise((resolve) => {
      chrome.storage.local.get([SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
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
      chrome.storage.local.set({ [SITE_SEARCH_DISABLED_STORAGE_KEY]: payload }, () => resolve());
    });
  }

  function saveCustomSiteSearchProviders(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [SITE_SEARCH_STORAGE_KEY]: items }, () => resolve());
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
    Promise.all([loadDefaultSiteSearchProviders(), loadCustomSiteSearchProviders(), loadDisabledSiteSearchKeys()])
      .then(([defaults, custom, disabled]) => {
      defaultSiteSearchProviders = defaults;
      const filteredCustom = filterRedundantCustomProviders(defaults, custom);
      customSiteSearchProviders = filteredCustom;
      if (filteredCustom.length !== (custom || []).length) {
        saveCustomSiteSearchProviders(filteredCustom);
      }
      disabledSiteSearchKeys = new Set(disabled || []);
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
      if (!target || !target.dataset) {
        return;
      }
      if (target.dataset.editKey) {
        const key = String(target.dataset.editKey);
        const isBuiltin = target.dataset.editType === 'builtin';
        const match = isBuiltin
          ? defaultSiteSearchProviders.find((item) => String(item.key || '') === key)
          : customSiteSearchProviders.find((item) => String(item.key || '') === key);
        if (match) {
          const row = target.closest('._x_extension_shortcut_item_2024_unique_');
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

  if (siteSearchAddButton) {
    siteSearchAddButton.addEventListener('click', function() {
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
        resetSiteSearchForm();
      });
    });
  }

  if (builtinResetButton) {
    builtinResetButton.addEventListener('click', () => {
      showConfirm(getMessage('confirm_reset_builtin', '确认重置内置列表？'), builtinResetButton)
        .then((confirmed) => {
        if (!confirmed) {
          return;
        }
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
      });
    });
  }

  if (customClearButton) {
    customClearButton.addEventListener('click', () => {
      showConfirm(getMessage('confirm_clear_custom', '确认清空自定义搜索？'), customClearButton)
        .then((confirmed) => {
        if (!confirmed) {
          return;
        }
        saveCustomSiteSearchProviders([]).then(() => {
          customSiteSearchProviders = [];
          renderSiteSearchList();
          showToast(getMessage('toast_cleared', '已清空'), false);
        }).catch(() => {
          showToast(getMessage('toast_error', '操作失败，请重试'), true);
        });
      });
    });
  }

  if (confirmOk) {
    confirmOk.addEventListener('click', () => closeConfirm(true));
  }
  if (confirmCancel) {
    confirmCancel.addEventListener('click', () => closeConfirm(false));
  }
  if (confirmMask) {
    confirmMask.addEventListener('click', (event) => {
      if (event.target === confirmMask) {
        closeConfirm(false);
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' ||
        (!changes[SITE_SEARCH_STORAGE_KEY] && !changes[SITE_SEARCH_DISABLED_STORAGE_KEY])) {
      return;
    }
    refreshSiteSearchProviders();
  });
})();
