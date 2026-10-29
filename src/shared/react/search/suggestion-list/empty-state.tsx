// The empty state, and the captions for help center groups.
import { useLayoutEffect, useRef } from 'react';
import type { NormalizedOptions, Suggestion } from './types';
import { surfaceClass } from './surface-options';
import {
  followEmptyStateArtIn,
  type EmptyStateArtName
} from '../../../ui/empty-state-art';
import { EmptyStateArt } from '../../empty-state-art';

const EMPTY_ART_SIZE = 120;

export function EmptyState({
  options,
  message,
  art
}: {
  options: NormalizedOptions;
  message: string;
  art?: EmptyStateArtName;
}) {
  // Kept while the list stays empty, so typing on does not redraw (and
  // replay) the illustration; its theme follows the panel it sits on.
  const artName = art || 'noResults';
  const artRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    return followEmptyStateArtIn(artRef.current);
  }, [artName]);
  return (
    <div
      className={surfaceClass(options, 'x-nt-empty-state')}
      data-theme={
        options.surface === 'overlay'
          ? options.container
              .closest('[data-theme]')
              ?.getAttribute('data-theme') || undefined
          : undefined
      }
    >
      <span
        ref={artRef}
        className={surfaceClass(
          options,
          'x-nt-empty-state__art'
        )}
      >
        <EmptyStateArt name={artName} size={EMPTY_ART_SIZE} />
      </span>
      <span
        className={surfaceClass(
          options,
          'x-nt-empty-state__text'
        )}
      >
        {options.sanitizeDisplayText(message)}
      </span>
    </div>
  );
}

// Help center pages that only loosely match the query sit under a "recommended reading"
// caption; when nothing matches, the ways to ask instead sit under their own.
function getHelpGroupCaption(
  suggestion: Suggestion | undefined
): [string, string] | null {
  if (suggestion && suggestion.type === 'helpArticle' && suggestion.recommended) {
    return ['help_center_recommended', '推荐阅读'];
  }
  if (suggestion && suggestion.type === 'helpFeedback') {
    return ['help_center_no_results', '没有找到相关内容，欢迎与开发者联系'];
  }
  return null;
}

export function getHelpGroupCaptionStart(
  suggestions: Suggestion[],
  index: number
): [string, string] | null {
  const caption = getHelpGroupCaption(suggestions[index]);
  const previous = getHelpGroupCaption(suggestions[index - 1]);
  return caption && (!previous || previous[0] !== caption[0]) ? caption : null;
}
