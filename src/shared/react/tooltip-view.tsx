import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useState, type ReactNode } from 'react';
import type {
  BrowserAvatar,
  BrowserAvatarTooltipModel,
  CursorTagModel,
  TooltipElementOptions
} from '../../types/view-apis';

const TOOLTIP_CLASS = '_x_extension_tooltip_2026_unique_';
const LINE_CLASS = '_x_extension_tooltip_line_2026_unique_';
const DIVIDER_CLASS =
  '_x_extension_tooltip_divider_2026_unique_';
const TAG_KEY_CLASS =
  '_x_extension_cursor_tooltip_tag_key_2026_unique_';
const TAG_LABEL_CLASS =
  '_x_extension_cursor_tooltip_tag_label_2026_unique_';
const WINDOWS_LOGO_CLASS =
  '_x_extension_cursor_tooltip_windows_logo_2026_unique_';
const WINDOWS_LOGO_PANE_CLASS =
  '_x_extension_cursor_tooltip_windows_logo_pane_2026_unique_';
const DIVIDER_MARKER = '────────';
const TOOLTIP_RENDER_HOOK =
  '_x_lumnoTooltipRenderReact_2026_unique_';
const TOOLTIP_DESTROY_HOOK =
  '_x_lumnoTooltipDestroyReact_2026_unique_';

interface TooltipRootState {
  destroyed: boolean;
  root: Root;
}

type TooltipRenderHook = (content: ReactNode) => void;

function isRenderHook(value: unknown): value is TooltipRenderHook {
  return typeof value === 'function';
}

function isDestroyHook(value: unknown): value is () => void {
  return typeof value === 'function';
}

// The copy of this view that owns an element (another bundle may have its
// own) leaves these hooks on it for the others to call.
function readRenderHook(element: HTMLElement): TooltipRenderHook | null {
  const hook: unknown = Reflect.get(element, TOOLTIP_RENDER_HOOK);
  return isRenderHook(hook) ? hook : null;
}

function readDestroyHook(element: HTMLElement): (() => void) | null {
  const hook: unknown = Reflect.get(element, TOOLTIP_DESTROY_HOOK);
  return isDestroyHook(hook) ? hook : null;
}

const roots = new WeakMap<HTMLElement, TooltipRootState>();
const browserClassById: Record<string, string> = {
  chrome: 'browser-avatar--chrome',
  edge: 'browser-avatar--edge',
  dia: 'browser-avatar--dia',
  comet: 'browser-avatar--comet'
};

function TooltipLines({ text }: { text: string }) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trimEnd());
  return (
    <>
      {lines.map((line, index) =>
        line === DIVIDER_MARKER ? (
          <span
            className={DIVIDER_CLASS}
            key={`divider:${index}`}
          />
        ) : (
          <span className={LINE_CLASS} key={`line:${index}`}>
            {line}
          </span>
        )
      )}
    </>
  );
}

function WindowsLogo() {
  return (
    <span aria-hidden="true" className={WINDOWS_LOGO_CLASS}>
      {[1, 2, 3, 4].map((index) => (
        <span
          className={WINDOWS_LOGO_PANE_CLASS}
          data-cursor-tooltip-windows-logo-pane={String(index)}
          key={index}
        />
      ))}
    </span>
  );
}

function CursorTag({ model }: { model: CursorTagModel }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={TAG_KEY_CLASS}
        data-cursor-tooltip-tag-key={model.keyText}
      >
        {model.windowsLogo ? <WindowsLogo /> : model.keyText}
      </span>
      <span className={TAG_LABEL_CLASS}>{model.label}</span>
    </>
  );
}

function BrowserAvatarItem({ browser }: { browser: BrowserAvatar }) {
  const id = String(browser.id || '').trim().toLowerCase();
  const name = String(browser.name || '').trim();
  const src = String(browser.src || '').trim();
  const [failed, setFailed] = useState(false);
  const fallback = (name || id || '?').slice(0, 1).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`browser-avatar ${
        browserClassById[id] || 'browser-avatar--fallback'
      }`}
      title={name || undefined}
    >
      {src && !failed ? (
        <img
          alt=""
          aria-hidden="true"
          className="browser-avatar-image"
          decoding="async"
          onError={() => setFailed(true)}
          src={src}
        />
      ) : fallback}
    </span>
  );
}

function BrowserAvatarTooltip({
  model
}: {
  model: BrowserAvatarTooltipModel;
}) {
  const browsers = Array.isArray(model.browsers) ? model.browsers : [];
  const names = browsers
    .map((browser) => String(browser.name || '').trim())
    .filter(Boolean);
  const separator = String(model.browserNameSeparator || ', ');
  const suffix = String(model.browserAvatarSuffix || 'and more');
  return (
    <span
      aria-label={
        names.length > 0
          ? `${names.join(separator)} ${suffix}`.trim()
          : undefined
      }
      className="browser-avatar-group"
      role="img"
    >
      {browsers.map((browser, index) => (
        <BrowserAvatarItem
          browser={browser}
          key={`${String(browser.id || '')}:${index}`}
        />
      ))}
      <span aria-hidden="true" className="browser-avatar-ellipsis">…</span>
    </span>
  );
}

function renderInto(
  element: HTMLElement,
  content: ReactNode
): boolean {
  const state = roots.get(element);
  if (state && !state.destroyed) {
    flushSync(() => state.root.render(content));
    return true;
  }
  const ownerRender = readRenderHook(element);
  if (!ownerRender) {
    return false;
  }
  ownerRender(content);
  return true;
}

export function renderTooltipContent(
  element: HTMLElement,
  content: ReactNode
): HTMLElement {
  renderInto(element, content);
  return element;
}

export function createTooltipElement(
  options: TooltipElementOptions = {}
): HTMLDivElement | null {
  const documentObj = options.documentObj || document;
  if (!documentObj) {
    return null;
  }
  const element = documentObj.createElement('div');
  if (options.id) {
    element.id = options.id;
  }
  element.className = [TOOLTIP_CLASS, options.className || '']
    .filter(Boolean)
    .join(' ');
  element.dataset.reactIsland = 'tooltip';
  element.setAttribute('data-visible', 'false');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute(
    'data-tooltip-position',
    options.positionMode === 'absolute' ? 'absolute' : 'fixed'
  );
  if (options.kind) {
    element.setAttribute('data-tooltip-kind', options.kind);
  }
  const root = createRoot(element);
  roots.set(element, { destroyed: false, root });
  Object.defineProperty(element, TOOLTIP_RENDER_HOOK, {
    configurable: true,
    value(content: ReactNode) {
      const state = roots.get(element);
      if (!state || state.destroyed) {
        return;
      }
      flushSync(() => state.root.render(content));
    }
  });
  Object.defineProperty(element, TOOLTIP_DESTROY_HOOK, {
    configurable: true,
    value() {
      const state = roots.get(element);
      if (!state || state.destroyed) {
        return;
      }
      state.destroyed = true;
      flushSync(() => state.root.unmount());
      roots.delete(element);
      Reflect.deleteProperty(element, TOOLTIP_RENDER_HOOK);
      Reflect.deleteProperty(element, TOOLTIP_DESTROY_HOOK);
    }
  });
  renderInto(element, null);
  return element;
}

export function renderTooltipText(
  element: HTMLElement,
  text: string
): HTMLElement {
  return renderTooltipContent(element, <TooltipLines text={text} />);
}

export function renderCursorTag(
  element: HTMLElement,
  model: CursorTagModel
): HTMLElement {
  return renderTooltipContent(element, <CursorTag model={model} />);
}

export function renderBrowserAvatarTooltip(
  element: HTMLElement,
  model: BrowserAvatarTooltipModel
): HTMLElement {
  return renderTooltipContent(
    element,
    <BrowserAvatarTooltip model={model} />
  );
}

export function destroyTooltipElement(
  element: HTMLElement | null
): void {
  if (!element) {
    return;
  }
  const state = roots.get(element);
  if (state && !state.destroyed) {
    const ownerDestroy = readDestroyHook(element);
    if (ownerDestroy) {
      ownerDestroy();
    }
    return;
  }
  const ownerDestroy = readDestroyHook(element);
  if (ownerDestroy) {
    ownerDestroy();
  }
}
