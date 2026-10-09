import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFeedbackControlApi,
  createFeedbackControlController,
  type FeedbackControlController,
  type FeedbackControlModel
} from './feedback';

const baseModel: FeedbackControlModel = {
  buttonLabel: 'Send feedback',
  channel: 'discord',
  chromeReviewLabel: 'Store rating',
  chromeReviewTooltip: 'Rate Lumno in the extension store',
  chromeReviewUrl: 'https://chromewebstore.google.com/detail/example/reviews',
  closeTooltip: 'Close',
  communityLabel: 'Discord',
  communityTooltip: 'Join Discord',
  discordUrl: 'https://discord.gg/example',
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
  document.body.innerHTML = '';
});

describe('New Tab feedback React island', () => {
  it('owns the legacy feedback host and exposes synchronous open controls', () => {
    const { controller, host, options } = createController();
    const button = host.querySelector<HTMLButtonElement>(
      '.x-nt-feedback-button'
    );

    expect(createFeedbackControlApi().implementation).toBe('react');
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

  it('keeps all channel links and preserves background Discord opening', () => {
    const { controller, host, options } = createController();
    act(() => controller.setOpen(true));

    expect(
      host.querySelector<HTMLAnchorElement>('a[href*="x.com"]')?.href
    ).toBe(baseModel.xUrl);
    expect(
      host.querySelector<HTMLAnchorElement>('a[href*="github.com"]')?.href
    ).toBe(baseModel.githubIssueUrl);
    expect(
      host.querySelector<HTMLAnchorElement>('a[href*="chromewebstore"]')?.href
    ).toBe(baseModel.chromeReviewUrl);

    const community = host.querySelector<HTMLButtonElement>(
      '.x-nt-feedback-action-community'
    );
    act(() => {
      community?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, ctrlKey: true })
      );
    });

    expect(options.onOpenExternal).toHaveBeenCalledWith(
      baseModel.discordUrl,
      'backgroundTab'
    );
    expect(controller.isOpen()).toBe(false);
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

    const community = host.querySelector<HTMLButtonElement>(
      '.x-nt-feedback-action-community'
    );
    act(() => community?.click());

    expect(host.dataset.detailOpen).toBe('true');
    expect(
      host.querySelector<HTMLElement>('.x-nt-feedback-detail')?.hidden
    ).toBe(false);

    await act(async () => {
      host
        .querySelector<HTMLButtonElement>('.x-nt-feedback-detail-refresh')
        ?.click();
      await Promise.resolve();
    });

    expect(onRefreshQr).toHaveBeenCalledTimes(1);
    expect(
      host.querySelector<HTMLImageElement>('.x-nt-feedback-qr-image')?.src
    ).toBe(refreshedUrl);
  });

  it('lets an external prompt open the locale-appropriate community directly', () => {
    const discord = createController();
    act(() => discord.controller.openCommunity('backgroundTab'));
    expect(discord.options.onOpenExternal).toHaveBeenCalledWith(
      baseModel.discordUrl,
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
      wechat.host.querySelector<HTMLElement>('.x-nt-feedback-detail')?.hidden
    ).toBe(false);
  });
});
