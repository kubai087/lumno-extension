const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabJs = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');
const communityLinksJs = fs.readFileSync(
  path.join(repoRoot, 'src/shared/community-links.js'),
  'utf8'
);
const feedbackReact = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/feedback.tsx'),
  'utf8'
);
const zhCnMessages = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales/zh_CN/messages.json'), 'utf8'));
const zhTwMessages = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales/zh_TW/messages.json'), 'utf8'));
const enMessages = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales/en/messages.json'), 'utf8'));
const jaMessages = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales/ja/messages.json'), 'utf8'));

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function getMessage(messages, key) {
  const item = messages[key];
  assert.ok(item && typeof item.message === 'string', `${key} should be localized`);
  return item.message;
}

assertContains(
  newtabHtml,
  'transition: opacity 170ms ease, transform 360ms cubic-bezier(0.2, 1.45, 0.35, 1)',
  'feedback popover should use the same opening motion as menu surfaces'
);

assert.match(
  newtabHtml,
  /@supports \(corner-shape: superellipse\(1\.25\)\)[\s\S]*?\.x-nt-feedback-popover,[\s\S]*?corner-shape:\s*superellipse\(1\.25\);/,
  'feedback popover should use continuous superellipse corners when supported'
);

assertContains(
  newtabHtml,
  'width: 170px;',
  'collapsed feedback popover should exactly fit four 34px icons, three 6px gaps, and 8px side padding'
);

assertContains(
  newtabHtml,
  'height: 54px;',
  'collapsed feedback popover should reserve vertical breathing room so feedback icons are not clipped'
);

assertContains(
  newtabHtml,
  'padding: 10px 8px;',
  'collapsed feedback popover should keep horizontal sizing while adding vertical breathing room'
);

assertContains(
  newtabHtml,
  'contain: layout;',
  'collapsed feedback popover should not use paint containment because it clips icon rings and shadows'
);

assertContains(
  newtabHtml,
  'overflow: visible;',
  'collapsed feedback popover should allow icon rings and shadows to paint beyond the action row'
);

assert.match(
  newtabHtml,
  /\.x-nt-feedback-control\[data-detail-open="true"\] \.x-nt-feedback-popover \{[\s\S]*?overflow: hidden;/,
  'expanded feedback detail should keep clipping for the QR panel while the collapsed action row can paint freely'
);

assert.match(
  newtabHtml,
  /\.x-nt-feedback-action \{[\s\S]*?position: relative;[\s\S]*?overflow: visible;[\s\S]*?background: transparent;[\s\S]*?border: 0;/,
  'feedback action buttons should let the visual circle paint outside the 34px hit target'
);

assert.match(
  newtabHtml,
  /\.x-nt-feedback-action::before \{[\s\S]*?inset: -1px;[\s\S]*?background: linear-gradient\(180deg, #ffffff 0%, #ecedef 100%\);/,
  'feedback action visual circles should be drawn by an outward pseudo-element to avoid hard-clipped edges'
);

assert.match(
  newtabHtml,
  /\.x-nt-feedback-action-community::before \{\s*background: [^;]+;\s*box-shadow:\s*0 0 0 1px #12161f,/,
  'feedback community action ring should extend past the button box instead of being inset at the edge'
);

assertContains(
  newtabHtml,
  '0 0 0 1px #12161f,',
  'feedback community action should draw the near-black ring outside the circle face'
);

assert.ok(
  !newtabHtml.includes('inset 0 0 0 1px #12161f'),
  'feedback community action should not draw the ring as an inset edge that looks clipped'
);

assertContains(
  newtabHtml,
  'inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 1px 3px rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.22)',
  'feedback community action should share the subtle primary sheen with the primary buttons'
);

assert.ok(
  !newtabHtml.includes('0 0 0 1px #040404') &&
    !newtabHtml.includes('inset 0 1px 0 rgba(255, 255, 255, 0.52)') &&
    !newtabHtml.includes('inset 0 1px 2.4px rgba(255, 255, 255, 0.36)'),
  'feedback community action should not keep the old black ring or stronger highlight'
);

assertContains(
  newtabHtml,
  'width 260ms cubic-bezier(0.22, 1, 0.36, 1), height 260ms cubic-bezier(0.22, 1, 0.36, 1)',
  'feedback popover size animation should use a non-bouncy resize easing'
);

assert.ok(
  !newtabHtml.includes('width 360ms cubic-bezier(0.2, 1.45, 0.35, 1)') &&
    !newtabHtml.includes('min-height 360ms cubic-bezier(0.2, 1.45, 0.35, 1)'),
  'feedback popover should not apply the bouncy menu transform curve to layout dimensions'
);

assertContains(
  newtabHtml,
  '.x-nt-feedback-control[data-detail-open="true"] .x-nt-feedback-menu',
  'wechat detail state should target the menu row'
);

assertContains(
  newtabHtml,
  'visibility: hidden;',
  'wechat detail state should hide the four feedback icons'
);

assert.ok(
  !newtabJs.includes('x-nt-feedback-detail-collapse') &&
    !newtabHtml.includes('x-nt-feedback-detail-collapse') &&
    !newtabJs.includes('ri-arrow-down-s-line'),
  'wechat detail should remove the former top-left collapse button'
);

assertContains(
  feedbackReact,
  'ri-icon ri-size-16 ri-refresh-line',
  'the React feedback detail should place a refresh icon in the header actions'
);

assertContains(
  feedbackReact,
  'ri-icon ri-size-16 ri-close-line',
  'the React feedback detail should place a close icon after the refresh icon'
);

assert.ok(
  feedbackReact.indexOf('ri-icon ri-size-16 ri-refresh-line') <
    feedbackReact.indexOf('ri-icon ri-size-16 ri-close-line'),
  'the React feedback detail should place refresh to the left of close'
);

assertContains(
  newtabHtml,
  '.x-nt-feedback-detail-actions {',
  'wechat detail should align its icon actions at the right side of the header'
);

assert.match(
  newtabHtml,
  /\.x-nt-feedback-detail-action \{[\s\S]*?width: 28px;[\s\S]*?background: transparent;/,
  'wechat detail header icons should use compact transparent hit targets'
);

assertContains(
  feedbackReact,
  "host.dataset.detailOpen = detailOpen ? 'true' : 'false';",
  'the React feedback view should reflect detail state on its host for animation and icon hiding'
);

assertContains(
  feedbackReact,
  'requestAnimationFrame(() => buttonRef.current?.focus());',
  'the React wechat detail close icon should close the popover and restore focus'
);

assertContains(
  newtabHtml,
  '<script src="../shared/community-links.js"></script>',
  'newtab should load the shared dynamic community links runtime'
);

assertContains(
  communityLinksJs,
  "chromeReview: 'https://chromewebstore.google.com/detail/lumno-%E8%81%9A%E7%84%A6%E6%90%9C%E7%B4%A2%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5/nggfkkbmogmadfoikakkfegkoilfcfao/reviews?utm_source=item-share-cb',",
  'the shared fallback should include the Chrome review URL'
);

assertContains(
  feedbackReact,
  'ri-icon ri-size-16 ri-star-line',
  'the React feedback popover should use a rating star icon for the Chrome review action'
);

assertContains(
  feedbackReact,
  'href={model.chromeReviewUrl}',
  'the React feedback popover should place the Chrome review action in the icon row'
);

assert.match(
  feedbackReact,
  /const getDisposition = \(event\?[\s\S]*?'backgroundTab'[\s\S]*?onOpenExternal\(model\.xUrl, disposition\)/,
  'opening the community on X should preserve background-opening modifiers'
);

assert.match(
  feedbackReact,
  /\{model\.channel === 'wechat' && \([\s\S]*?x-nt-feedback-action-community/,
  'outside Chinese the menu\'s X button is the community entry, so the community button is WeChat only'
);

assert.ok(
  !newtabJs.includes('feedbackMailButton') &&
    !newtabJs.includes('handleFeedbackMailClick') &&
    !newtabJs.includes('openFeedbackMailto') &&
    !newtabJs.includes('mailto:'),
  'feedback popover should remove the email action from the icon row'
);

assertContains(
  feedbackReact,
  'width="1080"',
  'the React wechat QR image should reserve its published width before loading'
);

assertContains(
  feedbackReact,
  'height="1596"',
  'the React wechat QR image should reserve its published height before loading'
);

assert.match(
  newtabJs,
  /async onRefreshQr\(\)[\s\S]*?loadFeedbackLinks\(\{ force: true \}\)/,
  'the feedback adapter should force a new remote community-links request'
);

assertContains(
  communityLinksJs,
  "url.searchParams.set(\n      '_lumno_refresh',",
  'wechat refresh should cache-bust a QR URL even when the server reuses the same path'
);

assert.match(
  newtabJs,
  /const loaded = await preloadFeedbackQrImage\(refreshedUrl\);[\s\S]*?qrUrl:\s*refreshedUrl/,
  'the feedback adapter should only return a fresh QR URL after its image loads'
);

assert.match(
  newtabJs,
  /t\(\s*'newtab_feedback_wechat_refresh_success',\s*'Latest QR code loaded'\s*\)/,
  'wechat refresh should show a success tooltip after the latest image loads'
);

assert.match(
  newtabJs,
  /t\(\s*'newtab_feedback_wechat_refresh_error',\s*'Could not refresh\. Try again\.'\s*\)/,
  'wechat refresh should show an error tooltip when the fresh image cannot be loaded'
);

assert.match(
  feedbackReact,
  /aria-label=\{model\.refreshTooltip\}[\s\S]*?x-lumno-busy-spin/,
  'the React wechat refresh icon should expose a localized accessible label'
);

assert.match(
  feedbackReact,
  /aria-label=\{model\.closeTooltip\}[\s\S]*?x-nt-feedback-detail-close/,
  'the React wechat close icon should expose a localized accessible label'
);

assert.match(
  newtabJs,
  /t\(\s*'newtab_feedback_wechat_panel_title',\s*'Bug reports & feature requests'\s*\)/,
  'wechat detail title should use the bug feedback and feature request copy'
);

assert.match(
  newtabHtml,
  /\.x-nt-feedback-detail-title \{[\s\S]*?font-size: 14px;/,
  'wechat detail title should be larger than the compact feedback labels'
);

assert.strictEqual(
  getMessage(zhCnMessages, 'newtab_feedback_wechat_panel_title'),
  'Bug 反馈 & 新功能提需',
  'zh-CN should label the expanded wechat panel as bug feedback and feature requests'
);
assert.strictEqual(
  getMessage(zhTwMessages, 'newtab_feedback_wechat_panel_title'),
  '問題回報與功能建議',
  'zh-TW should label the expanded wechat panel idiomatically'
);
assert.deepStrictEqual(
  [
    getMessage(zhTwMessages, 'newtab_feedback_wechat_label'),
    getMessage(zhTwMessages, 'newtab_feedback_wechat_tooltip'),
    getMessage(zhTwMessages, 'newtab_feedback_wechat_qr_title'),
    getMessage(zhTwMessages, 'newtab_feedback_wechat_qr_alt')
  ],
  [
    '微信群組',
    '加入 Lumno 微信群組',
    '微信群組 QR Code',
    'Lumno 微信群組 QR Code'
  ],
  'zh-TW should use clear, consistent WeChat group copy throughout the feedback UI'
);
assert.strictEqual(
  getMessage(enMessages, 'newtab_feedback_wechat_panel_title'),
  'Bug reports & feature requests',
  'en should label the expanded wechat panel clearly'
);
assert.strictEqual(
  getMessage(jaMessages, 'newtab_feedback_wechat_panel_title'),
  '不具合・要望',
  'ja should label the expanded wechat panel clearly'
);

[
  [
    zhCnMessages,
    {
      refresh: '刷新二维码',
      success: '已拉取最新二维码',
      error: '刷新失败，请稍后重试。',
      close: '关闭'
    },
    'zh-CN'
  ],
  [
    zhTwMessages,
    {
      refresh: '重新載入 QR Code',
      success: '已載入最新 QR Code',
      error: '無法更新 QR Code，請稍後再試。',
      close: '關閉'
    },
    'zh-TW'
  ],
  [
    enMessages,
    {
      refresh: 'Refresh QR code',
      success: 'Latest QR code loaded',
      error: "Couldn't refresh. Try again.",
      close: 'Close'
    },
    'en'
  ],
  [
    jaMessages,
    {
      refresh: 'QRコードを更新',
      success: '最新のQRコードを取得しました',
      error: '更新できませんでした。もう一度お試しください。',
      close: '閉じる'
    },
    'ja'
  ]
].forEach(([messages, expected, locale]) => {
  assert.strictEqual(
    getMessage(messages, 'newtab_feedback_wechat_refresh_tooltip'),
    expected.refresh,
    `${locale} should label the QR refresh icon`
  );
  assert.strictEqual(
    getMessage(messages, 'newtab_feedback_wechat_refresh_success'),
    expected.success,
    `${locale} should confirm a successful QR refresh`
  );
  assert.strictEqual(
    getMessage(messages, 'newtab_feedback_wechat_refresh_error'),
    expected.error,
    `${locale} should explain a failed QR refresh`
  );
  assert.strictEqual(
    getMessage(messages, 'newtab_feedback_wechat_close_tooltip'),
    expected.close,
    `${locale} should label the feedback close icon`
  );
});

[
  [zhCnMessages, 'zh-CN', '商店评分', '去扩展商店为 Lumno 评分'],
  [zhTwMessages, 'zh-TW', '商店評分', '到擴充功能商店為 Lumno 評分'],
  [enMessages, 'en', 'Store rating', 'Rate Lumno in the extension store'],
  [jaMessages, 'ja', 'ストアで評価', '拡張機能ストアで Lumno を評価する']
].forEach(([messages, locale, label, tooltip]) => {
  assert.strictEqual(
    getMessage(messages, 'newtab_feedback_chrome_review_label'),
    label,
    `${locale} should label the review action without naming one store`
  );
  assert.strictEqual(
    getMessage(messages, 'newtab_feedback_chrome_review_tooltip'),
    tooltip,
    `${locale} should explain the review action without naming one store`
  );
  assert(
    !/Chrome|Edge/.test(label + tooltip),
    `${locale} review copy should stay channel-neutral`
  );
});

console.log('newtab feedback popover tests passed');
