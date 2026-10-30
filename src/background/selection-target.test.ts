import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GROUP_TITLE, findExistingSelectionGroup, openSelectionTarget, updateSelectionGroup } from './selection-target';
import type { SelectionTargetChromeApi, SelectionTargetResult } from './selection-target';
import { browserTab } from '../../tests/fakes/worker';

describe('selection target group', () => {
  it('falls back to the English group name, not a Chinese-only one', () => {
    expect(DEFAULT_GROUP_TITLE).toBe('AI Search');
  });

  it('looks for and names the group by the fallback when no title is set', () => {
    const query = vi.fn((_info: { title?: string; windowId?: number }, callback: (groups: chrome.tabGroups.TabGroup[]) => void) => callback([]));
    const update = vi.fn((_id: number, _properties: { title?: string }, callback: () => void) => callback());
    const api: SelectionTargetChromeApi = { tabGroups: { query, update }, runtime: { lastError: null } };

    findExistingSelectionGroup(api, 3, undefined);
    updateSelectionGroup(api, 7, {});

    expect(query).toHaveBeenCalledWith({ title: 'AI Search', windowId: 3 }, expect.any(Function));
    expect(update.mock.calls[0][1]).toMatchObject({ title: 'AI Search' });
  });
});

interface TargetStubOptions {
  existingGroup?: boolean;
  openTabs?: chrome.tabs.Tab[];
}

function createTargetStub(options: TargetStubOptions = {}) {
  const created: chrome.tabs.CreateProperties[] = [];
  const grouped: { tabIds: number; groupId?: number }[] = [];
  const queried: { windowId?: number }[] = [];
  const updated: Record<string, unknown>[] = [];
  let nextTabId = 100;
  const chromeApi: SelectionTargetChromeApi = {
    runtime: { lastError: null },
    tabGroups: {
      query(queryInfo, callback) {
        callback(options.existingGroup ? [{ id: 33, collapsed: false, color: 'grey', shared: false, windowId: 1, ...queryInfo }] : []);
      },
      update(groupId, properties, callback) {
        updated.push({ groupId, ...properties });
        callback();
      }
    },
    tabs: {
      query(queryInfo, callback) {
        queried.push({ ...queryInfo });
        callback((options.openTabs || []).map((tab) => ({ ...tab })));
      },
      create(properties, callback) {
        created.push({ ...properties });
        callback(browserTab({ id: nextTabId++, windowId: properties.windowId || 1, url: properties.url, active: properties.active }));
      },
      group(groupInfo, callback) {
        grouped.push({ ...groupInfo });
        callback(typeof groupInfo.groupId === 'number' ? groupInfo.groupId : 44);
      }
    }
  };
  let result: SelectionTargetResult | null = null;
  const open = (options: Parameters<typeof openSelectionTarget>[1]) => {
    openSelectionTarget(chromeApi, options, (answer) => {
      result = answer;
    });
    return result;
  };
  return { open, created, grouped, queried, updated };
}

describe('opening a selection target', () => {
  const chatGpt = 'https://chatgpt.com/';

  it('opens an active, ungrouped tab by default', () => {
    const stub = createTargetStub({ existingGroup: true });
    const result = stub.open({ url: chatGpt, sourceTab: browserTab({ id: 12, windowId: 9, groupId: 77 }) });

    expect(stub.created).toEqual([{ url: chatGpt, active: true, windowId: 9, openerTabId: 12 }]);
    expect(stub.grouped).toEqual([]);
    expect(result).toMatchObject({ mode: 'tab', groupId: null });
  });

  it('collects a background target into the localized AI group, not the source page group', () => {
    const stub = createTargetStub({ existingGroup: true });
    const result = stub.open({
      url: chatGpt, sourceTab: browserTab({ id: 12, windowId: 9, groupId: 77 }), groupEnabled: true, groupTitle: 'AI 検索'
    });

    expect(stub.grouped).toEqual([{ tabIds: 100, groupId: 33 }]);
    expect(stub.updated[0]).toEqual({ groupId: 33, title: 'AI 検索', color: 'blue', collapsed: true });
    expect(result).toMatchObject({ mode: 'group', groupId: 33 });
  });

  it("reuses an open page of the provider in the source window, but not a page that only names it", () => {
    const stub = createTargetStub({
      existingGroup: true,
      openTabs: [
        browserTab({ id: 64, windowId: 9, url: 'https://chatgpt.com/c/existing-conversation', status: 'complete', lastAccessed: 200 }),
        browserTab({ id: 65, windowId: 9, url: 'https://attacker.example/?next=https://chatgpt.com/', status: 'complete', lastAccessed: 300 })
      ]
    });
    const result = stub.open({ url: chatGpt, sourceTab: browserTab({ id: 7, windowId: 9 }), groupEnabled: true });

    expect(stub.queried[0]).toEqual({ windowId: 9 });
    expect(stub.created).toEqual([]);
    expect(stub.grouped).toEqual([{ tabIds: 64, groupId: 33 }]);
    expect(result).toMatchObject({ mode: 'reused', tab: { id: 64 } });
  });

  it('never reuses the page the selection came from', () => {
    const stub = createTargetStub({
      existingGroup: true,
      openTabs: [browserTab({ id: 7, windowId: 9, url: 'https://chatgpt.com/c/source-conversation', status: 'complete', active: true, lastAccessed: 400 })]
    });
    const result = stub.open({ url: chatGpt, sourceTab: browserTab({ id: 7, windowId: 9 }), groupEnabled: true });

    expect(stub.created).toEqual([{ url: chatGpt, active: false, windowId: 9, openerTabId: 7 }]);
    expect(stub.grouped).toEqual([{ tabIds: 100, groupId: 33 }]);
    expect(result).toMatchObject({ mode: 'group', tab: { id: 100 } });
  });

  it('names the AI group in English without a title', () => {
    const stub = createTargetStub({ existingGroup: true });
    const result = stub.open({ url: chatGpt, sourceTab: browserTab({ id: 7, windowId: 9 }), groupEnabled: true });

    expect(stub.created).toEqual([{ url: chatGpt, active: false, windowId: 9, openerTabId: 7 }]);
    expect(stub.grouped).toEqual([{ tabIds: 100, groupId: 33 }]);
    expect(stub.updated[0]).toEqual({ groupId: 33, title: 'AI Search', color: 'blue', collapsed: true });
    expect(result).toMatchObject({ mode: 'group', groupId: 33 });
  });

  it('starts a new AI group when there is none', () => {
    const stub = createTargetStub();
    const result = stub.open({ url: 'https://gemini.google.com/app', sourceTab: browserTab({ id: 8, windowId: 2 }), groupEnabled: true });

    expect(stub.grouped).toEqual([{ tabIds: 100 }]);
    expect(result).toMatchObject({ mode: 'group', groupId: 44 });
  });
});
