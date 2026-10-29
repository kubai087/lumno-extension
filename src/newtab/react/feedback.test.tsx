import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFeedbackControlController,
  type FeedbackControlController,
  type FeedbackControlModel
} from './feedback';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

const baseModel: FeedbackControlModel = {
  buttonLabel: 'Send feedback',
  channel: 'x',
  chromeReviewLabel: 'Store rating',
  chromeReviewTooltip: 'Rate Lumno in the extension store',
  chromeReviewUrl: 'https://chromewebstore.google.com/detail/example/reviews',
  closeTooltip: 'Close',
  communityLabel: 'X',
  communityTooltip: 'Contact on X',
  githubIssueLabel: 'GitHub Issue',
  githubIssueTooltip: 'Open a GitHub Issue',
  githubIssueUrl: 'https://github.com/example/repo/issues/new',
  menuAriaLabel: 'Feedback channels',
  panelTitle: 'Bug reports & feature requests',
  qrAlt: 'WeChat QR code',
  qrUrl: 'https://example.com/qr.jpg',
  refreshTooltip: 'Refresh QR code',
  xLabel: 'X',
  xTooltip: 'Contact on X',
  xUrl: 'https://x.com/example'
};

let controllers: FeedbackControlController[] = [];

function createController(
  model: FeedbackControlModel = baseModel,
  overrides: Partial<Parameters<typeof createFeedbackControlController>[1]> = {}
) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const options = {
    onHideTooltip: vi.fn(),
    onOpen: vi.fn(),
    onOpenExternal: vi.fn(),
    onRefreshQr: vi.fn(async () => ({})),
    onShowTooltip: vi.fn(),
    ...overrides
  };
  const controller = createFeedbackControlController(host, options);
  controllers.push(controller);
  act(() => controller.render(model));
  return { controller, host, options };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.replaceChildren();
});

describe('New Tab feedback React island', () => {
  it('owns the legacy feedback host and exposes synchronous open controls', () => {
    const { controller, host, options } = createController();
    const button = queryHtmlTag(host, '.x-nt-feedback-button', 'button');

    expect(host.dataset.reactIsland).toBe('newtab-feedback-control');
    expect(host.classList.contains('x-nt-feedback-control')).toBe(true);
    expect(controller.isOpen()).toBe(false);

    act(() => controller.setOpen(true));

    expect(controller.isOpen()).toBe(true);
    expect(host.dataset.menuOpen).toBe('true');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(options.onOpen).toHaveBeenCalledTimes(1);

    act(() => controller.close());
    expect(controller.isOpen()).toBe(false);
  });

  it('keeps all channel links, with X as the community entry outside Chinese', () => {
    const { controller, host } = createController();
    act(() => controller.setOpen(true));

    expect(
      queryHtmlTag(host, 'a[href*="x.com"]', 'a')?.href
    ).toBe(baseModel.xUrl);
    expect(
      queryHtmlTag(host, 'a[href*="github.com"]', 'a')?.href
    ).toBe(baseModel.githubIssueUrl);
    expect(
      queryHtmlTag(host, 'a[href*="chromewebstore"]', 'a')?.href
    ).toBe(baseModel.chromeReviewUrl);
    // The menu's X button already covers it, so there is no separate community button.
    expect(host.querySelector('.x-nt-feedback-action-community')).toBeNull();
  });

  it('renders and refreshes the WeChat detail without rebuilding the host', async () => {
    const refreshedUrl = 'https://example.com/qr.jpg?v=2';
    const onRefreshQr = vi.fn(async () => ({
      message: 'Latest QR code loaded',
      qrUrl: refreshedUrl
    }));
    const { controller, host } = createController(
      {
        ...baseModel,
        channel: 'wechat',
        communityLabel: 'WeChat',
        communityTooltip: 'Join WeChat'
      },
      { onRefreshQr }
    );
    act(() => controller.setOpen(true));

    const community = queryHtmlTag(host, '.x-nt-feedback-action-community', 'button');
    act(() => community?.click());

    expect(host.dataset.detailOpen).toBe('true');
    expect(
      queryHtmlElement(host, '.x-nt-feedback-detail')?.hidden
    ).toBe(false);

    await act(async () => {
      queryHtmlTag(host, '.x-nt-feedback-detail-refresh', 'button')
        ?.click();
      await Promise.resolve();
    });

    expect(onRefreshQr).toHaveBeenCalledTimes(1);
    expect(
      queryHtmlTag(host, '.x-nt-feedback-qr-image', 'img')?.src
    ).toBe(refreshedUrl);
  });

  it('lets an external prompt open the locale-appropriate community directly', () => {
    const x = createController();
    act(() => x.controller.openCommunity('backgroundTab'));
    expect(x.options.onOpenExternal).toHaveBeenCalledWith(
      baseModel.xUrl,
      'backgroundTab'
    );

    const wechat = createController({
      ...baseModel,
      channel: 'wechat',
      communityLabel: 'WeChat',
      communityTooltip: 'Join WeChat'
    });
    act(() => wechat.controller.openCommunity());
    expect(wechat.controller.isOpen()).toBe(true);
    expect(wechat.host.dataset.detailOpen).toBe('true');
    expect(
      queryHtmlElement(wechat.host, '.x-nt-feedback-detail')?.hidden
    ).toBe(false);
  });

  it('opens the community of the latest model after a language change', () => {
    const { controller, host, options } = createController();
    act(() => controller.render({
      ...baseModel,
      channel: 'wechat',
      communityLabel: 'WeChat',
      communityTooltip: 'Join WeChat'
    }));
    act(() => controller.openCommunity());
    expect(options.onOpenExternal).not.toHaveBeenCalled();
    expect(host.dataset.detailOpen).toBe('true');

    act(() => controller.close());
    act(() => controller.render({ ...baseModel, xUrl: 'https://x.com/renamed' }));
    act(() => controller.openCommunity('backgroundTab'));
    expect(options.onOpenExternal).toHaveBeenCalledWith('https://x.com/renamed', 'backgroundTab');
  });
});
