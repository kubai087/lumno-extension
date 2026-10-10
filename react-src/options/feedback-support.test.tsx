import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFeedbackSupportApi,
  createFeedbackSupportController,
  type FeedbackSupportController,
  type FeedbackSupportRenderModel
} from './feedback-support';

let controllers: FeedbackSupportController[] = [];

const model: FeedbackSupportRenderModel = {
  heading: '反馈与支持',
  headingKey: 'settings_feedback_support_section_title',
  items: [
    {
      href: 'https://example.com/qrcode.JPG',
      iconClass: 'ri-wechat-line',
      key: 'community',
      label: '加入反馈群',
      labelKey: 'settings_feedback_support_wechat_action'
    },
    {
      href: 'https://chromewebstore.google.com/example/reviews',
      iconClass: 'ri-star-line',
      key: 'chrome-review',
      label: '为 Lumno 评分',
      labelKey: 'settings_feedback_support_review_action'
    },
    {
      href: 'https://github.com/example/issues/new',
      iconClass: 'ri-github-line',
      key: 'github-issue',
      label: '创建 Issue',
      labelKey: 'settings_feedback_support_github_issue_action'
    },
    {
      href: 'https://x.com/example',
      iconClass: 'ri-twitter-x-line',
      key: 'contact-author',
      label: '联系作者',
      labelKey: 'settings_feedback_support_contact_author_action'
    }
  ]
};

function createFixture() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const controller = createFeedbackSupportController(host);
  controllers.push(controller);
  return { controller, host };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
});

describe('Options feedback support React island', () => {
  it('renders four compact icon, text, and external-link entries', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(createFeedbackSupportApi().implementation).toBe('react');
    expect(host.dataset.reactIsland).toBe('options-feedback-support');
    expect(host.querySelectorAll('a')).toHaveLength(4);
    expect(host.querySelectorAll('a > span')).toHaveLength(4);
    expect(host.querySelectorAll('.ri-external-link-line')).toHaveLength(4);
    expect(host.querySelectorAll('a > i:first-child')).toHaveLength(4);
    expect(host.querySelectorAll('a > i')).toHaveLength(8);
  });

  it('uses secure external anchors and preserves the provided destinations', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    const community = host.querySelector<HTMLAnchorElement>(
      '[data-feedback-support="community"]'
    );
    expect(community?.href).toBe('https://example.com/qrcode.JPG');
    expect(community?.target).toBe('_blank');
    expect(community?.rel).toContain('noopener');
  });

  it('updates the localized community entry in place', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));
    act(() => controller.render({
      ...model,
      heading: 'Feedback & Support',
      items: model.items.map((item) => item.key === 'community'
        ? {
            ...item,
            href: 'https://example.com/qr-v2.webp',
            label: '加入反馈群（新）',
            labelKey: 'settings_feedback_support_wechat_action'
          }
        : item)
    }));

    expect(host.querySelector('h2')?.textContent).toBe('Feedback & Support');
    expect(host.querySelector('[data-feedback-support="community"]')?.textContent)
      .toContain('加入反馈群（新）');
  });
});
