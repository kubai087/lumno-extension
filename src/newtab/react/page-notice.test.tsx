import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPageNotice } from './page-notice';
import { queryHtmlTag } from '../../shared/dom-lookup';
import { required } from '../../../tests/react/dom';

afterEach(() => {
  document.body.replaceChildren();
});

describe('New Tab React page notice', () => {
  it('renders, opens details, and dismisses through the adapter contract', () => {
    const openExtensionDetailsPage = vi.fn();
    const onClose = vi.fn();
    const rendered: { controller: ReturnType<typeof renderPageNotice> } = { controller: null };
    act(() => {
      rendered.controller = renderPageNotice({
        document,
        messages: {
          getRiSvg: (icon: string) => `<i data-icon="${icon}"></i>`,
          t: (_key: string, fallback: string) => fallback
        },
        onClose,
        openExtensionDetailsPage,
        params: new URLSearchParams('notice=file-access'),
        windowObj: window
      });
    });
    const noticeController = required(rendered.controller, 'page notice controller');
    expect(noticeController.element.dataset.reactIsland).toBe(
      'newtab-page-notice'
    );
    act(() => {
      queryHtmlTag(noticeController.element, '.x-nt-page-notice-primary', 'button')
        ?.click();
    });
    expect(openExtensionDetailsPage).toHaveBeenCalledTimes(1);
    act(() => {
      queryHtmlTag(noticeController.element, '.x-nt-page-notice-close', 'button')
        ?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(noticeController.element.isConnected).toBe(false);
  });

  it('does not render without the file access query', () => {
    expect(
      renderPageNotice({
        document,
        params: new URLSearchParams()
      })
    ).toBeNull();
  });
});
