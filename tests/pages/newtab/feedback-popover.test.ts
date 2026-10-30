import { describe, expect, it, vi } from 'vitest';
import enMessages from '../../../_locales/en/messages.json';
import jaMessages from '../../../_locales/ja/messages.json';
import zhCnMessages from '../../../_locales/zh_CN/messages.json';
import zhTwMessages from '../../../_locales/zh_TW/messages.json';
import { COMMUNITY_LINKS_URL } from '../../../src/platform/community-links';
import { createBrowserFake } from '../../fakes/browser';
import { parsePageCss } from '../../fakes/css';
import { getElement, getElements, required } from '../../fakes/dom';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import { bootReadyNewtab } from './boot';
import { dispatch, pause } from './search-page';

// The New Tab feedback button: a popover of feedback channels that can open
// a WeChat group panel with a QR code the user can refresh.
type Messages = Record<string, { message: string } | undefined>;

function message(messages: Messages, key: string): string {
  return required(messages[key], key).message;
}

// The QR images the page preloads load, or fail, a moment after their src is set.
function stubQrImages(fails: boolean): void {
  vi.stubGlobal('Image', function QrImage() {
    const image = document.createElement('img');
    Object.defineProperty(image, 'src', {
      get: () => image.getAttribute('src'),
      set(value: string) {
        image.setAttribute('src', value);
        setTimeout(() => {
          const handler = fails ? image.onerror : image.onload;
          if (typeof handler === 'function') handler.call(image, new Event(fails ? 'error' : 'load'));
        }, 5);
      }
    });
    return image;
  });
}

// New Tab in Chinese, where the WeChat group is offered, with the community
// links request answered and the QR images under the test's control.
async function openFeedback(qrFails = false) {
  const fetched: string[] = [];
  stubQrImages(qrFails);
  await bootReadyNewtab(createBrowserFake({ sync: { _x_extension_language_2024_unique_: 'zh_CN' } }), {
    fetch: async (url) => {
      fetched.push(String(url));
      return String(url).startsWith(COMMUNITY_LINKS_URL) ? { ok: true, json: async () => ({}) } : fetchPackaged(url);
    }
  });
  await pause(300);
  return { control: getElement(document, '.x-nt-feedback-control'), fetched };
}

async function click(element: Element, ms: number): Promise<void> {
  await dispatch(element, new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await pause(ms);
}

const iconName = (element: Element) => required(getElement(element, '.ri-icon').className.match(/ri-[a-z-]+-(?:line|fill)/), 'an icon class')[0];

describe('New Tab feedback popover', () => {
  it('offers the channels, opens the WeChat panel and gives focus back when closed', async () => {
    const { control } = await openFeedback();
    const button = getElement(control, '.x-nt-feedback-button');
    await click(button, 200);
    const actions = getElements(control, '.x-nt-feedback-action');
    const icons = actions.map(iconName);

    expect(icons).toContain('ri-star-line');
    expect(actions[icons.indexOf('ri-star-line')].getAttribute('aria-label')).toBe(message(zhCnMessages, 'newtab_feedback_chrome_review_tooltip'));
    await click(actions[icons.indexOf('ri-wechat-fill')], 200);
    expect(control.getAttribute('data-detail-open')).toBe('true');
    const detail = getElement(control, '.x-nt-feedback-detail');
    expect(getElement(detail, '.x-nt-feedback-detail-title').textContent).toBe('Bug 反馈 & 新功能提需');
    expect(getElements(detail, '.x-nt-feedback-detail-actions button').map((item) => [item.getAttribute('aria-label'), iconName(item)]))
      .toEqual([['刷新二维码', 'ri-refresh-line'], ['关闭', 'ri-close-line']]);
    const qr = getElement(detail, '.x-nt-feedback-qr-image');
    expect([qr.getAttribute('width'), qr.getAttribute('height')]).toEqual(['1080', '1596']);

    await click(getElement(detail, '.x-nt-feedback-detail-close'), 100);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it.each([[false, 'newtab_feedback_wechat_refresh_success', 'newtab_feedback_wechat_refresh_error'],
    [true, 'newtab_feedback_wechat_refresh_error', 'newtab_feedback_wechat_refresh_success']])(
    'asks for the community links again on refresh and says how it went (QR fails: %s)', async (qrFails, shownKey, otherKey) => {
      const { control, fetched } = await openFeedback(qrFails);
      await click(getElement(control, '.x-nt-feedback-button'), 150);
      await click(getElement(control, '.x-nt-feedback-action-community'), 150);
      const before = fetched.length;
      await click(getElement(control, '.x-nt-feedback-detail-refresh'), 300);

      expect(fetched.slice(before).some((url) => url.startsWith(COMMUNITY_LINKS_URL))).toBe(true);
      expect(document.body.textContent).toContain(message(zhCnMessages, shownKey));
      expect(document.body.textContent).not.toContain(message(zhCnMessages, otherKey));
    });
});

describe('New Tab feedback popover styles', () => {
  const css = parsePageCss('newtab.html');

  it('opens like the menu surfaces and resizes without a bounce', () => {
    const popover = required(css.rule('.x-nt-feedback-popover'), 'the popover');
    expect(popover.get('transition')).toMatch(/opacity 170ms ease, transform 360ms cubic-bezier\(0\.2, 1\.45, 0\.35, 1\)/);
    expect(popover.get('transition')).toMatch(/width 260ms cubic-bezier\(0\.22, 1, 0\.36, 1\), height 260ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
    // Four 34px icons, three 6px gaps and 8px side padding, with room above and below.
    expect([popover.get('width'), popover.get('height'), popover.get('padding')]).toEqual(['170px', '54px', '10px 8px']);
    expect([popover.get('contain'), popover.get('overflow')]).toEqual(['layout', 'visible']);
    expect(css.rule('.x-nt-feedback-popover', /corner-shape/)?.get('corner-shape')).toBe('superellipse(1.25)');
  });

  it('clips the QR panel, which replaces the icon row', () => {
    expect(css.rule('.x-nt-feedback-control[data-detail-open="true"] .x-nt-feedback-popover')?.get('overflow')).toBe('hidden');
    expect(css.rule('.x-nt-feedback-control[data-detail-open="true"] .x-nt-feedback-menu')?.get('visibility')).toBe('hidden');
  });

  it('paints the action circles outward from their 34px hit targets', () => {
    const action = required(css.rule('.x-nt-feedback-action'), 'the action');
    expect([action.get('position'), action.get('overflow'), action.get('background'), action.get('border')]).toEqual(['relative', 'visible', 'transparent', '0']);
    const circle = required(css.rule('.x-nt-feedback-action::before'), 'the action circle');
    expect(circle.get('inset')).toBe('-1px');
    expect(circle.get('background')).toBeTruthy();
    const community = css.rule('.x-nt-feedback-action-community::before')?.get('box-shadow') || '';
    expect(community).toMatch(/^0 0 0 1px #12161f,/);
    expect(community).toMatch(/inset 0 1px 0 rgba\(255, 255, 255, 0\.18\), inset 0 1px 3px rgba\(255, 255, 255, 0\.1\), inset 0 -1px 0 rgba\(0, 0, 0, 0\.22\)/);
  });

  it('puts the panel’s icon actions in its header under a larger title', () => {
    expect(css.rule('.x-nt-feedback-detail-actions')).not.toBeNull();
    const detailAction = css.rule('.x-nt-feedback-detail-action');
    expect([detailAction?.get('width'), detailAction?.get('background')]).toEqual(['28px', 'transparent']);
    expect(css.rule('.x-nt-feedback-detail-title')?.get('font-size')).toBe('14px');
  });
});

describe('New Tab feedback copy', () => {
  it('names the WeChat group panel in every locale', () => {
    expect(message(zhCnMessages, 'newtab_feedback_wechat_panel_title')).toBe('Bug 反馈 & 新功能提需');
    expect(message(zhTwMessages, 'newtab_feedback_wechat_panel_title')).toBe('問題回報與功能建議');
    expect(message(enMessages, 'newtab_feedback_wechat_panel_title')).toBe('Bug reports & feature requests');
    expect(message(jaMessages, 'newtab_feedback_wechat_panel_title')).toBe('不具合・要望');
    expect(['newtab_feedback_wechat_label', 'newtab_feedback_wechat_tooltip', 'newtab_feedback_wechat_qr_title', 'newtab_feedback_wechat_qr_alt']
      .map((key) => message(zhTwMessages, key))).toEqual(['微信群組', '加入 Lumno 微信群組', '微信群組 QR Code', 'Lumno 微信群組 QR Code']);
  });

  it.each<[string, Messages, string, string, string, string]>([
    ['zh-CN', zhCnMessages, '刷新二维码', '已拉取最新二维码', '刷新失败，请稍后重试。', '关闭'],
    ['zh-TW', zhTwMessages, '重新載入 QR Code', '已載入最新 QR Code', '無法更新 QR Code，請稍後再試。', '關閉'],
    ['en', enMessages, 'Refresh QR code', 'Latest QR code loaded', "Couldn't refresh. Try again.", 'Close'],
    ['ja', jaMessages, 'QRコードを更新', '最新のQRコードを取得しました', '更新できませんでした。もう一度お試しください。', '閉じる']
  ])('labels the QR refresh and close in %s', (_locale, messages, refresh, success, error, close) => {
    expect(['newtab_feedback_wechat_refresh_tooltip', 'newtab_feedback_wechat_refresh_success', 'newtab_feedback_wechat_refresh_error',
      'newtab_feedback_wechat_close_tooltip'].map((key) => message(messages, key))).toEqual([refresh, success, error, close]);
  });

  it.each<[string, Messages, string, string]>([
    ['zh-CN', zhCnMessages, '商店评分', '去扩展商店为 Lumno 评分'],
    ['zh-TW', zhTwMessages, '商店評分', '到擴充功能商店為 Lumno 評分'],
    ['en', enMessages, 'Store rating', 'Rate Lumno in the extension store'],
    ['ja', jaMessages, 'ストアで評価', '拡張機能ストアで Lumno を評価する']
  ])('names the review action in %s without naming one store', (_locale, messages, label, tooltip) => {
    expect([message(messages, 'newtab_feedback_chrome_review_label'), message(messages, 'newtab_feedback_chrome_review_tooltip')]).toEqual([label, tooltip]);
  });
});
