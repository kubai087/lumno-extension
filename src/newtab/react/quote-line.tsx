// The daily quote's line on the New Tab page: the quote as a link to its
// Hitokoto page, and a shuffle button revealed on hover. The quote runtime
// (newtab/top-content/quotes.ts) owns the line's host element and where it
// sits on the page, and hands this view a model.
import { useState } from 'react';
import { getPagePortals } from '../app/portals';
import { queryHtmlElement } from '../../shared/dom-lookup';
import { RemixIcon } from '../../shared/react/remix-icon';

export interface QuoteLineModel {
  text: string;
  // The quote's Hitokoto page; null for a quote from the custom collection.
  href: string | null;
  // The quote with its author and source, for assistive technology.
  ariaLabel: string;
  shuffleLabel: string;
  // Native titles, for a page without the shared tooltip.
  originTitle: string;
  shuffleTitle: string;
  shuffling: boolean;
  // Counts shuffles, so each new quote fades in.
  swapCount: number;
}

export interface QuoteLineHandlers {
  onShowOrigin(target: HTMLElement): void;
  onShowShuffleLabel(target: HTMLElement): void;
  onHideTooltip(): void;
  onShuffle(): void;
}

// Full-width closing punctuation leaves half an em of blank space after its
// ink, which reads as a lopsided gap at the end of the line, so the trailing
// run is set apart to render half-width.
const TRAILING_PUNCTUATION = /[、。，．：；！？）〉》」』】〕〗”’]+$/;

function QuoteText({ text, swapCount }: { text: string; swapCount: number }) {
  // The fade plays once per shuffle; a re-render of the same quote keeps it still.
  const [settledSwap, setSettledSwap] = useState(0);
  const tail = TRAILING_PUNCTUATION.exec(text);
  return (
    // The inline line box marks where the glyphs actually sit, so wallpaper
    // tone sampling stays local to the text.
    <span
      className="x-nt-quote-line"
      data-swap={swapCount > settledSwap ? 'true' : undefined}
      onAnimationEnd={() => setSettledSwap(swapCount)}
    >
      {tail ? (
        <>
          {text.slice(0, tail.index)}
          <span className="x-nt-quote-tail">{tail[0]}</span>
        </>
      ) : text}
    </span>
  );
}

function QuoteLine({ model, handlers }: { model: QuoteLineModel; handlers: QuoteLineHandlers }) {
  const showOrigin = (event: { currentTarget: HTMLElement }) => handlers.onShowOrigin(event.currentTarget);
  const showShuffleLabel = (event: { currentTarget: HTMLElement }) => handlers.onShowShuffleLabel(event.currentTarget);
  return (
    <div className="x-nt-quote-row">
      {/* The whole line opens the quote's page; its origin lives in the tooltip. */}
      <a
        aria-label={model.ariaLabel || undefined}
        className="x-nt-quote-text"
        href={model.href || undefined}
        onBlur={handlers.onHideTooltip}
        onClick={handlers.onHideTooltip}
        onFocus={showOrigin}
        onMouseEnter={showOrigin}
        onMouseLeave={handlers.onHideTooltip}
        rel="noopener noreferrer"
        tabIndex={model.href ? undefined : -1}
        target="_blank"
        title={model.originTitle || undefined}
      >
        <QuoteText swapCount={model.swapCount} text={model.text} />
      </a>
      {/* It hangs past the line's end so the quote stays centered. */}
      <button
        aria-busy={model.shuffling ? 'true' : undefined}
        aria-label={model.shuffleLabel}
        className="x-nt-quote-shuffle"
        data-loading={model.shuffling ? 'true' : undefined}
        onBlur={handlers.onHideTooltip}
        onClick={handlers.onShuffle}
        onFocus={showShuffleLabel}
        onMouseEnter={showShuffleLabel}
        onMouseLeave={handlers.onHideTooltip}
        title={model.shuffleTitle || undefined}
        type="button"
      >
        <RemixIcon name="ri-shuffle-line" size={16} />
      </button>
    </div>
  );
}

export interface QuoteLineView {
  render(model: QuoteLineModel): void;
  // The line's text box, where the wallpaper tone is sampled.
  getTextElement(): HTMLElement | null;
  destroy(): void;
}

export function createQuoteLineView(host: HTMLElement, handlers: QuoteLineHandlers): QuoteLineView {
  return {
    render: (model) => getPagePortals().show(host, <QuoteLine handlers={handlers} model={model} />),
    getTextElement: () => queryHtmlElement(host, '.x-nt-quote-line'),
    destroy: () => getPagePortals().remove(host)
  };
}
