import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DAY_MS,
  ENGAGEMENT_NOTICE_ENABLED,
  MAX_EXPOSURES,
  WECHAT_QR_URL,
  X_URL,
  createEngagementNotice,
  getCommunityChannel,
  getCommunityUrl,
  getReviewUrl,
  normalizeEngagementState,
  shouldShowEngagementNotice
} from './engagement-notice';
import type { EngagementNoticeOptions, EngagementState, EngagementSurface } from './engagement-notice';
import type { FeatureHintController, FeatureHintDefinition, FeatureHintOptions } from './ui/feature-hint-catalog';
import { FALLBACK_LINKS } from '../platform/community-links';
import { engagementNoticeState } from '../domain/settings/features';
import { createBrowserFake } from '../../tests/fakes/browser';
import type { BrowserFake } from '../../tests/fakes/browser';
import { getTestPortals } from '../../tests/fakes/portals';
import { required } from '../../tests/fakes/dom';
import enMessages from '../../_locales/en/messages.json';
import jaMessages from '../../_locales/ja/messages.json';
import zhCnMessages from '../../_locales/zh_CN/messages.json';
import zhTwMessages from '../../_locales/zh_TW/messages.json';
import manifest from '../../manifest.json';

const NOW = Date.UTC(2026, 6, 20, 8);

function eligibleState(surface: EngagementSurface): EngagementState {
  const state = normalizeEngagementState(null);
  state[surface] = {
    activeDays: ['2026-07-01', '2026-07-03', '2026-07-05', '2026-07-07'],
    firstSeenAt: NOW - 8 * DAY_MS,
    meaningfulUses: surface === 'newtab' ? 5 : 0,
    opens: surface === 'newtab' ? 8 : 10
  };
  return state;
}

function isDefinition(value: FeatureHintOptions['definition']): value is FeatureHintDefinition {
  return typeof value === 'object' && value !== null;
}

// The feature hint the notice draws through, as a stand-in that records the
// options it was made with and whether it is shown.
function createHintStandIn() {
  const made: FeatureHintOptions[] = [];
  const element = document.createElement('div');
  const createFeatureHint = (options: FeatureHintOptions): FeatureHintController => {
    made.push(options);
    const definition = options.definition;
    if (!isDefinition(definition)) {
      throw new Error('Expected the notice to pass its own definition.');
    }
    let dismissed = false;
    return {
      definition,
      element,
      textId: 'engagement-text',
      ready: Promise.resolve(false),
      destroy() {},
      dismiss() {
        if (dismissed) return;
        dismissed = true;
        options.onDismiss?.(definition);
      },
      isDismissed: () => dismissed,
      isVisible: () => element.getAttribute('data-visible') === 'true',
      setVisible(visible) {
        element.setAttribute('data-visible', visible ? 'true' : 'false');
      },
      updateLanguage() {}
    };
  };
  return {
    featureHints: { createFeatureHint },
    element,
    options: () => required(made[0], 'the feature hint options')
  };
}

function storedState(browser: BrowserFake): EngagementState {
  return normalizeEngagementState(browser.storage.local.values[engagementNoticeState.key]);
}

async function settle(): Promise<void> {
  for (let pass = 0; pass < 6; pass += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function startNotice(browser: BrowserFake, hint: ReturnType<typeof createHintStandIn>, options: Partial<EngagementNoticeOptions> = {}) {
  return required(createEngagementNotice({
    portals: getTestPortals(),
    chromeApi: browser,
    delayMs: 0,
    documentObj: document,
    featureHints: hint.featureHints,
    now: () => NOW,
    surface: 'overlay',
    ...options
  }), 'the engagement notice');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('engagement notice eligibility', () => {
  it('invites an overlay user after ten opens across four days and a week', () => {
    const state = eligibleState('overlay');
    expect(shouldShowEngagementNotice(state, 'overlay', NOW)).toBe(true);
    state.overlay.opens = 9;
    expect(shouldShowEngagementNotice(state, 'overlay', NOW)).toBe(false);
  });

  it('invites a New Tab user only after five meaningful searches', () => {
    const state = eligibleState('newtab');
    state.newtab.meaningfulUses = 4;
    expect(shouldShowEngagementNotice(state, 'newtab', NOW)).toBe(false);
    state.newtab.meaningfulUses = 5;
    expect(shouldShowEngagementNotice(state, 'newtab', NOW)).toBe(true);
  });

  it('retries an ignored invitation once, after two weeks', () => {
    const state = eligibleState('newtab');
    state.exposureCount = 1;
    state.lastShownAt = NOW - 13 * DAY_MS;
    expect(shouldShowEngagementNotice(state, 'newtab', NOW)).toBe(false);
    state.lastShownAt = NOW - 15 * DAY_MS;
    expect(shouldShowEngagementNotice(state, 'newtab', NOW)).toBe(true);
    state.exposureCount = MAX_EXPOSURES;
    expect(shouldShowEngagementNotice(state, 'newtab', NOW)).toBe(false);
  });

  it('sends Chinese users to the WeChat QR code and others to X', () => {
    expect(getCommunityUrl('zh_CN')).toBe(WECHAT_QR_URL);
    expect(getCommunityUrl('zh_TW')).toBe(WECHAT_QR_URL);
    expect(getCommunityChannel('zh_TW')).toBe('wechat');
    expect(getCommunityUrl('en')).toBe(X_URL);
    expect(WECHAT_QR_URL).toBe(FALLBACK_LINKS.wechatQr);
  });

  it('rates on Firefox Add-ons in Firefox', () => {
    vi.stubGlobal('chrome', { runtime: { id: 'lumno@kubai087' } });
    expect(getReviewUrl()).toBe('https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/reviews/');
  });
});

describe('engagement notice', () => {
  it('shows an eligible overlay user a one-sentence prompt with rating and WeChat actions', async () => {
    expect(ENGAGEMENT_NOTICE_ENABLED).toBe(true);
    const browser = createBrowserFake({ local: { [engagementNoticeState.key]: eligibleState('overlay') } });
    const hint = createHintStandIn();
    const onReview = vi.fn();
    startNotice(browser, hint, { locale: 'zh_TW', onReview });
    await settle();

    expect(hint.element.getAttribute('data-visible')).toBe('true');
    expect(hint.element.getAttribute('data-engagement-surface')).toBe('overlay');
    const options = hint.options();
    const definition = options.definition;
    expect(isDefinition(definition) && definition.inlineActions).toBe(true);
    expect(options.badgeIconImageSrc?.endsWith('/assets/images/lumno.png')).toBe(true);
    expect(options.badgeWordmarkImageSrc?.endsWith('/assets/images/lumno-wordmark-mask.svg')).toBe(true);
    const actions = options.actions || [];
    expect(actions.map((action) => action.icon)).toEqual(['ri-external-link-line', 'ri-wechat-fill']);
    expect(actions[0].labelFallback).toBe('leave 5 stars');

    actions[0].onClick?.(new MouseEvent('click'), required(isDefinition(definition) ? definition : null), {
      id: 'review', icon: null, labelKey: '', labelFallback: '', onClick: null, variant: 'primary', order: 0
    });
    await settle();
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(storedState(browser).completedAt).toBeGreaterThan(0);
  });

  it('waits for the update notice and spends no exposure on a session it owns', async () => {
    const browser = createBrowserFake({ local: { [engagementNoticeState.key]: eligibleState('overlay') } });
    const hint = createHintStandIn();
    let decide: (shown: boolean) => void = () => {};
    let updateOwnsSession = false;
    const notice = startNotice(browser, hint, {
      exposureGate: new Promise<boolean>((resolve) => {
        decide = resolve;
      }),
      canShow: () => !updateOwnsSession
    });
    await settle();
    expect(hint.element.getAttribute('data-visible')).not.toBe('true');

    updateOwnsSession = true;
    decide(true);
    await settle();
    expect(hint.element.getAttribute('data-visible')).not.toBe('true');
    expect(storedState(browser).exposureCount).toBe(0);
    notice.destroy();

    const nextHint = createHintStandIn();
    const next = startNotice(browser, nextHint, { exposureGate: Promise.resolve(false), canShow: () => true, now: () => NOW + 1 });
    await settle();
    expect(nextHint.element.getAttribute('data-visible')).toBe('true');
    expect(storedState(browser).exposureCount).toBe(1);
    next.destroy();
  });

  it('shows an eligible Firefox user the rating prompt', async () => {
    vi.stubGlobal('chrome', { runtime: { id: 'lumno@kubai087' } });
    const browser = createBrowserFake({ local: { [engagementNoticeState.key]: eligibleState('overlay') } });
    const hint = createHintStandIn();
    const notice = startNotice(browser, hint);
    await settle();
    expect(hint.element.getAttribute('data-visible')).toBe('true');
    notice.destroy();
  });
});

describe('engagement notice copy', () => {
  const copy = (messages: Record<string, { message: string }>) => [
    'engagement_notice_text',
    'engagement_notice_review',
    'engagement_notice_connector',
    'engagement_notice_community',
    'engagement_notice_trailing'
  ].map((key) => messages[key].message);

  it('stays short in Simplified Chinese and asks for a full-score review', () => {
    expect(zhCnMessages.engagement_notice_text.message).toBe('如果用得开心，诚邀');
    expect(zhCnMessages.engagement_notice_review.message).toBe('满分好评');
  });

  it('names X in English and Japanese and the WeChat group in Traditional Chinese', () => {
    expect(copy(enMessages)).toEqual(['Like Lumno? Why not', 'leave 5 stars', 'or', 'find us on X', 'and say hi.']);
    expect(copy(jaMessages)).toEqual(['気に入ったら、', '★5で評価', 'するか、', 'X で声をかけて', 'みませんか。']);
    expect(copy(zhTwMessages)).toEqual(['如果用得開心，歡迎', '留下五星好評', '，或是', '加入微信群組', '和我們聊聊。']);
  });

  it('lets web pages load the wordmark the overlay prompt shows', () => {
    expect(manifest.web_accessible_resources.some((entry) => entry.resources.includes('assets/images/lumno-wordmark-mask.svg'))).toBe(true);
  });
});
