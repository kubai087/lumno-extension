// Highlighting the query in titles and URLs, and the tooltip a truncated
// text shows.
import { useSyncExternalStore } from 'react';
import type { NormalizedOptions, Suggestion, QueryStore } from './types';
import { surfaceClass } from './surface-options';
import { isElementTextTruncated } from '../../text-overflow';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHighlightNeedles(query: string): string[] {
  const fullQuery = String(query || '').trim();
  if (!fullQuery) {
    return [];
  }
  const needles = [
    fullQuery,
    ...fullQuery.split(/[^\p{L}\p{M}\p{N}]+/u)
  ];
  const seen = new Set<string>();
  return needles
    .map((needle) => needle.trim())
    .filter((needle) => {
      const key = needle.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.length - left.length);
}

// A term of one or two letters or digits from a script that writes words
// apart and has letter case matches only where a word starts ("ai" in
// OpenAI, not in "detail"; "да" not inside "когда"), so it is only marked
// there. The same rule as the search matcher.
const SHORT_WORD_TERM_PATTERN = /^[\p{sc=Latn}\p{sc=Cyrl}\p{sc=Grek}\p{sc=Armn}\p{sc=Geor}\d]{1,2}$/u;

function isHighlightWordStart(text: string, index: number): boolean {
  const previous = text.charAt(index - 1);
  const current = text.charAt(index);
  return !/[\p{L}\p{N}]/u.test(previous) ||
    /\d/.test(previous) !== /\d/.test(current) ||
    (/\p{Ll}/u.test(previous) && /\p{Lu}/u.test(current));
}

// The background marks a local result's title by the rules that matched it,
// pinyin and initials included. Its ranges only fit the text and query they
// were computed for; anywhere else, and while a newer query waits for
// results, the view marks the typed text.
export function getHighlightedParts(
  options: NormalizedOptions,
  text: unknown,
  query: string,
  highlight?: Suggestion['titleHighlight']
): Array<{ text: string; highlighted: boolean }> {
  const safeText = options.sanitizeDisplayText(text);
  let ranges: Array<[number, number]> = [];
  if (
    highlight?.text === safeText &&
    highlight.query === query.trim().toLowerCase()
  ) {
    ranges = highlight.ranges;
  } else {
    const needles = getHighlightNeedles(query);
    if (needles.length > 0) {
      const pattern = new RegExp(needles.map(escapeRegExp).join('|'), 'gi');
      for (const match of safeText.matchAll(pattern)) {
        const start = match.index || 0;
        if (!SHORT_WORD_TERM_PATTERN.test(match[0]) || isHighlightWordStart(safeText, start)) {
          ranges.push([start, start + match[0].length]);
        }
      }
    }
  }
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let offset = 0;
  ranges.forEach(([start, end]) => {
    if (start >= offset) {
      parts.push(
        { text: safeText.slice(offset, start), highlighted: false },
        { text: safeText.slice(start, end), highlighted: true }
      );
      offset = end;
    }
  });
  parts.push({ text: safeText.slice(offset), highlighted: false });
  return parts.filter((part) => part.text);
}

export function HighlightedText({
  options,
  text,
  queryStore,
  simpleMode,
  highlight
}: {
  options: NormalizedOptions;
  text: unknown;
  queryStore: QueryStore;
  simpleMode: boolean;
  highlight?: Suggestion['titleHighlight'];
}) {
  const query = useSyncExternalStore(
    queryStore.subscribe,
    queryStore.getSnapshot,
    queryStore.getSnapshot
  );
  if (simpleMode) {
    return options.sanitizeDisplayText(text);
  }
  return getHighlightedParts(options, text, query, highlight).map((part, index) =>
    part.highlighted ? (
      <mark
        key={`highlight:${index}`}
        className={surfaceClass(options, 'x-nt-suggestion-mark')}
      >
        {part.text}
      </mark>
    ) : (
      part.text
    )
  );
}

function isOverflowing(target: HTMLElement | null): boolean {
  return isElementTextTruncated(target);
}

type TextTooltipOptions = Pick<
  NormalizedOptions,
  'bindCursorTooltip' | 'sanitizeDisplayText'
>;

// The hover target can be wider than the text it stands for: a whole row, whose
// padding and empty room are part of it, while the text's own line box is what
// gets clipped. `measure` is the element to measure for that.
export function bindTextTooltip(
  options: TextTooltipOptions,
  target: HTMLElement | null,
  text: unknown,
  measure: HTMLElement | null = target
): void {
  const safeText = options.sanitizeDisplayText(text);
  if (!options.bindCursorTooltip || !target || !safeText) {
    return;
  }
  options.bindCursorTooltip(target, () => safeText, {
    maxWidth: 520,
    shouldShow: () => isOverflowing(measure),
    deferHideVisibility: true,
    preserveVisibleOnTargetSwitch: true
  });
}
