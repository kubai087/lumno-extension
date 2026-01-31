(function() {
  if (window._x_extension_createSearchInput_2024_unique_) {
    return;
  }

  function applyStyleOverrides(element, overrides) {
    if (!overrides) {
      return;
    }
    Object.keys(overrides).forEach((property) => {
      element.style.setProperty(property, overrides[property], 'important');
    });
  }


  window._x_extension_createSearchInput_2024_unique_ = function(options) {
    const config = options || {};
    const input = document.createElement('input');
    input.id = config.inputId || '_x_extension_search_input_2024_unique_';
    input.autocomplete = 'off';
    input.type = 'text';
    input.placeholder = config.placeholder || '搜索或输入网址...';
    input.style.cssText = `
      all: unset !important;
      width: 100% !important;
      padding: 20px 64px 20px 50px !important;
      background: transparent !important;
      border: none !important;
      border-bottom: none !important;
      color: var(--x-ext-input-text, #1F2937) !important;
      font-size: 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      font-weight: 500 !important;
      outline: none !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      display: block !important;
      text-align: left !important;
      cursor: text !important;
      vertical-align: baseline !important;
      caret-color: var(--x-ext-input-caret, #7DB7FF) !important;
    `;
    applyStyleOverrides(input, config.inputStyleOverrides);

    const hasBorderOverride = Boolean(
      config.inputStyleOverrides &&
      Object.prototype.hasOwnProperty.call(config.inputStyleOverrides, 'border-bottom')
    );
    const showUnderlineWhenEmpty = Boolean(config.showUnderlineWhenEmpty);

    const divider = document.createElement('div');
    divider.id = config.dividerId || '_x_extension_input_divider_2024_unique_';
    divider.style.cssText = `
      all: unset !important;
      position: absolute !important;
      left: var(--x-ext-input-divider-inset, 20px) !important;
      right: var(--x-ext-input-divider-inset, 20px) !important;
      bottom: 0 !important;
      height: 1px !important;
      background: var(--x-ext-input-underline, #E5E7EB) !important;
      opacity: var(--x-ext-input-divider-opacity, 0.55) !important;
      pointer-events: none !important;
      display: block !important;
    `;
    applyStyleOverrides(divider, config.dividerStyleOverrides);

    function updateInputUnderline(value) {
      if (hasBorderOverride) {
        divider.style.setProperty('display', 'none', 'important');
        return;
      }
      if (showUnderlineWhenEmpty) {
        divider.style.setProperty('display', 'block', 'important');
        return;
      }
      const isEmpty = !value || !value.trim();
      divider.style.setProperty('display', isEmpty ? 'none' : 'block', 'important');
    }

    updateInputUnderline(input.value);

    if (typeof config.onInput === 'function') {
      input.addEventListener('input', config.onInput);
    }
    input.addEventListener('input', function(event) {
      updateInputUnderline(event.target.value);
    });
    if (typeof config.onFocus === 'function') {
      input.addEventListener('focus', config.onFocus);
    }
    if (typeof config.onBlur === 'function') {
      input.addEventListener('blur', config.onBlur);
    }
    if (typeof config.onKeyDown === 'function') {
      input.addEventListener('keydown', config.onKeyDown);
    }

    const icon = document.createElement('div');
    icon.id = config.iconId || '_x_extension_search_icon_2024_unique_';
    const spriteUrl = (chrome && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('remixicon.symbol.svg')
      : 'remixicon.symbol.svg';
    icon.innerHTML = `<svg class="_x_extension_svg_2024_unique_ ri-icon ri-size-16" aria-hidden="true" focusable="false"><use href="${spriteUrl}#ri-search-line"></use></svg>`;
    icon.style.cssText = `
      all: unset !important;
      position: absolute !important;
      left: 20px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      color: var(--x-ext-input-icon, #9CA3AF) !important;
      pointer-events: none !important;
      z-index: 1 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 6px 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;
    applyStyleOverrides(icon, config.iconStyleOverrides);

    const rightIcon = document.createElement('img');
    rightIcon.id = config.rightIconId || '_x_extension_search_right_icon_2024_unique_';
    const runtimeUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('lumno-input-light.png')
      : '';
    rightIcon.src = config.rightIconUrl || runtimeUrl;
    rightIcon.alt = config.rightIconAlt || 'Lumno';
    rightIcon.style.cssText = `
      all: unset !important;
      position: absolute !important;
      right: 14px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      width: 28px !important;
      height: 28px !important;
      border-radius: 8px !important;
      z-index: 2 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      display: block !important;
      object-fit: cover !important;
    `;
    applyStyleOverrides(rightIcon, config.rightIconStyleOverrides);

    const container = document.createElement('div');
    container.id = config.containerId || '_x_extension_input_container_2024_unique_';
    container.style.cssText = `
      all: unset !important;
      position: relative !important;
      width: 100% !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
      display: block !important;
      background: transparent !important;
      border-radius: 28px 28px 0 0 !important;
      overflow: hidden !important;
    `;
    applyStyleOverrides(container, config.containerStyleOverrides);

    container.appendChild(icon);
    container.appendChild(input);
    container.appendChild(divider);
    if (config.showRightIcon !== false) {
      container.appendChild(rightIcon);
    }

    return { container: container, input: input, icon: icon, rightIcon: rightIcon, divider: divider };
  };
})();
