import { describe, expect, it } from 'vitest';
import enMessages from '../../../_locales/en/messages.json';
import jaMessages from '../../../_locales/ja/messages.json';
import zhCnMessages from '../../../_locales/zh_CN/messages.json';
import zhTwMessages from '../../../_locales/zh_TW/messages.json';

// The Options copy each written language ships.

type Messages = Record<string, { message: string } | undefined>;

const LOCALES: Array<[string, Messages]> = [
  ['zh_CN', zhCnMessages],
  ['zh_TW', zhTwMessages],
  ['ja', jaMessages],
  ['en', enMessages]
];

const FEEDBACK_ACTIONS = [
  'settings_feedback_support_wechat_action',
  'settings_feedback_support_review_action',
  'settings_feedback_support_github_issue_action',
  'settings_feedback_support_licenses_action',
  'settings_feedback_support_contact_author_action'
];

describe('Options copy', () => {
  it.each(LOCALES)('names the feedback section, its channels, the guide and the version tooltip in %s', (_locale, messages) => {
    ['settings_feedback_support_section_title', ...FEEDBACK_ACTIONS, 'settings_onboarding_tutorial_action', 'settings_version_tooltip']
      .forEach((key) => {
        expect(messages[key]?.message, key).toBeTruthy();
      });
  });

  it.each(LOCALES)('places the ask-in-the-search-box words inside the Help Center description in %s', (_locale, messages) => {
    expect(messages.settings_help_center_desc_with_ask?.message).toContain('{ask}');
  });

  it('words the feedback channels in Simplified Chinese as asked', () => {
    const messages: Messages = zhCnMessages;
    expect(FEEDBACK_ACTIONS.map((key) => messages[key]?.message)).toEqual(['加入反馈群', '为 Lumno 评分', '创建 Issue', '开源许可', '联系作者']);
  });
});
