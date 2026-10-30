import { describe, expect, it } from 'vitest';
import type { CreatedTabInfo, TabGroupChromeApi } from './tab-groups';
import { createTabInSourceGroup, getSourceTabGroupContext } from './tab-groups';
import { browserTab } from '../../tests/fakes/worker';

function createTabsStub(groupError = '') {
  const created: chrome.tabs.CreateProperties[] = [];
  const grouped: { tabIds: number; groupId: number }[] = [];
  let nextTabId = 100;
  const chromeApi: TabGroupChromeApi = {
    runtime: { lastError: null },
    tabGroups: { TAB_GROUP_ID_NONE: -1 },
    tabs: {
      create(properties, callback) {
        created.push({ ...properties });
        callback(browserTab({
          id: nextTabId++, windowId: properties.windowId ?? 1, pinned: properties.pinned === true, url: properties.url || ''
        }));
      },
      group(options, callback) {
        grouped.push({ ...options });
        if (groupError && chromeApi.runtime) {
          chromeApi.runtime.lastError = { message: groupError };
          callback();
          chromeApi.runtime.lastError = null;
          return;
        }
        callback();
      }
    }
  };
  return { chromeApi, created, grouped };
}

const sourceTab = { id: 10, windowId: 3, groupId: 42 };

describe('opening a tab in its source tab group', () => {
  it('creates the tab in the source window and adds it to the source group', () => {
    const stub = createTabsStub();
    let createdTab: chrome.tabs.Tab | null = null;
    let createdInfo: CreatedTabInfo | null = null;
    createTabInSourceGroup(stub.chromeApi, { url: 'https://example.com/', active: true }, sourceTab, (tab, info) => {
      createdTab = tab;
      createdInfo = info;
    });

    expect(stub.created).toEqual([{ url: 'https://example.com/', active: true, windowId: 3 }]);
    expect(createdTab).toMatchObject({ id: 100 });
    expect(stub.grouped).toEqual([{ tabIds: 100, groupId: 42 }]);
    expect(createdInfo).toMatchObject({ ok: true, grouped: true });
  });

  it('reports a tab it could not group as created, with the reason', () => {
    const stub = createTabsStub('cannot group pinned tab');
    let createdInfo: CreatedTabInfo | null = null;
    createTabInSourceGroup(stub.chromeApi, { url: 'https://example.com/' }, sourceTab, (_tab, info) => {
      createdInfo = info;
    });

    expect(stub.grouped).toHaveLength(1);
    expect(createdInfo).toMatchObject({ ok: true, grouped: false, groupReason: 'cannot group pinned tab' });
  });

  it('leaves a pinned tab out of the group but keeps it in the source window', () => {
    const stub = createTabsStub();
    createTabInSourceGroup(stub.chromeApi, { url: 'https://example.com/', pinned: true }, sourceTab, () => {});

    expect(stub.created[0].windowId).toBe(3);
    expect(stub.grouped).toEqual([]);
  });

  it('has no group context for an ungrouped source tab', () => {
    expect(getSourceTabGroupContext({ id: 1, windowId: 2, groupId: -1 }, { tabGroups: { TAB_GROUP_ID_NONE: -1 } })).toBeNull();
  });
});
