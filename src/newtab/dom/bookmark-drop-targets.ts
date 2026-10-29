// What a bookmark drag points at on the page: a breadcrumb, folder shortcut
// or folder card it would drop into, and whether it is over the open folder
// menu; and whether a press started on a card's copy button.
import { isElementNode, isHtmlElement, isHtmlTag } from '../../shared/dom-guards';
import type { FolderDropTarget } from '../cross-surface-drag';
import type { BookmarkCardElement } from '../react/bookmarks';
import { getBookmarkCardId } from './bookmark-cards';

function getBookmarkElementDropTarget(pointerX: number, pointerY: number): FolderDropTarget | null {
  const element = document.elementFromPoint(pointerX, pointerY);
  if (!element) {
    return null;
  }
  const breadcrumbTarget = element.closest('[data-bookmark-drop-folder-id]');
  if (isHtmlElement(breadcrumbTarget) && !breadcrumbTarget.classList.contains('x-nt-bookmark-card')) {
    return {
      folderId: breadcrumbTarget.getAttribute('data-bookmark-drop-folder-id') || '',
      title: breadcrumbTarget.getAttribute('data-bookmark-drop-folder-title') || '',
      element: breadcrumbTarget,
      kind: breadcrumbTarget.classList.contains('x-nt-shortcut-tile') ? 'shortcut-folder' : 'breadcrumb'
    };
  }
  const folderCardElement = element.closest('.x-nt-bookmark-card--folder[data-bookmark-id]');
  const folderCard: BookmarkCardElement | null = isHtmlTag(folderCardElement, 'div') ? folderCardElement : null;
  if (!folderCard) {
    return null;
  }
  const item = folderCard._xBookmarkItem || null;
  return {
    folderId: getBookmarkCardId(folderCard),
    title: String((item && item.title) || folderCard._xTitleText || ''),
    element: folderCard,
    kind: 'card'
  };
}

function isBookmarkCascadeSurfaceAtPoint(pointerX: number, pointerY: number): boolean {
  const element = document.elementFromPoint(pointerX, pointerY);
  return Boolean(element && element.closest('.x-nt-bookmark-cascade-menu'));
}

function isBookmarkCopyAction(target: EventTarget | null): boolean {
  return isElementNode(target) && Boolean(target.closest('.x-nt-bookmark-copy-action'));
}

export { getBookmarkElementDropTarget, isBookmarkCascadeSurfaceAtPoint, isBookmarkCopyAction };
