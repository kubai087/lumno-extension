import { getPagePortals } from '../app/portals';
import * as LumnoMessaging from '../../platform/messaging';
import type { MessageRuntime } from '../../platform/messaging';
import { RemixIcon } from '../../shared/react/remix-icon';

export const PAGE_NOTICE_ID =
  '_x_extension_newtab_notice_banner_2026_unique_';

// The notice's text: a lookup, or the strings by message key.
export interface PageNoticeMessages {
  t?: (key: string, fallback: string) => string;
  detailsUrl?: string;
  document?: Document;
  bottomDock?: HTMLElement | null;
  [key: string]: unknown;
}

export interface PageNoticeOptions {
  // The page's query, which asks for the notice with notice=file-access.
  params?: Pick<URLSearchParams, 'get'> | { notice?: unknown } | null;
  chromeApi?: { runtime?: MessageRuntime & { lastError?: unknown } } | null;
  document?: Document;
  windowObj?: Window;
  bottomDock?: HTMLElement | null;
  messages?: PageNoticeMessages;
  detailsUrl?: string;
  onClose?: () => void;
  openExtensionDetailsPage?: (detailsUrl: string) => void;
}

function getMessage(
  messages: PageNoticeMessages,
  key: string,
  fallback: string
) {
  if (typeof messages.t === 'function') {
    return messages.t(key, fallback);
  }
  return Object.prototype.hasOwnProperty.call(messages, key)
    ? String(messages[key] || fallback)
    : fallback;
}

function getNoticeParam(params: PageNoticeOptions['params']) {
  if (!params) {
    return '';
  }
  if ('get' in params && typeof params.get === 'function') {
    return String(params.get('notice') || '').trim();
  }
  return 'notice' in params ? String(params.notice || '').trim() : '';
}

function openDetailsPage(options: PageNoticeOptions, detailsUrl: string) {
  if (typeof options.openExtensionDetailsPage === 'function') {
    options.openExtensionDetailsPage(detailsUrl);
    return;
  }
  const runtime = options.chromeApi && options.chromeApi.runtime;
  const windowObj: Window | undefined = options.windowObj;
  if (
    runtime &&
    typeof runtime.sendMessage === 'function'
  ) {
    LumnoMessaging.sendBackgroundMessage(runtime,
      { action: 'openExtensionDetailsPage' },
      (response) => {
        if (runtime.lastError) {
          if (detailsUrl) {
            windowObj?.open(detailsUrl, '_blank');
          }
          return;
        }
        if (response?.ok !== true) {
          const fallbackUrl = response?.url || detailsUrl;
          if (fallbackUrl) {
            windowObj?.open(fallbackUrl, '_blank');
          }
        }
      }
    );
    return;
  }
  if (detailsUrl) {
    windowObj?.open(detailsUrl, '_blank');
  }
}

function PageNotice({
  detailsUrl,
  messages,
  onClose,
  onDetails
}: {
  detailsUrl: string;
  messages: PageNoticeMessages;
  onClose(): void;
  onDetails(detailsUrl: string): void;
}) {
  return (
    <>
      <div className="x-nt-page-notice-content">
        <div
          aria-hidden="true"
          className="x-nt-page-notice-icon">
          <RemixIcon name="ri-error-warning-line" size={20} />
        </div>
        <div className="x-nt-page-notice-message">
          {getMessage(
            messages,
            'newtab_file_access_notice_title',
            '由于浏览器限制，若要在本地文件页面（如 PDF、HTML）中唤起聚焦搜索，请手动开启“允许访问文件网址”'
          )}
        </div>
      </div>
      <button
        className="x-nt-page-notice-primary"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDetails(detailsUrl);
        }}
        type="button"
      >
        {getMessage(
          messages,
          'newtab_file_access_notice_open_cta',
          '前往开启'
        )}
      </button>
      <button
        aria-label={getMessage(
          messages,
          'newtab_file_access_notice_close',
          '关闭提示'
        )}
        className="x-nt-page-notice-close"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
        type="button">
        <RemixIcon name="ri-close-line" size={16} />
      </button>
    </>
  );
}

export interface PageNoticeController {
  dismiss(): void;
  element: HTMLDivElement;
}

export function renderPageNotice(
  options: PageNoticeOptions = {}
): PageNoticeController | null {
  const messages: PageNoticeMessages = options.messages || {};
  const documentObj: Document =
    options.document || messages.document || document;
  if (
    !documentObj.body ||
    getNoticeParam(options.params) !== 'file-access'
  ) {
    return null;
  }
  documentObj.getElementById(PAGE_NOTICE_ID)?.remove();
  const element = documentObj.createElement('div');
  element.id = PAGE_NOTICE_ID;
  element.dataset.reactIsland = 'newtab-page-notice';
  let dismissed = false;
  const controller: PageNoticeController = {
    dismiss() {
      if (dismissed) {
        return;
      }
      dismissed = true;
      getPagePortals().remove(element);
      element.remove();
      options.onClose?.();
    },
    element
  };
  getPagePortals().show(element, (
    <PageNotice
      detailsUrl={String(options.detailsUrl || messages.detailsUrl || '')}
      messages={messages}
      onClose={() => controller.dismiss()}
      onDetails={(detailsUrl) =>
        openDetailsPage(
          {
            ...options,
            windowObj: options.windowObj || window
          },
          detailsUrl
        )
      }
    />
  ));
  const bottomDock: HTMLElement | null =
    options.bottomDock || messages.bottomDock || null;
  const referenceNode =
    bottomDock?.parentNode === documentObj.body ? bottomDock : null;
  documentObj.body.insertBefore(element, referenceNode);
  return controller;
}
