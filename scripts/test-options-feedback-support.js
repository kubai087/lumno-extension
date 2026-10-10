const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');

const repoRoot = path.resolve(__dirname, '..');
const optionsHtml = readPageSource('src/options/options.html');
const optionsJs = fs.readFileSync(
  path.join(repoRoot, 'src/options/options.js'),
  'utf8'
);
const communityLinksJs = fs.readFileSync(
  path.join(repoRoot, 'src/shared/community-links.js'),
  'utf8'
);
const feedbackReact = fs.readFileSync(
  path.join(repoRoot, 'react-src/options/feedback-support.tsx'),
  'utf8'
);
const locales = ['zh_CN', 'zh_TW', 'ja', 'en'];

const feedbackHostIndex = optionsHtml.indexOf(
  'id="_x_extension_feedback_support_2026_unique_"'
);
const globalSettingsIndex = optionsHtml.indexOf(
  'data-i18n="settings_global_section_title"'
);

assert.notStrictEqual(
  feedbackHostIndex,
  -1,
  'general settings should include the feedback support React host'
);
assert.ok(
  feedbackHostIndex < globalSettingsIndex,
  'feedback support should appear above global settings'
);
assert.match(
  optionsHtml,
  /_x_extension_feedback_support_section_2026_unique_[\s\S]*?flex-direction: column[\s\S]*?_x_extension_feedback_support_links_2026_unique_[\s\S]*?display: grid[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/,
  'feedback support should lay the four links out as equal-width tiles below the heading'
);
assert.match(
  feedbackReact,
  /<a[\s\S]*?href=\{item\.href\}[\s\S]*?target="_blank"/,
  'feedback entries should render as direct external links'
);
assert.match(
  feedbackReact,
  /item\.iconClass[\s\S]*?<span data-i18n=\{item\.labelKey\}>\{item\.label\}<\/span>[\s\S]*?ri-size-14 ri-external-link-line/,
  'every feedback entry should keep its channel icon in the compact tutorial-link pattern'
);
[
  'community',
  'chrome-review',
  'github-issue',
  'contact-author'
].reduce((previousIndex, key) => {
  const index = optionsJs.indexOf(`key: '${key}'`);
  assert.ok(index > previousIndex, `${key} should appear in the requested order`);
  return index;
}, -1);

assert.match(
  optionsHtml,
  /<script src="\.\.\/shared\/community-links\.js"><\/script>/,
  'Options should load the shared remote community links runtime'
);
assert.match(
  communityLinksJs,
  /'zh-CN': 'wechat',[\s\S]*?'zh-TW': 'wechat',[\s\S]*?ja: 'x',[\s\S]*?en: 'x'/,
  'Options should use WeChat for both Chinese locales and X for other languages'
);
assert.match(
  optionsJs,
  /COMMUNITY_LINKS\.load\(\)[\s\S]*?feedbackSupportLinks = links/,
  'Options should consume the same shared dynamic loader as other surfaces'
);
assert.match(
  optionsJs,
  /\.\.\.\(communityIsWechat\s*\? \[\{\s*href: links\.wechatQr,\s*iconClass: 'ri-wechat-line',\s*key: 'community',[\s\S]*?labelKey: 'settings_feedback_support_wechat_action'\s*\}\]\s*: \[\]\)/,
  'the WeChat group is the community entry in Chinese; elsewhere the contact-the-author X link is'
);
assert.doesNotMatch(optionsJs, /links\.discord|ri-discord-fill|settings_feedback_support_discord_action/);

locales.forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(
    path.join(repoRoot, `_locales/${locale}/messages.json`),
    'utf8'
  ));
  assert.ok(
    messages.settings_feedback_support_section_title &&
      messages.settings_feedback_support_section_title.message,
    `${locale} should localize the feedback support heading`
  );
  [
    'settings_feedback_support_wechat_action',
    'settings_feedback_support_review_action',
    'settings_feedback_support_github_issue_action',
    'settings_feedback_support_contact_author_action'
  ].forEach((key) => {
    assert.ok(messages[key] && messages[key].message, `${locale} should provide ${key}`);
  });
});

const zhCnMessages = JSON.parse(fs.readFileSync(
  path.join(repoRoot, '_locales/zh_CN/messages.json'),
  'utf8'
));
assert.deepStrictEqual(
  [
    'settings_feedback_support_wechat_action',
    'settings_feedback_support_review_action',
    'settings_feedback_support_github_issue_action',
    'settings_feedback_support_contact_author_action'
  ].map((key) => zhCnMessages[key].message),
  [
    '加入反馈群',
    '为 Lumno 评分',
    '创建 Issue',
    '联系作者'
  ],
  'Simplified Chinese feedback links should use the requested copy'
);
locales.forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(path.join(repoRoot, `_locales/${locale}/messages.json`), 'utf8'));
  assert.ok(!messages.settings_feedback_support_discord_action, `${locale} should no longer carry Discord copy`);
});

console.log('options feedback support tests passed');
