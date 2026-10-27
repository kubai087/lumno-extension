// The "Feedback & support" section on the General tab: the Help Center
// card (whose description offers the "ask in the search box" demo while the
// lm site search is on) and the community, review, GitHub and contact links.
// It also points the open-source licenses link in the Global settings header
// at the current URL. Links come from the shared remote community-links
// file, with its bundled fallback first.

import type { CommunityLinks } from '../domain/community-links';
import type * as CommunityLinksApi from '../platform/community-links';
import type { GetMessage } from './options-types';
import type { FeedbackSupportRenderModel } from './react/feedback-support';

type FeedbackCommunityLinks = Pick<typeof CommunityLinksApi,
  'getCommunityChannel' | 'getHelpUrl' | 'getReviewUrl'>;

interface FeedbackSupportModelInput {
  communityLinks: Pick<FeedbackCommunityLinks, 'getCommunityChannel' | 'getHelpUrl' | 'getReviewUrl'>;
  getMessage: GetMessage;
  links: Readonly<CommunityLinks>;
  webLocale: string;
  helpCenterSearchEnabled: boolean;
  helpIconUrl?: string;
}

// Options locale (zh_CN, zh_TW, ja, other) -> the website's locale.
function getFeedbackSupportWebLocale(locale: string): string {
  if (locale === 'zh_CN') {
    return 'zh-CN';
  }
  if (locale === 'zh_TW') {
    return 'zh-TW';
  }
  return locale === 'ja' ? 'ja' : 'en';
}

function buildFeedbackSupportModel(input: FeedbackSupportModelInput): FeedbackSupportRenderModel {
  const { communityLinks, getMessage, links, webLocale } = input;
  const communityIsWechat = communityLinks.getCommunityChannel(links, webLocale) === 'wechat';
  return {
    heading: getMessage('settings_feedback_support_section_title', '反馈与支持'),
    headingKey: 'settings_feedback_support_section_title',
    help: {
      ask: input.helpCenterSearchEnabled !== true ? null : {
        caption: getMessage('settings_help_center_ask_caption', '在新标签页或命令栏输入 lm 或「帮助中心」，按 Tab，再写下你的问题。'),
        captionKey: 'settings_help_center_ask_caption',
        descriptionTemplate: getMessage('settings_help_center_desc_with_ask', '每个功能的用法和常见问题都在这里，也可以{ask}。'),
        iconUrl: input.helpIconUrl || '',
        label: getMessage('settings_help_center_ask_action', '在搜索框里直接提问'),
        labelKey: 'settings_help_center_ask_action',
        prefix: 'lm',
        providerName: getMessage('site_search_name_lumno_help', 'Lumno 帮助中心'),
        query: getMessage('settings_help_center_ask_demo_query', '怎么修改快捷键'),
        results: [
          {
            detail: getMessage('settings_help_center_ask_demo_result_1_detail', '修改快捷键'),
            title: getMessage('settings_help_center_ask_demo_result_1_title', '快捷键')
          },
          {
            detail: getMessage('settings_help_center_ask_demo_result_2_detail', '快捷键没反应怎么办？'),
            title: getMessage('settings_help_center_ask_demo_result_2_title', '常见问题')
          }
        ]
      },
      description: getMessage('settings_help_center_desc', '每个功能的用法和常见问题都在这里。'),
      descriptionKey: 'settings_help_center_desc',
      href: communityLinks.getHelpUrl(webLocale),
      label: getMessage('settings_help_center_action', '访问帮助中心'),
      labelKey: 'settings_help_center_action',
      title: getMessage('settings_help_center_title', '帮助中心'),
      titleKey: 'settings_help_center_title'
    },
    // Chinese readers get the WeChat group, as a card beside the Help Center; elsewhere
    // "contact the author" (X) below is the community entry.
    cards: communityIsWechat && links.wechatQr
      ? [{
          href: links.wechatQr,
          iconName: 'ri-wechat-line' as const,
          key: 'community',
          label: getMessage('settings_feedback_support_wechat_action', '加入反馈群'),
          labelKey: 'settings_feedback_support_wechat_action',
          qr: {
            alt: getMessage('newtab_feedback_wechat_qr_alt', 'Lumno 微信群二维码'),
            closeLabel: getMessage('newtab_feedback_wechat_close_tooltip', '关闭'),
            imageUrl: links.wechatQr,
            title: getMessage('newtab_feedback_wechat_panel_title', 'Bug 反馈 & 新功能提需')
          }
        }]
      : [],
    items: [
      {
        href: communityLinks.getReviewUrl(links),
        iconName: 'ri-star-line' as const,
        key: 'chrome-review',
        label: getMessage('settings_feedback_support_review_action', '为 Lumno 评分'),
        labelKey: 'settings_feedback_support_review_action'
      },
      {
        href: links.githubIssue,
        iconName: 'ri-github-line' as const,
        key: 'github-issue',
        label: getMessage('settings_feedback_support_github_issue_action', '创建 Issue'),
        labelKey: 'settings_feedback_support_github_issue_action'
      },
      {
        href: links.x,
        iconName: 'ri-twitter-x-line' as const,
        key: 'contact-author',
        label: getMessage('settings_feedback_support_contact_author_action', '联系作者'),
        labelKey: 'settings_feedback_support_contact_author_action'
      }
    ].filter((item) => Boolean(item.href))
  };
}

export { buildFeedbackSupportModel, getFeedbackSupportWebLocale };
export type { FeedbackSupportModelInput };
