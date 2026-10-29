import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { queryHtmlTag, queryHtmlTags } from '../../shared/dom-lookup';
import { RemixIcon } from '../../shared/react/remix-icon';

export interface RecentHistoryVersion {
  title: string;
  url: string;
  updatedAt?: number;
}

export interface RecentHistoryItem extends RecentHistoryVersion {
  cardId: string;
  updateHistory: RecentHistoryVersion[];
}

export interface RecentHistoryDialogOptions {
  documentObj?: Document;
  windowObj?: Window;
  t?: (key: string, fallback: string) => string;
  onRestore?: (
    item: RecentHistoryItem,
    version: RecentHistoryVersion,
    historyIndex: number
  ) => boolean | Promise<boolean>;
  onRestoreSuccess?: () => void;
  closeDelayMs?: number;
  restoredToastDelayMs?: number;
}

export interface RecentHistoryDialogController {
  element: HTMLDivElement;
  open(options: { item: RecentHistoryItem; sourceElement?: HTMLElement | null }): boolean;
  close(options?: { restoreFocus?: boolean }): boolean;
  update(item: RecentHistoryItem): void;
  mount(parentNode: Node, beforeNode?: Node | null): HTMLDivElement;
  destroy(): void;
}

interface ViewModel {
  item: RecentHistoryItem | null;
  busyIndex: number;
  t: (key: string, fallback: string) => string;
  onClose(): void;
  onRestore(index: number): void;
}

const DEFAULT_CLOSE_DELAY_MS = 220;
const DEFAULT_TOAST_DELAY_MS = 130;

function formatVersionTime(value: number | undefined, current: boolean, t: ViewModel['t']): string {
  if (current) return t('recent_history_current', 'Current version');
  const timestamp = Math.max(0, Number(value) || 0);
  if (!timestamp) return t('recent_history_earlier', 'Earlier version');
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(timestamp));
}

function VersionContent({ version }: { version: RecentHistoryVersion }) {
  return (
    <span className="x-nt-recent-history-version-copy">
      <strong>{version.title || version.url}</strong>
      <span title={version.url}>{version.url}</span>
    </span>
  );
}

function RecentHistoryDialogView(model: ViewModel) {
  const { item, busyIndex, t } = model;
  if (!item) return null;
  return (
    <section className="x-nt-recent-history-dialog" role="dialog" aria-modal="true" aria-labelledby="x-nt-recent-history-title">
      <header className="x-nt-recent-history-header">
        <span>
          <h2 id="x-nt-recent-history-title">{t('recent_history_title', 'Change History')}</h2>
          <p>{t('recent_history_description', 'Set any retained version as current without removing history.')}</p>
        </span>
        <button className="x-nt-recent-history-close" type="button" aria-label={t('recent_update_close', 'Close')} onClick={model.onClose}>
          <RemixIcon name="ri-close-line" />
        </button>
      </header>
      <div className="x-nt-recent-history-list">
        <article className="x-nt-recent-history-current">
          <span className="x-nt-recent-history-rail" aria-hidden="true"><RemixIcon name="ri-pushpin-2-fill" /></span>
          <VersionContent version={item} />
          <time>{formatVersionTime(undefined, true, t)}</time>
        </article>
        {item.updateHistory.map((version, index) => (
          <article className="x-nt-recent-history-version" key={`${version.url}-${version.updatedAt || 0}-${index}`}>
            <span className="x-nt-recent-history-rail" aria-hidden="true"><i /></span>
            <VersionContent version={version} />
            <span className="x-nt-recent-history-version-actions">
              <time>{formatVersionTime(version.updatedAt, false, t)}</time>
              <span className="x-nt-recent-history-action-slot">
                <button
                  className="x-lumno-action-button x-lumno-action-button--secondary x-nt-recent-history-restore"
                  type="button"
                  data-history-index={index}
                  disabled={busyIndex >= 0}
                  onClick={() => model.onRestore(index)}
                >
                  <RemixIcon name="ri-pushpin-2-line" />
                  {busyIndex === index
                    ? t('recent_history_restoring', 'Restoring…')
                    : t('recent_history_restore', 'Set as current')}
                </button>
              </span>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function createRecentHistoryDialog(
  rawOptions: RecentHistoryDialogOptions = {}
): RecentHistoryDialogController | null {
  const documentObj = rawOptions.documentObj || globalThis.document;
  const windowObj = rawOptions.windowObj || globalThis.window;
  if (!documentObj || !windowObj) return null;
  const t = rawOptions.t || ((_key: string, fallback: string) => fallback);
  const onRestore = rawOptions.onRestore || (() => false);
  const onRestoreSuccess = rawOptions.onRestoreSuccess || (() => {});
  const rawCloseDelayMs = Number(rawOptions.closeDelayMs);
  const closeDelayMs = Number.isFinite(rawCloseDelayMs)
    ? Math.max(0, rawCloseDelayMs)
    : DEFAULT_CLOSE_DELAY_MS;
  const rawToastDelayMs = Number(rawOptions.restoredToastDelayMs);
  const restoredToastDelayMs = Math.min(
    closeDelayMs,
    Number.isFinite(rawToastDelayMs) ? Math.max(0, rawToastDelayMs) : DEFAULT_TOAST_DELAY_MS
  );
  const host = documentObj.createElement('div');
  host.className = 'x-nt-recent-history-backdrop';
  host.hidden = true;
  host.dataset.open = 'false';
  host.dataset.reactIsland = 'recent-history-dialog';
  const reactRoot: Root = createRoot(host);
  let item: RecentHistoryItem | null = null;
  let busyIndex = -1;
  let previousFocus: HTMLElement | null = null;
  let destroyed = false;
  let closeTimer = 0;
  let toastTimer = 0;

  function render(): void {
    if (destroyed) return;
    const model: ViewModel = { item, busyIndex, t, onClose: () => close({ restoreFocus: true }), onRestore: restore };
    flushSync(() => {
      reactRoot.render(<RecentHistoryDialogView {...model} />);
    });
  }

  function clearTransitionTimers(): void {
    if (closeTimer) windowObj.clearTimeout(closeTimer);
    if (toastTimer) windowObj.clearTimeout(toastTimer);
    closeTimer = 0;
    toastTimer = 0;
  }

  function finishClose(restoreFocus: boolean): void {
    closeTimer = 0;
    host.hidden = true;
    host.dataset.state = 'closed';
    if (restoreFocus) previousFocus?.focus();
    previousFocus = null;
  }

  function close(options: { restoreFocus?: boolean } = {}): boolean {
    if (destroyed || busyIndex >= 0 || host.dataset.state === 'restored') return false;
    clearTransitionTimers();
    const restoreFocus = options.restoreFocus === true;
    host.dataset.state = 'closing';
    host.dataset.open = 'false';
    if (host.hidden || closeDelayMs === 0) finishClose(restoreFocus);
    else closeTimer = windowObj.setTimeout(() => finishClose(restoreFocus), closeDelayMs);
    return true;
  }

  async function restore(index: number): Promise<void> {
    if (!item || busyIndex >= 0) return;
    const selectedItem = item;
    busyIndex = index;
    render();
    const version = selectedItem.updateHistory[index];
    if (!version) {
      busyIndex = -1;
      render();
      return;
    }
    const succeeded = await Promise.resolve()
      .then(() => onRestore(selectedItem, version, index))
      .catch(() => false);
    busyIndex = -1;
    if (!succeeded) {
      render();
      return;
    }
    clearTransitionTimers();
    host.dataset.state = 'restored';
    host.dataset.open = 'false';
    toastTimer = windowObj.setTimeout(() => {
      toastTimer = 0;
      try { onRestoreSuccess(); } catch (_error) {}
    }, restoredToastDelayMs);
    closeTimer = windowObj.setTimeout(() => finishClose(true), closeDelayMs);
  }

  function open(options: { item: RecentHistoryItem; sourceElement?: HTMLElement | null }): boolean {
    if (destroyed || busyIndex >= 0 || !options.item) return false;
    item = options.item;
    clearTransitionTimers();
    previousFocus = options.sourceElement || (
      documentObj.activeElement instanceof HTMLElement ? documentObj.activeElement : null
    );
    render();
    host.hidden = false;
    host.dataset.state = 'opening';
    host.dataset.open = 'false';
    windowObj.requestAnimationFrame(() => {
      if (!host.hidden && host.dataset.state === 'opening') {
        host.dataset.state = 'open';
        host.dataset.open = 'true';
      }
    });
    windowObj.requestAnimationFrame(() => {
      if (!host.hidden && (host.dataset.state === 'opening' || host.dataset.state === 'open')) {
        queryHtmlTag(host, '.x-nt-recent-history-close', 'button')?.focus();
      }
    });
    return true;
  }

  function update(nextItem: RecentHistoryItem): void {
    item = nextItem;
    if (!host.hidden) render();
  }

  function mount(parentNode: Node, beforeNode?: Node | null): HTMLDivElement {
    if (beforeNode) parentNode.insertBefore(host, beforeNode);
    else parentNode.appendChild(host);
    return host;
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.target === host) close({ restoreFocus: true });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    if (event.key === 'Tab') {
      const focusable = queryHtmlTags(host, 'button:not(:disabled)', 'button');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && documentObj.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentObj.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function destroy(): void {
    if (destroyed) return;
    clearTransitionTimers();
    destroyed = true;
    host.removeEventListener('pointerdown', handlePointerDown);
    host.removeEventListener('keydown', handleKeydown);
    flushSync(() => {
      reactRoot.unmount();
    });
    host.remove();
  }

  host.addEventListener('pointerdown', handlePointerDown);
  host.addEventListener('keydown', handleKeydown);
  render();
  return Object.freeze({ element: host, open, close, update, mount, destroy });
}
