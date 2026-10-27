// Search sources order on the Options page: the order of the search panel
// groups, the per-list moves of the provider and aggregate lists, and the
// browser content order on the result type checkboxes. All of them edit one
// synced record (search-source-order.ts); the page re-renders its chips and
// lists by following its store.

import * as ORDER from '../domain/search/search-source-order';
import type { SearchSourceOrder } from '../domain/search/search-source-order';
import { isElementNode, isHtmlElement, isHtmlTag } from '../shared/dom-guards';
import * as SORTABLE from '../shared/ui/sortable-drag';
import { createStore } from '../shared/state/store';
import type { GetMessage } from './options-types';

interface SearchSourceOrderConfig {
  getMessage?: GetMessage;
  showToast?(message: string, isError?: boolean): void;
  // The stored record, as storage holds it.
  read?(): unknown;
  write(value: SearchSourceOrder): unknown;
  // Runs after every change, so the page can re-sort its lists.
  onChange?(order: SearchSourceOrder): void;
  // The document whose undo and redo keys step through the moves.
  document?: Document | null;
}

type HistoryDirection = 'undo' | 'redo';

function createSearchSourceOrderController(options: SearchSourceOrderConfig) {
  const getMessage: GetMessage = options.getMessage || ((_key, fallback) => fallback);
  let order = ORDER.normalizeOrder(null);
  // The order as views follow it.
  const store = createStore({ order });
  let writeQueue: Promise<unknown> = Promise.resolve();
  const detachers: Array<() => void> = [];
  const history = ORDER.createHistory();

  function notify(): void {
    store.setState({ order });
    if (options.onChange) {
      options.onChange(order);
    }
  }

  function accept(value: unknown): void {
    order = ORDER.normalizeOrder(value);
    notify();
  }

  function load(): Promise<void> {
    return Promise.resolve(options.read ? options.read() : undefined)
      .then((value) => accept(value))
      .catch(() => notify());
  }

  function persist(next: SearchSourceOrder, persistOptions?: { record?: boolean }): Promise<unknown> {
    if (!persistOptions || persistOptions.record !== false) {
      history.record(order, next);
    }
    order = next;
    notify();
    writeQueue = writeQueue
      .then(() => options.write(next))
      .catch(() => {
        if (options.showToast) {
          options.showToast(getMessage('settings_search_source_order_failed', '排序保存失败，请重试。'), true);
        }
        // Show what storage really holds rather than an order that never landed.
        return load();
      });
    return writeQueue;
  }

  // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z step through this page's moves, one at a
  // time and as many times as there are moves to step through.
  function stepHistory(direction: HistoryDirection): boolean {
    const target = direction === 'redo' ? history.redo(order) : history.undo(order);
    if (!target) {
      return false;
    }
    persist(target, { record: false });
    if (options.showToast) {
      options.showToast(direction === 'redo'
        ? getMessage('settings_search_source_order_redone', '已恢复排序')
        : getMessage('settings_search_source_order_undone', '已撤销排序'));
    }
    return true;
  }

  // Text fields keep their own undo.
  function isTextEditingTarget(target: EventTarget | null): boolean {
    if (!isElementNode(target)) {
      return false;
    }
    if ((isHtmlElement(target) && target.isContentEditable) ||
        isHtmlTag(target, 'textarea') || isHtmlTag(target, 'select')) {
      return true;
    }
    return isHtmlTag(target, 'input') &&
      !['checkbox', 'radio', 'button', 'range'].includes(target.type.toLowerCase());
  }

  function handleHistoryKeydown(event: KeyboardEvent): void {
    const direction = ORDER.getHistoryShortcut(event);
    if (!direction || event.defaultPrevented || isTextEditingTarget(event.target)) {
      return;
    }
    if (!(direction === 'redo' ? history.canRedo() : history.canUndo())) {
      return;
    }
    event.preventDefault();
    stepHistory(direction);
  }

  const historyDocument = options.document || globalThis.document;
  if (historyDocument) {
    historyDocument.addEventListener('keydown', handleHistoryKeydown);
    detachers.push(() => historyDocument.removeEventListener('keydown', handleHistoryKeydown));
  }

  function sortList<T extends { key?: unknown } | null>(
    items: readonly T[],
    listId: string,
    getKey?: (item: T) => unknown
  ): T[] {
    return ORDER.sortList(items, order, listId, getKey);
  }

  // `renderedKeys` is the list as shown; keys the record holds but the page
  // does not show (a disabled built-in) keep their relative slot.
  function moveListItem(listId: string, renderedKeys: readonly string[], fromIndex: number, toIndex: number): Promise<unknown> {
    const moved = ORDER.moveIndex(renderedKeys, fromIndex, toIndex);
    return persist(ORDER.applyMove(order, listId, renderedKeys, moved));
  }

  function sortLocalSourceTypes(sourceTypes: readonly string[]): string[] {
    return ORDER.sortLocalSourceTypes(sourceTypes, order);
  }

  function moveLocal(renderedTypes: readonly string[], fromIndex: number, toIndex: number): Promise<unknown> {
    const moved = ORDER.moveIndex(renderedTypes, fromIndex, toIndex);
    return persist(ORDER.applyMove(order, 'local', renderedTypes, moved));
  }

  function isLocalDefault(): boolean {
    return ORDER.LOCAL_SOURCE_TYPES.every((type, index) => order.local[index] === type);
  }

  function resetLocal(): Promise<unknown> {
    if (isLocalDefault()) {
      return Promise.resolve();
    }
    return persist(ORDER.withLocal(order, ORDER.LOCAL_SOURCE_TYPES.slice()));
  }

  function moveGroup(fromIndex: number, toIndex: number): Promise<unknown> {
    return persist(ORDER.withGroups(order, ORDER.moveIndex(order.groups, fromIndex, toIndex)));
  }

  function getGroupLabel(group: string): string {
    if (group === 'aggregate') {
      return getMessage('search_scope_group_aggregates', '聚合搜索');
    }
    if (group === 'engine') {
      return getMessage('search_scope_group_engines', '搜索引擎');
    }
    if (group === 'site') {
      return getMessage('search_scope_group_sites', '站内搜索');
    }
    if (group === 'ai') {
      return getMessage('search_scope_group_ai', 'AI 搜索');
    }
    return getMessage('search_scope_group_local', '浏览器内容');
  }

  // Drag for one container. Rows reorder only among their own siblings, and
  // a list with an open editor stays put so heights cannot shift mid-drag.
  function attachDrag(
    host: HTMLElement | null,
    onReorder: (fromIndex: number, toIndex: number, peers: HTMLElement[]) => void
  ): () => void {
    if (!host) {
      return () => {};
    }
    const detach = SORTABLE.attach(host, {
      itemSelector: '[data-sortable="true"]',
      getPeers: (item) => (item.parentElement ? Array.from(item.parentElement.children) : [])
        .filter((child): child is HTMLElement => isHtmlElement(child) && child.getAttribute('data-sortable') === 'true'),
      canStart: (item) => !(item.parentElement && item.parentElement.querySelector('[data-expanded="true"]')),
      onReorder: (_item, fromIndex, toIndex, peers) => onReorder(fromIndex, toIndex, peers)
    });
    detachers.push(detach);
    return () => {
      const index = detachers.indexOf(detach);
      if (index >= 0) {
        detachers.splice(index, 1);
      }
      detach();
    };
  }

  // Each returns the function that takes its drag off again.
  function attachListDrag(host: HTMLElement | null, listId: string, getKey: (row: HTMLElement) => string): () => void {
    return attachDrag(host, (fromIndex, toIndex, peers) => {
      moveListItem(listId, peers.map(getKey), fromIndex, toIndex);
    });
  }

  function attachLocalDrag(host: HTMLElement | null): () => void {
    return attachDrag(host, (fromIndex, toIndex, peers) => {
      moveLocal(peers.map((peer) => peer.getAttribute('data-value') || ''), fromIndex, toIndex);
    });
  }

  function attachGroupDrag(host: HTMLElement | null): () => void {
    return attachDrag(host, (fromIndex, toIndex) => moveGroup(fromIndex, toIndex));
  }

  return Object.freeze({
    store,
    accept,
    attachGroupDrag,
    attachListDrag,
    attachLocalDrag,
    getGroupLabel,
    getOrder: (): SearchSourceOrder => order,
    isLocalDefault,
    load,
    moveGroup,
    moveListItem,
    moveLocal,
    redo: () => stepHistory('redo'),
    resetLocal,
    sortList,
    sortLocalSourceTypes,
    undo: () => stepHistory('undo'),
    destroy(): void {
      detachers.splice(0).forEach((detach) => detach());
    }
  });
}

export { createSearchSourceOrderController };
export type { SearchSourceOrderConfig };
