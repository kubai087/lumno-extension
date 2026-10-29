import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQuoteLineView, type QuoteLineModel, type QuoteLineState, type QuoteLineView } from './quote-line';
import { createViewStore } from '../../shared/react/view-store';
import { getTag } from '../../../tests/react/dom';

let views: QuoteLineView[] = [];

afterEach(() => {
  act(() => views.forEach((view) => view.destroy()));
  views = [];
  document.body.replaceChildren();
});

const MODEL: QuoteLineModel = {
  text: '海上生明月',
  href: 'https://hitokoto.cn/?uuid=1',
  ariaLabel: '海上生明月 — 张九龄',
  shuffleLabel: 'Show another quote',
  originTitle: '',
  shuffleTitle: '',
  shuffling: false,
  swapCount: 0
};

function mount(model: QuoteLineModel = MODEL) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const handlers = {
    onShowOrigin: vi.fn(),
    onShowShuffleLabel: vi.fn(),
    onHideTooltip: vi.fn(),
    onShuffle: vi.fn()
  };
  const store = createViewStore<QuoteLineState>({ model });
  const view = createQuoteLineView(host, handlers, store);
  views.push(view);
  return { host, handlers, view, store };
}

describe('New Tab quote line', () => {
  it('shows the quote as text in one link with the shuffle button beside it', () => {
    const { host, view } = mount({ ...MODEL, text: '<img src=x onerror=alert(1)>' });

    expect(host.querySelector('img')).toBeNull();
    const link = getTag(host, 'a.x-nt-quote-text', 'a');
    expect(link.href).toBe('https://hitokoto.cn/?uuid=1');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(host.querySelectorAll('a')).toHaveLength(1);
    expect(view.getTextElement()?.textContent).toBe('<img src=x onerror=alert(1)>');
    const shuffle = getTag(host, 'button.x-nt-quote-shuffle', 'button');
    expect(shuffle.closest('a')).toBeNull();
    expect(shuffle.getAttribute('aria-label')).toBe('Show another quote');
  });

  it('sets trailing full-width punctuation apart', () => {
    const { view } = mount({ ...MODEL, text: '海棠未雨，梨花先雪，一半春休。」' });

    expect(view.getTextElement()?.textContent).toBe('海棠未雨，梨花先雪，一半春休。」');
    expect(view.getTextElement()?.querySelector('.x-nt-quote-tail')?.textContent).toBe('。」');
  });

  it('leaves a quote from the custom collection unlinked', () => {
    const { host } = mount({ ...MODEL, href: null });

    const link = getTag(host, 'a.x-nt-quote-text', 'a');
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.tabIndex).toBe(-1);
  });

  it('reports hover and clicks to its runtime', () => {
    const { host, handlers } = mount();
    const link = getTag(host, 'a.x-nt-quote-text', 'a');
    const shuffle = getTag(host, 'button.x-nt-quote-shuffle', 'button');

    act(() => {
      link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    });
    expect(handlers.onShowOrigin).toHaveBeenCalledWith(link);
    act(() => {
      link.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    });
    expect(handlers.onHideTooltip).toHaveBeenCalledTimes(1);
    act(() => shuffle.click());
    expect(handlers.onShuffle).toHaveBeenCalledTimes(1);
  });

  it('marks a shuffle in progress and fades in each shuffled quote once', () => {
    const { host, view, store } = mount();
    const shuffle = getTag(host, 'button.x-nt-quote-shuffle', 'button');
    expect(view.getTextElement()?.dataset.swap).toBeUndefined();

    act(() => store.setState({ model: { ...MODEL, shuffling: true } }));
    expect(shuffle.dataset.loading).toBe('true');
    expect(shuffle.getAttribute('aria-busy')).toBe('true');

    act(() => store.setState({ model: { ...MODEL, text: '换一句', swapCount: 1 } }));
    expect(shuffle.dataset.loading).toBeUndefined();
    const line = view.getTextElement();
    expect(line?.dataset.swap).toBe('true');
    act(() => {
      line?.dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    expect(view.getTextElement()?.dataset.swap).toBeUndefined();
    act(() => store.setState({ model: { ...MODEL, text: '再换一句', swapCount: 2 } }));
    expect(view.getTextElement()?.dataset.swap).toBe('true');
  });
});
