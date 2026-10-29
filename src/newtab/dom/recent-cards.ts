// The recent site cards in their grid, in the order they are drawn.
import { queryHtmlTags } from '../../shared/dom-lookup';

function getRecentCards(grid: HTMLElement): HTMLDivElement[] {
  return queryHtmlTags(grid, '.x-nt-recent-card', 'div');
}

export { getRecentCards };
