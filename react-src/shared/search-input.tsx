import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

type StyleOverrides = Record<string, string>;

export interface SearchInputConfig {
  clearAction?: {
    ariaLabel?: string;
    html?: string;
    id: string;
    styleOverrides?: StyleOverrides;
  };
  containerId?: string;
  containerStyleOverrides?: StyleOverrides;
  dividerId?: string;
  dividerStyleOverrides?: StyleOverrides;
  iconId?: string;
  iconStyleOverrides?: StyleOverrides;
  inputId?: string;
  inputStyleOverrides?: StyleOverrides;
  modeBadge?: {
    className?: string;
    id?: string;
    surface?: string;
    visible?: boolean;
  };
  onBlur?(event: Event): void;
  onFocus?(event: Event): void;
  onInput?(event: Event): void;
  onKeyDown?(event: Event): void;
  placeholder?: string;
  rightIconAlt?: string;
  rightIconHtml?: string;
  rightIconId?: string;
  rightIconStyleOverrides?: StyleOverrides;
  secondaryAction?: {
    ariaLabel?: string;
    className?: string;
    html?: string;
    id: string;
  };
  showRightIcon?: boolean;
  showUnderlineWhenEmpty?: boolean;
  styleMode?: string;
  styleRoot?: Document | ShadowRoot | null;
  useImportantStyles?: boolean;
  useInlineBaseStyles?: boolean;
  useIsolatedStyles?: boolean;
}

export interface SearchInputParts {
  clearAction: HTMLButtonElement | null;
  container: HTMLDivElement;
  divider: HTMLDivElement;
  icon: HTMLDivElement;
  input: HTMLInputElement;
  modeBadge: HTMLDivElement | null;
  modeMenu: HTMLDivElement;
  modePrefix: HTMLButtonElement;
  modePrefixChevron: HTMLElement;
  modePrefixCurrent: HTMLSpanElement;
  modePrefixGlyph: HTMLElement;
  modePrefixIconFrame: HTMLSpanElement;
  modePrefixIcon: HTMLImageElement;
  modePrefixText: HTMLSpanElement;
  modeTabHint: HTMLSpanElement;
  modeTabHintKey: HTMLSpanElement;
  modeTabHintText: HTMLSpanElement;
  rightIcon: HTMLButtonElement;
  secondaryAction: HTMLButtonElement | null;
  syncClearAction(): boolean;
}

const CLASSES = Object.freeze({
  clearAction:
    'x-lumno-search-input__clear _x_extension_input_clear_class_2026_ notranslate',
  container:
    'x-lumno-search-input x-lumno-search-input__container _x_extension_input_container_class_2026_ notranslate',
  divider:
    'x-lumno-search-input__divider _x_extension_input_divider_class_2026_ notranslate',
  icon:
    'x-lumno-search-input__icon _x_extension_input_icon_class_2026_ notranslate',
  input:
    'x-lumno-search-input__field _x_extension_input_class_2026_ notranslate',
  rightIcon:
    'x-lumno-search-input__right-icon _x_extension_input_right_icon_class_2026_ notranslate'
});
const roots = new WeakMap<HTMLElement, Root>();

const BASE_STYLES: Record<
  Exclude<keyof typeof CLASSES, 'clearAction'>,
  StyleOverrides
> = {
  container: {
    all: 'unset',
    background: 'transparent',
    'border-radius': 'var(--x-ext-search-input-corners,28px 28px 0 0)',
    'box-sizing': 'border-box',
    color: 'inherit',
    display: 'block',
    'flex-shrink': '0',
    font: 'inherit',
    'font-size': '100%',
    'line-height': '1',
    'list-style': 'none',
    margin: '0',
    outline: 'none',
    overflow: 'hidden',
    padding: '0',
    position: 'relative',
    'text-decoration': 'none',
    'vertical-align': 'baseline',
    width: '100%'
  },
  divider: {
    all: 'unset',
    background: 'var(--x-ext-input-underline, #E5E7EB)',
    bottom: '0',
    display: 'block',
    height: '1px',
    left: 'var(--x-ext-input-divider-inset, 20px)',
    opacity: 'var(--x-ext-input-divider-opacity, 0.55)',
    'pointer-events': 'none',
    position: 'absolute',
    right: 'var(--x-ext-input-divider-inset, 20px)'
  },
  icon: {
    all: 'unset',
    'align-items': 'center',
    background: 'transparent',
    'box-sizing': 'border-box',
    color: 'var(--x-ext-input-icon, #9CA3AF)',
    display: 'flex',
    font: 'inherit',
    'font-size': '100%',
    'justify-content': 'center',
    left: '20px',
    'line-height': '1',
    'list-style': 'none',
    margin: '0',
    outline: 'none',
    padding: '6px 0',
    'pointer-events': 'none',
    position: 'absolute',
    'text-decoration': 'none',
    top: '50%',
    transform: 'translateY(-50%)',
    'vertical-align': 'baseline',
    'z-index': '1'
  },
  input: {
    all: 'unset',
    background: 'transparent',
    border: 'none',
    'border-bottom': 'none',
    'box-sizing': 'border-box',
    'caret-color': 'var(--x-ext-input-caret, #7DB7FF)',
    color: 'var(--x-ext-input-text, #1F2937)',
    cursor: 'text',
    display: 'block',
    'font-family':
      "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    'font-size': '16px',
    'font-weight': '500',
    'line-height': '1',
    'list-style': 'none',
    margin: '0',
    outline: 'none',
    padding: '20px 64px 20px 50px',
    'text-align': 'left',
    'text-decoration': 'none',
    'vertical-align': 'baseline',
    width: '100%'
  },
  rightIcon: {
    all: 'unset',
    'align-items': 'center',
    background: 'transparent',
    'border-radius': 'var(--x-ext-input-right-icon-radius, 10px)',
    'box-sizing': 'border-box',
    color: 'var(--x-ext-input-icon, #9CA3AF)',
    cursor: 'pointer',
    display: 'inline-flex',
    height: '30px',
    'justify-content': 'center',
    'line-height': '1',
    'list-style': 'none',
    margin: '0',
    outline: 'none',
    padding: '0',
    position: 'absolute',
    right: 'var(--x-ext-input-right-icon-inset, 13px)',
    'text-decoration': 'none',
    top: 'var(--x-ext-input-right-icon-inset, 13px)',
    transform: 'none',
    transition: 'background-color 140ms ease, color 140ms ease',
    width: '30px',
    'z-index': '2'
  }
};

function noTranslateProps() {
  return {
    'data-no-translate': 'true',
    lang: 'zxx',
    notranslate: '',
    translate: 'no' as const
  };
}

function SearchInput({ config }: { config: SearchInputConfig }) {
  const modeSurface =
    config.modeBadge?.surface === 'overlay' ? 'overlay' : 'newtab';
  const modePrefixId =
    modeSurface === 'overlay'
      ? '_x_extension_site_search_prefix_2024_unique_'
      : '_x_extension_newtab_site_search_prefix_2024_unique_';
  const modeTabHintId =
    modeSurface === 'overlay'
      ? '_x_extension_site_search_tab_hint_2026_unique_'
      : '_x_extension_newtab_site_search_tab_hint_2026_unique_';
  return (
    <>
      <div
        {...noTranslateProps()}
        className={CLASSES.icon}
        id={config.iconId || '_x_extension_search_icon_2024_unique_'}
      >
        <i
          aria-hidden="true"
          className="_x_extension_svg_2024_unique_ ri-icon ri-size-16 ri-search-line"
        />
      </div>
      <input
        {...noTranslateProps()}
        autoComplete="off"
        className={CLASSES.input}
        id={config.inputId || '_x_extension_search_input_2024_unique_'}
        placeholder={config.placeholder || 'Search or enter URL…'}
        type="text"
      />
      <button
        {...noTranslateProps()}
        className="x-lumno-search-input-mode__prefix"
        data-search-input-mode-prefix=""
        id={modePrefixId}
        type="button"
      >
        <span
          className="x-lumno-search-input-mode__prefix-icon-frame"
          data-search-input-mode-prefix-icon-frame=""
          style={{ display: 'none' }}
        >
          <img
            alt=""
            data-search-input-mode-prefix-icon=""
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </span>
        <i
          aria-hidden="true"
          className="ri-icon ri-size-16 ri-search-line"
          data-search-input-mode-prefix-glyph=""
        />
        <span
          {...noTranslateProps()}
          data-search-input-mode-prefix-text=""
        />
        <span
          {...noTranslateProps()}
          aria-hidden="true"
          data-search-input-mode-current=""
        />
        <i
          aria-hidden="true"
          className="ri-icon ri-size-16 ri-arrow-down-s-line"
          data-search-input-mode-prefix-chevron=""
        />
      </button>
      <div
        {...noTranslateProps()}
        data-search-input-mode-menu=""
        hidden
      />
      <span
        {...noTranslateProps()}
        aria-hidden="true"
        className="x-lumno-search-input-mode__tab-hint"
        data-search-input-mode-tab-hint=""
        id={modeTabHintId}
      >
        <span
          {...noTranslateProps()}
          data-search-input-mode-tab-key=""
        />
        <span
          {...noTranslateProps()}
          data-search-input-mode-tab-text=""
        />
      </span>
      <div
        {...noTranslateProps()}
        className={CLASSES.divider}
        id={config.dividerId || '_x_extension_input_divider_2024_unique_'}
      />
      {config.showRightIcon === false ? null : (
        <button
          {...noTranslateProps()}
          aria-label={config.rightIconAlt || 'Settings'}
          className={CLASSES.rightIcon}
          dangerouslySetInnerHTML={{
            __html:
              config.rightIconHtml ||
              '<i class="_x_extension_svg_2024_unique_ ri-icon ri-size-16 ri-settings-line" aria-hidden="true"></i>'
          }}
          id={
            config.rightIconId ||
            '_x_extension_search_right_icon_2024_unique_'
          }
          type="button"
        />
      )}
      {config.clearAction ? (
        <button
          {...noTranslateProps()}
          aria-label={config.clearAction.ariaLabel || 'Clear'}
          className={CLASSES.clearAction}
          dangerouslySetInnerHTML={{
            __html:
              config.clearAction.html ||
              '<i class="ri-icon ri-size-16 ri-close-line" aria-hidden="true"></i>'
          }}
          hidden
          id={config.clearAction.id}
          type="button"
        />
      ) : null}
      {config.secondaryAction ? (
        <button
          {...noTranslateProps()}
          aria-label={config.secondaryAction.ariaLabel || ''}
          className={config.secondaryAction.className || ''}
          dangerouslySetInnerHTML={{
            __html: config.secondaryAction.html || ''
          }}
          id={config.secondaryAction.id}
          type="button"
        />
      ) : null}
      {config.modeBadge ? (
        <div
          className={
            config.modeBadge.className || 'x-lumno-search-input-mode__badge'
          }
          data-surface={config.modeBadge.surface || 'shared'}
          data-visible={config.modeBadge.visible ? 'true' : 'false'}
          id={config.modeBadge.id}
        />
      ) : null}
    </>
  );
}

function getRuntimeUrl(path: string) {
  const chromeApi = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: { getURL?(path: string): string } };
    }
  ).chrome;
  return chromeApi?.runtime?.getURL?.(path) || '';
}

function ensureLink(
  root: Document | ShadowRoot | HTMLElement,
  id: string,
  resourcePath: string
) {
  if (root.querySelector(`#${id}`)) {
    return;
  }
  const href = getRuntimeUrl(resourcePath);
  if (!href) {
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  root.appendChild(link);
}

function ensureStyles(config: SearchInputConfig) {
  const isolated = Boolean(
    config.useIsolatedStyles || config.styleMode === 'isolated'
  );
  const root =
    (isolated && config.styleRoot) ||
    document.head ||
    document.documentElement;
  if (!root) {
    return;
  }
  ensureLink(
    root,
    isolated
      ? '_x_extension_open_sans_shadow_css_2026_unique_'
      : '_x_extension_open_sans_css_2024_unique_',
    'assets/fonts/open-sans/open-sans.css'
  );
  ensureLink(
    root,
    isolated
      ? '_x_extension_remixicon_shadow_css_2026_unique_'
      : '_x_extension_remixicon_css_2024_unique_',
    'assets/remixicon/fonts/remixicon.css'
  );
  ensureLink(
    root,
    '_x_extension_input_component_style_2026_unique_',
    'src/shared/search-input.css'
  );
}

function applyStyles(
  element: HTMLElement,
  styles: StyleOverrides,
  important: boolean
) {
  Object.entries(styles).forEach(([property, value]) => {
    element.style.setProperty(property, value, important ? 'important' : '');
  });
}

export function createSearchInput(
  config: SearchInputConfig = {}
): SearchInputParts {
  ensureStyles(config);
  const isolated = Boolean(
    config.useIsolatedStyles || config.styleMode === 'isolated'
  );
  const important = Object.prototype.hasOwnProperty.call(
    config,
    'useImportantStyles'
  )
    ? Boolean(config.useImportantStyles)
    : !isolated;
  const useInline = Object.prototype.hasOwnProperty.call(
    config,
    'useInlineBaseStyles'
  )
    ? Boolean(config.useInlineBaseStyles)
    : !isolated || !config.styleRoot;
  const container = document.createElement('div');
  container.id =
    config.containerId || '_x_extension_input_container_2024_unique_';
  container.className = CLASSES.container;
  container.dataset.noTranslate = 'true';
  container.dataset.reactIsland = 'shared-search-input';
  container.lang = 'zxx';
  container.setAttribute('notranslate', '');
  container.setAttribute('translate', 'no');
  const root = createRoot(container);
  roots.set(container, root);
  flushSync(() => root.render(<SearchInput config={config} />));
  const input = container.querySelector<HTMLInputElement>('input');
  const icon = container.querySelector<HTMLDivElement>(
    '.x-lumno-search-input__icon'
  );
  const divider = container.querySelector<HTMLDivElement>(
    '.x-lumno-search-input__divider'
  );
  let rightIcon = container.querySelector<HTMLButtonElement>(
    '.x-lumno-search-input__right-icon'
  );
  if (!rightIcon) {
    rightIcon = document.createElement('button');
  }
  if (!input || !icon || !divider) {
    root.unmount();
    throw new Error('Search input mount');
  }
  const modeBadge = config.modeBadge
    ? container.querySelector<HTMLDivElement>(`#${config.modeBadge.id}`)
    : container.querySelector<HTMLDivElement>(
        '.x-lumno-search-input-mode__badge'
      );
  const secondaryAction = config.secondaryAction
    ? container.querySelector<HTMLButtonElement>(
        `#${config.secondaryAction.id}`
      )
    : null;
  const clearAction = config.clearAction
    ? container.querySelector<HTMLButtonElement>(`#${config.clearAction.id}`)
    : null;
  const modePrefix = container.querySelector<HTMLButtonElement>(
    '[data-search-input-mode-prefix]'
  );
  const modePrefixGlyph = container.querySelector<HTMLElement>(
    '[data-search-input-mode-prefix-glyph]'
  );
  const modePrefixIcon = container.querySelector<HTMLImageElement>(
    '[data-search-input-mode-prefix-icon]'
  );
  const modePrefixIconFrame = container.querySelector<HTMLSpanElement>(
    '[data-search-input-mode-prefix-icon-frame]'
  );
  const modePrefixText = container.querySelector<HTMLSpanElement>(
    '[data-search-input-mode-prefix-text]'
  );
  const modeTabHint = container.querySelector<HTMLSpanElement>(
    '[data-search-input-mode-tab-hint]'
  );
  const modeTabHintKey = container.querySelector<HTMLSpanElement>(
    '[data-search-input-mode-tab-key]'
  );
  const modeTabHintText = container.querySelector<HTMLSpanElement>(
    '[data-search-input-mode-tab-text]'
  );
  const modePrefixChevron = container.querySelector<HTMLElement>(
    '[data-search-input-mode-prefix-chevron]'
  );
  const modePrefixCurrent = container.querySelector<HTMLSpanElement>(
    '[data-search-input-mode-current]'
  );
  const modeMenu = container.querySelector<HTMLDivElement>(
    '[data-search-input-mode-menu]'
  );
  if (
    !modePrefix ||
    !modePrefixGlyph ||
    !modePrefixIconFrame ||
    !modePrefixIcon ||
    !modePrefixText ||
    !modePrefixChevron ||
    !modePrefixCurrent ||
    !modeMenu ||
    !modeTabHint ||
    !modeTabHintKey ||
    !modeTabHintText
  ) {
    root.unmount();
    throw new Error('Search mode mount');
  }
  // Shown only while the field has text; programmatic value changes are picked up by the caller.
  const syncClearAction = () => {
    if (!clearAction) {
      return false;
    }
    const visible = input.value !== '';
    if (clearAction.hidden === visible) {
      clearAction.hidden = !visible;
      if (!visible) {
        clearAction.removeAttribute('data-hover-active');
      }
    }
    return visible;
  };
  const parts = {
    clearAction,
    container,
    divider,
    icon,
    input,
    modeBadge,
    modeMenu,
    modePrefix,
    modePrefixChevron,
    modePrefixCurrent,
    modePrefixGlyph,
    modePrefixIconFrame,
    modePrefixIcon,
    modePrefixText,
    modeTabHint,
    modeTabHintKey,
    modeTabHintText,
    rightIcon,
    secondaryAction,
    syncClearAction
  };
  (
    [
      [container, 'container', config.containerStyleOverrides],
      [input, 'input', config.inputStyleOverrides],
      [divider, 'divider', config.dividerStyleOverrides],
      [icon, 'icon', config.iconStyleOverrides],
      [rightIcon, 'rightIcon', config.rightIconStyleOverrides]
    ] as const
  ).forEach(([element, key, overrides]) => {
    if (useInline) {
      applyStyles(element, BASE_STYLES[key], important);
    }
    if (overrides) {
      applyStyles(element, overrides, important);
    }
  });
  const hasBorderOverride = Boolean(
    config.inputStyleOverrides &&
      Object.prototype.hasOwnProperty.call(
        config.inputStyleOverrides,
        'border-bottom'
      )
  );
  const setDividerVisible = (visible: boolean) => {
    if (isolated && config.styleRoot) {
      divider.dataset.visible = visible ? 'true' : 'false';
    } else {
      divider.style.setProperty(
        'display',
        visible ? 'block' : 'none',
        important ? 'important' : ''
      );
    }
  };
  const updateDivider = () => {
    if (hasBorderOverride) {
      setDividerVisible(false);
    } else if (config.showUnderlineWhenEmpty) {
      setDividerVisible(true);
    } else {
      setDividerVisible(Boolean(input.value.trim()));
    }
  };
  updateDivider();
  if (config.onInput) {
    input.addEventListener('input', config.onInput);
  }
  input.addEventListener('input', updateDivider);
  if (config.onFocus) {
    input.addEventListener('focus', config.onFocus);
  }
  if (config.onBlur) {
    input.addEventListener('blur', config.onBlur);
  }
  if (config.onKeyDown) {
    input.addEventListener('keydown', config.onKeyDown);
  }
  const setRightIconVisualState = (active: boolean) => {
    rightIcon.dataset.hoverActive = active ? 'true' : 'false';
    if (isolated && config.styleRoot) {
      return;
    }
    applyStyles(
      rightIcon,
      {
        background: active
          ? 'var(--x-ext-input-icon-hover-bg, rgba(148, 163, 184, 0.16))'
          : 'transparent',
        color: active
          ? 'var(--x-ext-input-icon-hover, #4B5563)'
          : 'var(--x-ext-input-icon, #9CA3AF)',
        transform: 'none'
      },
      important
    );
  };
  setRightIconVisualState(false);
  rightIcon
    .querySelectorAll<HTMLElement>('*')
    .forEach((node) => {
      if (!isolated || !config.styleRoot) {
        applyStyles(
          node,
          { cursor: 'inherit', 'pointer-events': 'none' },
          important
        );
      }
    });
  rightIcon.addEventListener('mouseenter', () =>
    setRightIconVisualState(true)
  );
  ['mouseleave', 'blur', 'pointerup', 'pointercancel'].forEach((type) => {
    rightIcon.addEventListener(type, () => setRightIconVisualState(false));
  });
  rightIcon.addEventListener('click', () => {
    setRightIconVisualState(false);
    rightIcon.blur();
  });
  if (clearAction) {
    if (config.clearAction?.styleOverrides) {
      applyStyles(clearAction, config.clearAction.styleOverrides, important);
    }
    const resetClearVisualState = () => {
      clearAction.removeAttribute('data-hover-active');
    };
    clearAction.addEventListener('mouseenter', () => {
      clearAction.setAttribute('data-hover-active', 'true');
    });
    ['mouseleave', 'blur', 'pointerup', 'pointercancel'].forEach((type) => {
      clearAction.addEventListener(type, resetClearVisualState);
    });
    // Keep focus (and the caret) in the field while clearing.
    clearAction.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    clearAction.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus({ preventScroll: true });
    });
    input.addEventListener('input', syncClearAction);
    syncClearAction();
  }
  return parts;
}

export function destroySearchInput(
  target: SearchInputParts | HTMLElement | null
) {
  const container =
    target && 'container' in target ? target.container : target;
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const root = roots.get(container);
  if (!root) {
    return;
  }
  flushSync(() => root.unmount());
  roots.delete(container);
}

export function createSearchInputApi() {
  return Object.freeze({
    implementation: 'react',
    createSearchInput,
    destroySearchInput
  });
}
