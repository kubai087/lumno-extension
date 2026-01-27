(function() {
  const panel = document.getElementById('_x_extension_settings_panel_2024_unique_');
  const themeButtons = Array.from(document.querySelectorAll('._x_extension_theme_option_2024_unique_'));
  const tabButtons = Array.from(document.querySelectorAll('._x_extension_settings_tab_button_2024_unique_'));
  const tabContents = Array.from(document.querySelectorAll('._x_extension_settings_content_2024_unique_'));
  const siteSearchCustomList = document.getElementById('_x_extension_site_search_custom_list_2024_unique_');
  const siteSearchBuiltinList = document.getElementById('_x_extension_site_search_builtin_list_2024_unique_');
  const siteSearchKeyInput = document.getElementById('_x_extension_site_search_key_2024_unique_');
  const siteSearchNameInput = document.getElementById('_x_extension_site_search_name_2024_unique_');
  const siteSearchTemplateInput = document.getElementById('_x_extension_site_search_template_2024_unique_');
  const siteSearchAliasInput = document.getElementById('_x_extension_site_search_alias_2024_unique_');
  const siteSearchAddButton = document.getElementById('_x_extension_site_search_add_2024_unique_');
  const siteSearchCancelButton = document.getElementById('_x_extension_site_search_cancel_2024_unique_');
  const siteSearchError = document.getElementById('_x_extension_site_search_error_2024_unique_');
  if (!panel || themeButtons.length === 0 || tabButtons.length === 0) {
    return;
  }

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;
  let defaultSiteSearchProviders = [];
  let customSiteSearchProviders = [];
  let editingSiteSearchKey = null;

  function setActiveTab(tabKey) {
    tabButtons.forEach((button) => {
      const isActive = button.getAttribute('data-tab') === tabKey;
      button.setAttribute('data-active', isActive ? 'true' : 'false');
    });
    tabContents.forEach((content) => {
      const isActive = content.getAttribute('data-content') === tabKey;
      content.setAttribute('data-active', isActive ? 'true' : 'false');
    });
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

  tabButtons.forEach((button) => {
    button.addEventListener('click', function() {
      setActiveTab(button.getAttribute('data-tab'));
    });
  });

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
      siteSearchAddButton.textContent = key ? '保存修改' : '添加站内搜索';
    }
    if (siteSearchCancelButton) {
      siteSearchCancelButton.style.display = key ? 'inline-flex' : 'none';
    }
  }

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
      return key && !customKeys.has(key);
    });
    const renderItem = (item, list) => {
      const row = document.createElement('div');
      row.className = '_x_extension_shortcut_item_2024_unique_';
      const info = document.createElement('div');
      info.className = '_x_extension_shortcut_item_info_2024_unique_';
      const title = document.createElement('div');
      title.className = '_x_extension_shortcut_item_title_2024_unique_';
      title.textContent = item.name || item.key;
      const meta = document.createElement('div');
      meta.className = '_x_extension_shortcut_item_meta_2024_unique_';
      meta.textContent = `${item.key} · ${item.template || ''}`;
      info.appendChild(title);
      info.appendChild(meta);
      const actions = document.createElement('div');
      actions.className = '_x_extension_shortcut_item_actions_2024_unique_';
      const badge = document.createElement('div');
      badge.className = '_x_extension_shortcut_badge_2024_unique_';
      badge.textContent = item._xIsCustom ? '自定义' : '内置';
      actions.appendChild(badge);
      if (item._xIsCustom) {
        const editButton = document.createElement('button');
        editButton.className = '_x_extension_shortcut_remove_2024_unique_';
        editButton.textContent = '编辑';
        editButton.dataset.editKey = item.key || '';
        actions.appendChild(editButton);
        const removeButton = document.createElement('button');
        removeButton.className = '_x_extension_shortcut_remove_2024_unique_';
        removeButton.textContent = '移除';
        removeButton.dataset.key = item.key || '';
        actions.appendChild(removeButton);
      }
      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    };
    if (customSiteSearchProviders.length === 0) {
      const empty = document.createElement('div');
      empty.className = '_x_extension_settings_placeholder_2024_unique_';
      empty.textContent = '暂未添加自定义站内搜索';
      siteSearchCustomList.appendChild(empty);
    } else {
      customSiteSearchProviders.forEach((item) => {
        renderItem({ ...item, _xIsCustom: true }, siteSearchCustomList);
      });
    }
    if (displayDefaults.length === 0) {
      const empty = document.createElement('div');
      empty.className = '_x_extension_settings_placeholder_2024_unique_';
      empty.textContent = '暂无内置站内搜索';
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
      .then((response) => response.json())
      .then((data) => (data && Array.isArray(data.items) ? data.items : []))
      .catch(() => []);
  }

  function loadCustomSiteSearchProviders() {
    return new Promise((resolve) => {
      chrome.storage.local.get([SITE_SEARCH_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
        resolve(items);
      });
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
    Promise.all([loadDefaultSiteSearchProviders(), loadCustomSiteSearchProviders()]).then(([defaults, custom]) => {
      defaultSiteSearchProviders = defaults;
      customSiteSearchProviders = custom;
      renderSiteSearchList();
    });
  }

  if (siteSearchCustomList && siteSearchBuiltinList) {
    refreshSiteSearchProviders();
  }

  if (siteSearchCustomList) {
    siteSearchCustomList.addEventListener('click', function(event) {
      const target = event.target;
      if (!target || !target.dataset) {
        return;
      }
      if (target.dataset.editKey) {
        const key = String(target.dataset.editKey);
        const match = customSiteSearchProviders.find((item) => String(item.key || '') === key);
        if (match) {
          if (siteSearchKeyInput) siteSearchKeyInput.value = match.key || '';
          if (siteSearchNameInput) siteSearchNameInput.value = match.name || '';
          if (siteSearchTemplateInput) siteSearchTemplateInput.value = match.template || '';
          if (siteSearchAliasInput) siteSearchAliasInput.value = Array.isArray(match.aliases) ? match.aliases.join(',') : '';
          setEditingState(key);
        }
        return;
      }
      if (target.dataset.key) {
        const key = String(target.dataset.key);
        customSiteSearchProviders = customSiteSearchProviders.filter((item) => String(item.key || '') !== key);
        saveCustomSiteSearchProviders(customSiteSearchProviders).then(() => {
          refreshSiteSearchProviders();
          if (editingSiteSearchKey === key) {
            resetSiteSearchForm();
          }
        });
      }
    });
  }

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
      saveCustomSiteSearchProviders(next).then(() => {
        customSiteSearchProviders = next;
        renderSiteSearchList();
        resetSiteSearchForm();
      });
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[SITE_SEARCH_STORAGE_KEY]) {
      return;
    }
    refreshSiteSearchProviders();
  });
})();
