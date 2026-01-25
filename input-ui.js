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
      padding: 20px 22px 20px 50px !important;
      background: transparent !important;
      border: none !important;
      border-bottom: 1px solid #E5E7EB !important;
      color: #1F2937 !important;
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
      vertical-align: baseline !important;
      caret-color: #7DB7FF !important;
    `;
    applyStyleOverrides(input, config.inputStyleOverrides);

    const hasBorderOverride = Boolean(
      config.inputStyleOverrides &&
      Object.prototype.hasOwnProperty.call(config.inputStyleOverrides, 'border-bottom')
    );
    const showUnderlineWhenEmpty = Boolean(config.showUnderlineWhenEmpty);

    function updateInputUnderline(value) {
      if (hasBorderOverride) {
        return;
      }
      if (showUnderlineWhenEmpty) {
        input.style.setProperty('border-bottom', '1px solid #E5E7EB', 'important');
        return;
      }
      const isEmpty = !value || !value.trim();
      input.style.setProperty(
        'border-bottom',
        isEmpty ? 'none' : '1px solid #E5E7EB',
        'important'
      );
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
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="_x_extension_svg_2024_unique_"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
    icon.style.cssText = `
      all: unset !important;
      position: absolute !important;
      left: 20px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      color: #9CA3AF !important;
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
      background: rgba(255, 255, 255, 0.9) !important;
      border-radius: 24px 24px 0 0 !important;
    `;
    applyStyleOverrides(container, config.containerStyleOverrides);

    container.appendChild(icon);
    container.appendChild(input);

    return { container: container, input: input, icon: icon };
  };
})();
