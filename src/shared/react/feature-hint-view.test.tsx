import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFeatureHintView,
  type FeatureHintViewController
} from './feature-hint-view';
import { queryHtmlTag } from '../dom-lookup';
import { required } from '../../../tests/react/dom';
import { getTestPortals } from '../../../tests/react/portals';

let controllers: FeatureHintViewController[] = [];

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  document.body.replaceChildren();
});

describe('Feature hint React view', () => {
  it('owns the hint structure, labels, and actions', () => {
    const onDismiss = vi.fn();
    const onLinkClick = vi.fn();
    const onActionClick = vi.fn();
    const created: { controller: FeatureHintViewController | null } = { controller: null };
    act(() => {
      created.controller = createFeatureHintView({
        portals: getTestPortals(),
        labels: {
          actions: {
            community: 'Join community',
            review: 'Rate Lumno'
          },
          badge: 'New',
          close: 'Dismiss',
          link: 'Details',
          text: 'A new feature'
        },
        model: {
          actions: [
            {
              icon: { name: 'ri-star-line' },
              id: 'review',
              variant: 'primary'
            },
            {
              id: 'community',
              variant: 'secondary'
            }
          ],
          alignMode: 'auto',
          arrowAlign: 'center',
          arrowSide: 'top',
          badgeIcon: { name: 'ri-asterisk' },
          className: 'feature-placement',
          dismissStorage: 'sync',
          elementId: 'hint',
          hasLink: true,
          hintId: 'feature',
          roundedArrowTip: true,
          textId: 'hint-text',
          widthMode: 'content'
        },
        onDismiss,
        onLinkClick,
        onActionClick
      });
    });
    const view = required(created.controller, 'feature hint controller');
    controllers.push(view);
    document.body.appendChild(view.element);

    expect(view.element.dataset.reactIsland).toBe('feature-hint');
    expect(view.element.classList.contains('feature-placement')).toBe(true);
    expect(view.arrowTip?.getAttribute('aria-hidden')).toBe('true');
    expect(view.text.textContent).toBe('A new feature');
    expect(view.linkButton?.textContent).toContain('Details');
    expect(view.actionButtons).toHaveLength(2);
    expect(view.actionButtons[0].textContent).toContain('Rate Lumno');
    expect(view.actionButtons[0].dataset.variant).toBe('primary');

    act(() => view.linkButton?.click());
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    act(() => view.actionButtons[1].click());
    expect(onActionClick).toHaveBeenCalledWith(
      'community',
      expect.any(MouseEvent)
    );
    act(() => view.closeButton.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      view.updateLabels({
        actions: {
          community: 'Community',
          review: 'Review'
        },
        badge: 'Updated',
        close: 'Close',
        link: 'Read',
        text: 'Updated copy'
      });
    });
    expect(view.text.textContent).toBe('Updated copy');
    expect(view.badge.getAttribute('aria-label')).toBe('Updated');
    expect(view.closeButton.getAttribute('aria-label')).toBe('Close');
    expect(view.actionButtons[0].textContent).toContain('Review');
  });

  it('renders the Lumno brand and actions as one sentence', () => {
    const created: { controller: FeatureHintViewController | null } = { controller: null };
    act(() => {
      created.controller = createFeatureHintView({
        portals: getTestPortals(),
        labels: {
          actions: {
            community: '进群',
            review: '满分好评'
          },
          badge: 'Lumno',
          close: '关闭',
          connector: '，或者',
          text: '如果用得开心，诚邀',
          trailing: '和我们聊聊。'
        },
        model: {
          actions: [
            {
              icon: { name: 'ri-external-link-line', size: 12 },
              id: 'review',
              variant: 'primary'
            },
            {
              icon: { name: 'ri-external-link-line', size: 12 },
              id: 'community',
              variant: 'secondary'
            }
          ],
          alignMode: 'auto',
          arrowAlign: 'center',
          arrowSide: 'top',
          badgeIconImageSrc: '/lumno.png',
          badgeWordmarkDarkImageSrc: '/lumno-wordmark-dark.svg',
          badgeWordmarkImageSrc: '/lumno-wordmark.svg',
          className: 'x-lumno-feature-hint--engagement-notice',
          dismissStorage: 'none',
          elementId: 'engagement-hint',
          hasLink: false,
          hintId: 'engagement',
          inlineActions: true,
          roundedArrowTip: false,
          textId: 'engagement-copy',
          widthMode: 'container'
        }
      });
    });
    const view = required(created.controller, 'feature hint controller');
    controllers.push(view);
    document.body.appendChild(view.element);

    expect(view.badge.dataset.brand).toBe('lumno');
    expect(
      queryHtmlTag(view.badge, '.x-lumno-feature-hint__brand-icon img', 'img')?.getAttribute('src')
    ).toBe('/lumno.png');
    expect(
      view.element.querySelector('.x-lumno-feature-hint__sentence')?.textContent
    ).toBe(
      '如果用得开心，诚邀满分好评，或者进群和我们聊聊。'
    );
    expect(view.element.querySelector('.x-lumno-feature-hint__actions')).toBeNull();
    expect(view.actionButtons).toHaveLength(2);
    expect(
      view.element.querySelectorAll(
        '.x-lumno-feature-hint__action-icon .ri-external-link-line'
      )
    ).toHaveLength(2);
  });
});
