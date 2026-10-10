import { Fragment, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

export type FeedbackCommunityChannel = 'wechat' | 'x';

export interface FeedbackControlModel {
  buttonLabel: string;
  channel: FeedbackCommunityChannel;
  chromeReviewLabel: string;
  chromeReviewTooltip: string;
  chromeReviewUrl: string;
  closeTooltip: string;
  communityLabel: string;
  communityTooltip: string;
  githubIssueLabel: string;
  githubIssueTooltip: string;
  githubIssueUrl: string;
  menuAriaLabel: string;
  panelTitle: string;
  qrAlt: string;
  qrUrl: string;
  refreshTooltip: string;
  xLabel: string;
  xTooltip: string;
  xUrl: string;
}

export interface FeedbackRefreshResult {
  message?: string;
  qrUrl?: string;
}

export interface FeedbackControlControllerOptions {
  onOpen(): void | Promise<void>;
  onHideTooltip(): void;
  onOpenExternal(
    url: string,
    disposition: 'newTab' | 'backgroundTab'
  ): void;
  onRefreshQr(): FeedbackRefreshResult | Promise<FeedbackRefreshResult>;
  onShowTooltip(target: HTMLElement, label: string): void;
}

export interface FeedbackControlController {
  close(options?: { restoreFocus?: boolean }): void;
  destroy(): void;
  isOpen(): boolean;
  openCommunity(
    disposition?: 'newTab' | 'backgroundTab'
  ): void;
  render(model: FeedbackControlModel): void;
  setOpen(open: boolean): void;
}

function FeedbackControl({
  host,
  model,
  onOpenChange,
  onOpenExternal,
  onHideTooltip,
  onRefreshQr,
  onShowTooltip,
  registerControls
}: {
  host: HTMLElement;
  model: FeedbackControlModel;
  onOpenChange(open: boolean): void;
  onHideTooltip(): void;
  onOpenExternal(
    url: string,
    disposition: 'newTab' | 'backgroundTab'
  ): void;
  onRefreshQr(): FeedbackRefreshResult | Promise<FeedbackRefreshResult>;
  onShowTooltip(target: HTMLElement, label: string): void;
  registerControls(controls: {
    close(options?: { restoreFocus?: boolean }): void;
    isOpen(): boolean;
    openCommunity(
      disposition?: 'newTab' | 'backgroundTab'
    ): void;
    setOpen(open: boolean): void;
  }): void;
}) {
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState(model.qrUrl);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);

  useEffect(() => {
    setQrUrl(model.qrUrl);
  }, [model.qrUrl]);

  useEffect(() => {
    openRef.current = open;
    host.dataset.menuOpen = open ? 'true' : 'false';
    onOpenChange(open);
    if (!open) {
      setDetailOpen(false);
      return undefined;
    }
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!host.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [host, onOpenChange, open]);

  useEffect(() => {
    host.dataset.detailOpen = detailOpen ? 'true' : 'false';
  }, [detailOpen, host]);

  useEffect(() => {
    registerControls({
      close(options) {
        setOpen(false);
        if (options?.restoreFocus) {
          requestAnimationFrame(() => buttonRef.current?.focus());
        }
      },
      isOpen() {
        return openRef.current;
      },
      openCommunity(disposition = 'newTab') {
        if (model.channel === 'wechat') {
          setOpen(true);
          setDetailOpen(true);
          return;
        }
        setOpen(false);
        onOpenExternal(model.xUrl, disposition);
      },
      setOpen(nextOpen) {
        setOpen(nextOpen);
      }
    });
  }, [registerControls]);

  const close = () => setOpen(false);
  const getDisposition = (event?: {
    button?: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
  }) =>
    event && (event.ctrlKey || event.metaKey || event.button === 1)
      ? 'backgroundTab'
      : 'newTab';
  const openCommunity = (
    disposition: 'newTab' | 'backgroundTab' = 'newTab'
  ) => {
    if (model.channel === 'wechat') {
      setDetailOpen((current) => !current);
      return;
    }
    close();
    onOpenExternal(model.xUrl, disposition);
  };

  return (
    <Fragment>
      <button
        aria-controls="_x_extension_newtab_feedback_popover_2026_unique_"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={model.buttonLabel}
        className="x-nt-feedback-button"
        data-open={open ? 'true' : 'false'}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onHideTooltip();
          setOpen((current) => !current);
        }}
        onFocus={(event) => {
          if (!open) {
            onShowTooltip(event.currentTarget, model.buttonLabel);
          }
        }}
        onMouseEnter={(event) => {
          if (!open) {
            onShowTooltip(event.currentTarget, model.buttonLabel);
          }
        }}
        onMouseLeave={onHideTooltip}
        onBlur={onHideTooltip}
        ref={buttonRef}
        type="button"
      >
        <i aria-hidden="true" className="ri-icon ri-size-20 ri-message-3-line" />
      </button>
      <div
        aria-label={model.menuAriaLabel}
        className="x-nt-feedback-popover"
        data-detail-open={detailOpen ? 'true' : 'false'}
        hidden={!open}
        id="_x_extension_newtab_feedback_popover_2026_unique_"
        role="menu"
      >
        <div className="x-nt-feedback-menu">
          <a
            aria-label={model.xTooltip}
            className="x-nt-feedback-action"
            data-tooltip={model.xTooltip}
            href={model.xUrl}
            onBlur={onHideTooltip}
            onClick={() => {
              onHideTooltip();
              close();
            }}
            onFocus={(event) => onShowTooltip(event.currentTarget, model.xTooltip)}
            onMouseEnter={(event) => onShowTooltip(event.currentTarget, model.xTooltip)}
            onMouseLeave={onHideTooltip}
            rel="noreferrer noopener"
            role="menuitem"
            target="_blank"
          >
            <i aria-hidden="true" className="ri-icon ri-size-16 ri-twitter-x-line" />
          </a>
          <a
            aria-label={model.githubIssueTooltip}
            className="x-nt-feedback-action"
            data-tooltip={model.githubIssueTooltip}
            href={model.githubIssueUrl}
            onBlur={onHideTooltip}
            onClick={() => {
              onHideTooltip();
              close();
            }}
            onFocus={(event) =>
              onShowTooltip(event.currentTarget, model.githubIssueTooltip)
            }
            onMouseEnter={(event) =>
              onShowTooltip(event.currentTarget, model.githubIssueTooltip)
            }
            onMouseLeave={onHideTooltip}
            rel="noreferrer noopener"
            role="menuitem"
            target="_blank"
          >
            <i aria-hidden="true" className="ri-icon ri-size-16 ri-github-line" />
          </a>
          <a
            aria-label={model.chromeReviewTooltip}
            className="x-nt-feedback-action"
            data-tooltip={model.chromeReviewTooltip}
            href={model.chromeReviewUrl}
            onBlur={onHideTooltip}
            onClick={() => {
              onHideTooltip();
              close();
            }}
            onFocus={(event) =>
              onShowTooltip(event.currentTarget, model.chromeReviewTooltip)
            }
            onMouseEnter={(event) =>
              onShowTooltip(event.currentTarget, model.chromeReviewTooltip)
            }
            onMouseLeave={onHideTooltip}
            rel="noreferrer noopener"
            role="menuitem"
            target="_blank"
          >
            <i aria-hidden="true" className="ri-icon ri-size-16 ri-star-line" />
          </a>
          {/* Outside Chinese the menu's X button is the community entry, so this one is WeChat only. */}
          {model.channel === 'wechat' && (
            <button
              aria-expanded={detailOpen}
              aria-haspopup
              aria-label={model.communityTooltip}
              className="x-nt-feedback-action x-nt-feedback-action-community"
              data-active={detailOpen ? 'true' : 'false'}
              data-channel={model.channel}
              data-tooltip={model.communityTooltip}
              onBlur={onHideTooltip}
              onClick={(event) => {
                onHideTooltip();
                openCommunity(getDisposition(event));
              }}
              onFocus={(event) =>
                onShowTooltip(event.currentTarget, model.communityTooltip)
              }
              onMouseEnter={(event) =>
                onShowTooltip(event.currentTarget, model.communityTooltip)
              }
              onMouseLeave={onHideTooltip}
              role="menuitem"
              type="button"
            >
              <i aria-hidden="true" className="ri-icon ri-size-16 ri-wechat-fill" />
            </button>
          )}
        </div>
        <div
          className="x-nt-feedback-detail"
          data-channel={model.channel}
          hidden={!detailOpen}
        >
          <div className="x-nt-feedback-detail-header">
            <div className="x-nt-feedback-detail-title">{model.panelTitle}</div>
            <div className="x-nt-feedback-detail-actions">
              <button
                aria-busy={loading}
                aria-label={model.refreshTooltip}
                className="x-nt-feedback-detail-action x-nt-feedback-detail-refresh"
                disabled={loading}
                onBlur={onHideTooltip}
                onClick={async (event) => {
                  const refreshButton = event.currentTarget;
                  onHideTooltip();
                  setLoading(true);
                  try {
                    const result = await onRefreshQr();
                    if (result.qrUrl) {
                      setQrUrl(result.qrUrl);
                    }
                    if (result.message && refreshButton.isConnected) {
                      onShowTooltip(refreshButton, result.message);
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                onFocus={(event) =>
                  onShowTooltip(event.currentTarget, model.refreshTooltip)
                }
                onMouseEnter={(event) =>
                  onShowTooltip(event.currentTarget, model.refreshTooltip)
                }
                onMouseLeave={onHideTooltip}
                role="menuitem"
                type="button"
              >
                <i aria-hidden="true" className="ri-icon ri-size-16 ri-refresh-line x-lumno-busy-spin" />
              </button>
              <button
                aria-label={model.closeTooltip}
                className="x-nt-feedback-detail-action x-nt-feedback-detail-close"
                onBlur={onHideTooltip}
                onClick={() => {
                  onHideTooltip();
                  setOpen(false);
                  requestAnimationFrame(() => buttonRef.current?.focus());
                }}
                onFocus={(event) =>
                  onShowTooltip(event.currentTarget, model.closeTooltip)
                }
                onMouseEnter={(event) =>
                  onShowTooltip(event.currentTarget, model.closeTooltip)
                }
                onMouseLeave={onHideTooltip}
                role="menuitem"
                type="button"
              >
                <i aria-hidden="true" className="ri-icon ri-size-16 ri-close-line" />
              </button>
            </div>
          </div>
          {model.channel === 'wechat' ? (
            <img
              alt={model.qrAlt}
              className="x-nt-feedback-qr-image"
              height="1596"
              loading="lazy"
              src={qrUrl}
              width="1080"
            />
          ) : null}
        </div>
      </div>
    </Fragment>
  );
}

export function createFeedbackControlController(
  host: HTMLElement | null,
  options: FeedbackControlControllerOptions
): FeedbackControlController {
  if (!host) {
    return Object.freeze({
      close() {},
      destroy() {},
      isOpen: () => false,
      openCommunity() {},
      render() {},
      setOpen() {}
    });
  }
  host.classList.add('x-nt-feedback-control');
  host.dataset.detailOpen = 'false';
  host.dataset.menuOpen = 'false';
  host.dataset.reactIsland = 'newtab-feedback-control';
  const root: Root = createRoot(host);
  let controls: {
    close(options?: { restoreFocus?: boolean }): void;
    isOpen(): boolean;
    openCommunity(
      disposition?: 'newTab' | 'backgroundTab'
    ): void;
    setOpen(open: boolean): void;
  } = {
    close() {},
    isOpen: () => false,
    openCommunity() {},
    setOpen(_open) {}
  };
  let destroyed = false;
  const registerControls = (nextControls: typeof controls) => {
    controls = nextControls;
  };
  const onOpenChange = (open: boolean) => {
    host.dataset.menuOpen = open ? 'true' : 'false';
    if (open) {
      void options.onOpen();
    }
  };

  return Object.freeze({
    close(closeOptions?: { restoreFocus?: boolean }) {
      controls.close(closeOptions);
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      flushSync(() => root.unmount());
    },
    isOpen() {
      return controls.isOpen();
    },
    openCommunity(
      disposition: 'newTab' | 'backgroundTab' = 'newTab'
    ) {
      controls.openCommunity(disposition);
    },
    render(model: FeedbackControlModel) {
      if (destroyed) {
        return;
      }
      flushSync(() => {
        root.render(
          <FeedbackControl
            host={host}
            model={model}
            onOpenChange={onOpenChange}
            onOpenExternal={options.onOpenExternal}
            onHideTooltip={options.onHideTooltip}
            onRefreshQr={options.onRefreshQr}
            onShowTooltip={options.onShowTooltip}
            registerControls={registerControls}
          />
        );
      });
    },
    setOpen(open: boolean) {
      controls.setOpen(open);
    }
  });
}

export function createFeedbackControlApi() {
  return Object.freeze({
    implementation: 'react',
    createFeedbackControlController
  });
}
