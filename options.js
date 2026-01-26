(function() {
  const panel = document.getElementById('_x_extension_settings_panel_2024_unique_');
  const themeButtons = Array.from(document.querySelectorAll('._x_extension_theme_option_2024_unique_'));
  const tabButtons = Array.from(document.querySelectorAll('._x_extension_settings_tab_button_2024_unique_'));
  const tabContents = Array.from(document.querySelectorAll('._x_extension_settings_content_2024_unique_'));
  if (!panel || themeButtons.length === 0 || tabButtons.length === 0) {
    return;
  }

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;

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
})();
