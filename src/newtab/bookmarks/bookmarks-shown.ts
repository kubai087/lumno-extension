// The bookmarks the section shows: the folder it browses (and the root of
// the bar), the path to it, the page shown, the root folder's items and
// counts, the pager's state, and what was last drawn. The section loaders,
// the pager and the folder navigation change it; the drag and layout parts
// read it.
import type { BookmarkItem, BookmarkPathEntry } from './bookmarks-store';
import { createViewStore } from '../../shared/react/view-store';
import type { BookmarkGridState, BookmarkItem as BookmarkCardItem } from '../react/bookmarks';

function getBookmarksSignature(items: BookmarkCardItem[]): string {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  return items.map((item, index) => {
    const id = item?.id ? String(item.id) : '';
    const type = item?.type ? String(item.type) : '';
    const title = item?.title ? String(item.title) : '';
    const url = item?.url ? String(item.url) : '';
    const themeUrl = item?.themeUrl ? String(item.themeUrl) : '';
    return `${index}::${id}::${type}::${title}::${url}::${themeUrl}`;
  }).join('\n');
}

interface PagerAvailability {
  previous: boolean;
  next: boolean;
}

class BookmarksShown {
  private folderId = '1';
  private rootId = '1';
  private path: BookmarkPathEntry[] = [];
  private page = 0;
  private items: BookmarkItem[] = [];
  private totalCount = 0;
  private visibleCount = 0;
  private animating = false;
  private availability: PagerAvailability = { previous: false, next: false };
  private drawnSignature = '';
  private loaded = false;
  // What the grid draws.
  readonly grid = createViewStore<BookmarkGridState>({ content: null });

  get currentFolderId(): string {
    return this.folderId;
  }

  get rootFolderId(): string {
    return this.rootId;
  }

  get folderPath(): BookmarkPathEntry[] {
    return this.path;
  }

  get currentPage(): number {
    return this.page;
  }

  get allItems(): BookmarkItem[] {
    return this.items;
  }

  // How many items the root folder holds, and how many fit on its first page.
  get rootTotalCount(): number {
    return this.totalCount;
  }

  get rootVisibleCount(): number {
    return this.visibleCount;
  }

  // Whether a page turn is sliding the cards.
  get pageAnimating(): boolean {
    return this.animating;
  }

  get pagerAvailability(): PagerAvailability {
    return this.availability;
  }

  get loadedOnce(): boolean {
    return this.loaded;
  }

  // Browses a folder from its first page, drawing every card afresh.
  openFolder(id: string): void {
    this.folderId = id;
    this.page = 0;
    this.drawnSignature = '';
  }

  // Where the folder navigation landed: the bar's root, the folder and the path to it.
  located(rootId: string, folderId: string, path: BookmarkPathEntry[]): void {
    this.rootId = rootId;
    this.folderId = folderId;
    this.path = path;
  }

  showPage(page: number): void {
    this.page = page;
  }

  setItems(items: BookmarkItem[]): void {
    this.items = items;
  }

  setRootCounts(total: number, visible: number): void {
    this.totalCount = total;
    this.visibleCount = visible;
  }

  // Shows nothing: no items, the first page, every card drawn afresh.
  clear(): void {
    this.items = [];
    this.totalCount = 0;
    this.visibleCount = 0;
    this.page = 0;
    this.drawnSignature = '';
    this.grid.setState({ content: null });
  }

  setPageAnimating(animating: boolean): void {
    this.animating = animating;
  }

  setPagerAvailability(availability: PagerAvailability): void {
    this.availability = availability;
  }

  // Draws the page's items, or an empty folder's note, unless they are what
  // is drawn; true when it drew.
  draw(items: BookmarkCardItem[], viewMode: string): boolean {
    const mode = viewMode === 'list' || viewMode === 'top' ? viewMode : 'folder';
    const isAtRoot = this.folderId === this.rootId;
    const signature = `${this.folderId}##${mode}##${getBookmarksSignature(items)}`;
    if (signature === this.drawnSignature) {
      if (items.length === 0 && !isAtRoot) {
        this.grid.setState({ content: { kind: 'empty' } });
      }
      return false;
    }
    this.drawnSignature = signature;
    this.grid.setState({
      content: items.length > 0
        ? { kind: 'cards', items: items.slice(), viewMode: mode, menuMode: mode !== 'folder' }
        : (isAtRoot ? null : { kind: 'empty' })
    });
    return true;
  }

  // The next draw redraws every card.
  forgetSignature(): void {
    this.drawnSignature = '';
  }

  markLoaded(): void {
    this.loaded = true;
  }
}

export { BookmarksShown };
