// Bookmark cards and folder menu rows keep still under the pointer while a
// bookmark or a shortcut is dragged over them.
import type { DragSessions } from '../drag-sessions';

function isBookmarkHoverSuppressed(
  sessions: Pick<DragSessions, 'bookmark' | 'shortcutDragging'>,
  target: Element | null | undefined
): boolean {
  return Boolean(
    target &&
    (sessions.bookmark || sessions.shortcutDragging) &&
    (target.classList.contains('x-nt-bookmark-card') ||
      target.closest('.x-nt-bookmark-card, .x-nt-bookmark-cascade-item'))
  );
}

export { isBookmarkHoverSuppressed };
