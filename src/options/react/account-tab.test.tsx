import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { AccountTab, type AccountTabModel } from './account-tab';
import { getElement, getTag } from '../../../tests/fakes/dom';

let roots: Root[] = [];

const model: AccountTabModel = {
  browserSync: {
    sectionTitle: '浏览器内置同步',
    title: 'Chrome 内置同步',
    status: { text: '自动同步已开启', tone: 'success', tooltip: '同步说明' },
    summary: '',
    available: true,
    syncing: false,
    syncNowTooltip: '手动同步',
    exportLabel: '导出配置',
    importLabel: '导入配置',
    syncNowLabel: '手动同步'
  },
  webdav: {
    title: 'WebDAV 同步',
    badge: 'Beta',
    info: '功能测试中',
    setupHint: '通过 WebDAV 服务同步',
    showSetupHint: true,
    notice: '',
    list: { connections: [], copy: { webdav_add: '添加 WebDAV' }, ready: true, outdated: false }
  }
};

function setUp() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const handlers = {
    browserSync: { onSyncNow: vi.fn(), onExport: vi.fn(), onImport: vi.fn() },
    webdav: { onAction: vi.fn().mockResolvedValue({}) }
  };
  const root = createRoot(host);
  roots.push(root);
  // Draws the tab again with a new model, as the page does.
  const controller = { render: (next: AccountTabModel) => root.render(<AccountTab handlers={handlers} model={next} />) };
  act(() => controller.render(model));
  return { host, handlers, controller };
}

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.textContent = '';
});

describe('Options Account tab', () => {
  it('draws the browser sync card above the WebDAV card', () => {
    const { host } = setUp();
    const sectionTitle = getElement(host, '._x_extension_section_header_2026_unique_');
    const syncTitle = getElement(host, '#lumno-browser-sync-title');
    const webdav = getElement(host, '#lumno-webdav-settings');
    expect(sectionTitle.textContent).toBe('浏览器内置同步');
    expect(syncTitle.textContent).toBe('Chrome 内置同步');
    expect(sectionTitle.compareDocumentPosition(syncTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(syncTitle.compareDocumentPosition(webdav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const status = getElement(host, '#_x_extension_sync_status_2024_unique_');
    expect(status.dataset.status).toBe('success');
    expect(status.dataset.tooltip).toBe('同步说明');
    expect(getElement(host, '#_x_extension_shortcut_sync_summary_2026_unique_').hidden).toBe(true);
    expect(getElement(host, '#lumno-webdav-setup-hint').hidden).toBe(false);
    expect(getElement(host, '#lumno-webdav-version').hidden).toBe(true);
    expect(getElement(host, '#lumno-webdav-beta-info ._x_extension_info_button_2026_unique_').dataset.tooltip).toBe('功能测试中');
    expect(getElement(host, '#lumno-webdav-list').textContent).toContain('添加 WebDAV');
  });

  it('labels the three sync buttons and runs their actions', () => {
    const { host, handlers } = setUp();
    const exportButton = getTag(host, '#_x_extension_sync_export_2024_unique_', 'button');
    const syncNow = getTag(host, '#_x_extension_sync_now_2024_unique_', 'button');
    expect(exportButton.textContent).toBe('导出配置');
    expect(getTag(host, '#_x_extension_sync_import_2024_unique_', 'button').textContent).toBe('导入配置');
    expect(syncNow.dataset.tooltip).toBe('手动同步');
    act(() => exportButton.click());
    act(() => syncNow.click());
    expect(handlers.browserSync.onExport).toHaveBeenCalledTimes(1);
    expect(handlers.browserSync.onSyncNow).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker from Import and hands over the chosen file', () => {
    const { host, handlers } = setUp();
    const input = getTag(host, '#_x_extension_sync_import_input_2024_unique_', 'input');
    expect(input.type).toBe('file');
    const picked = vi.spyOn(input, 'click');
    act(() => getTag(host, '#_x_extension_sync_import_2024_unique_', 'button').click());
    expect(picked).toHaveBeenCalledTimes(1);
    const file = new File(['{}'], 'settings.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(handlers.browserSync.onImport).toHaveBeenCalledWith(file);
  });

  it('turns the buttons off when sync is unavailable and marks a sync in progress', () => {
    const { host, controller } = setUp();
    act(() => controller.render({
      ...model,
      browserSync: { ...model.browserSync, available: false, status: { text: '同步不可用', tone: 'danger', tooltip: '检查' } }
    }));
    const exportButton = getTag(host, '#_x_extension_sync_export_2024_unique_', 'button');
    expect(exportButton.disabled).toBe(true);
    expect(exportButton.dataset.disabled).toBe('true');
    expect(getElement(host, '#_x_extension_sync_status_2024_unique_').dataset.status).toBe('danger');
    act(() => controller.render({ ...model, browserSync: { ...model.browserSync, syncing: true, summary: '快捷方式全部同步' } }));
    expect(getTag(host, '#_x_extension_sync_now_2024_unique_', 'button').getAttribute('aria-busy')).toBe('true');
    expect(getElement(host, '#_x_extension_shortcut_sync_summary_2026_unique_').textContent).toBe('快捷方式全部同步');
  });

  it('shows a WebDAV notice in place of the setup hint once connections exist', () => {
    const { host, controller } = setUp();
    act(() => controller.render({ ...model, webdav: { ...model.webdav, showSetupHint: false, notice: '请重新加载' } }));
    expect(getElement(host, '#lumno-webdav-setup-hint').hidden).toBe(true);
    const notice = getElement(host, '#lumno-webdav-version');
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('请重新加载');
  });
});
