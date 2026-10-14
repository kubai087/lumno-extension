import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebDavListApi, type WebDavListModel } from './webdav-list';
import messages from '../../_locales/en/messages.json';

const copy = Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.message]));
const item = { id: 'a', config: { endpoint: 'https://dav.test/', directory: 'lumno', username: 'user', hasPassword: true },
  enabled: false, state: 'paused', lastSyncAt: 1790899200000 };
const model: WebDavListModel = { copy, lang: 'en', ready: true, outdated: false, connections: [item, { ...item, id: 'b' }] };
const controllers: ReturnType<ReturnType<typeof createWebDavListApi>['createWebDavListController']>[] = [];
function fixture(value = model) {
  const host = document.createElement('div');
  document.body.append(host);
  const onAction = vi.fn().mockResolvedValue({});
  const controller = createWebDavListApi().createWebDavListController(host, { onAction });
  controllers.push(controller);
  act(() => controller.render(value));
  const card = (id: string) => host.querySelector<HTMLElement>(`[data-webdav-id="${id}"]`)!;
  return { host, onAction, controller, card };
}
const click = async (element: Element | null) => {
  await act(async () => { (element as HTMLElement)?.click(); await Promise.resolve(); });
};
const type = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
afterEach(() => {
  act(() => controllers.splice(0).forEach((controller) => controller.destroy()));
  document.body.textContent = '';
});

describe('WebDAV connection cards', () => {
  it('keeps saved details on collapsed cards and opens one editor at a time', async () => {
    const { card, host } = fixture();
    expect(card('a').dataset.expanded).toBe('false');
    expect(card('a').textContent).toContain('user · /lumno');
    expect(card('a').textContent).not.toContain('https://dav.test/');
    await click(card('a').querySelector('button[aria-label="Edit connection"]'));
    expect(card('a').dataset.expanded).toBe('true');
    expect(card('a').querySelector('[name="password"]')).toBeNull();
    expect(card('a').querySelector('.lumno-webdav-password-saved')?.textContent).toContain(copy.webdav_password_saved);
    await click(card('b').querySelector('button[aria-label="Edit connection"]'));
    expect(card('a').dataset.expanded).toBe('false');
    expect(card('b').dataset.expanded).toBe('true');
    expect(host.querySelectorAll('form:not([inert])')).toHaveLength(1);
    expect(card('a').querySelector('form')?.hasAttribute('inert')).toBe(true);
  });
  it('keeps the editor mounted so it can animate, and resets it on reopening', async () => {
    const { card } = fixture();
    const form = card('a').querySelector('form')!;
    expect(form.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).not.toBe(form.querySelector('[name="endpoint"]'));
    await click(card('a').querySelector('button[aria-label="Edit connection"]'));
    expect(card('a').querySelector('form')).toBe(form);
    expect(form.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(form.querySelector('[name="endpoint"]'));
    await type(form.querySelector<HTMLInputElement>('[name="username"]')!, 'other');
    await click(card('a').querySelector('button[aria-label="Edit connection"]'));
    await click(card('a').querySelector('button[aria-label="Edit connection"]'));
    expect(form.querySelector<HTMLInputElement>('[name="username"]')!.value).toBe('user');
  });
  it('replaces a saved password only on request and can go back to keeping it', async () => {
    const { card, onAction } = fixture();
    await click(card('a').querySelector('button[aria-label="Edit connection"]'));
    await click(card('a').querySelector('.lumno-webdav-password-change'));
    const input = card('a').querySelector<HTMLInputElement>('[name="password"]')!;
    expect(input.required).toBe(true);
    expect(input.autocomplete).toBe('current-password');
    expect(document.activeElement).toBe(input);
    await type(input, 'secret');
    await click(card('a').querySelector(`button[aria-label="${copy.webdav_password_show}"]`));
    expect(input.type).toBe('text');
    await click(card('a').querySelector(`button[aria-label="${copy.webdav_password_keep}"]`));
    expect(card('a').querySelector('[name="password"]')).toBeNull();
    expect(document.activeElement).toBe(card('a').querySelector('.lumno-webdav-password-change'));
    await act(async () => { card('a').querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onAction).toHaveBeenCalledWith('save', 'a', { config: { endpoint: 'https://dav.test/', directory: 'lumno', username: 'user', password: '' }, resume: true });
  });
  it('asks for the password again once the account changes', async () => {
    const { card } = fixture();
    await click(card('a').querySelector('button[aria-label="Edit connection"]'));
    await type(card('a').querySelector<HTMLInputElement>('[name="username"]')!, 'other');
    expect(card('a').querySelector<HTMLInputElement>('[name="password"]')?.required).toBe(true);
    expect(card('a').querySelector(`button[aria-label="${copy.webdav_password_keep}"]`)).toBeNull();
  });
  it('saves only the edited connection, clears password inputs and collapses', async () => {
    const { card, onAction } = fixture();
    await click(card('a').querySelector('button[aria-label="Edit connection"]'));
    await act(async () => { card('a').querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onAction).toHaveBeenCalledWith('save', 'a', { config: { endpoint: 'https://dav.test/', directory: 'lumno', username: 'user', password: '' }, resume: true });
    expect(card('a').dataset.expanded).toBe('false');
    expect(card('b').dataset.expanded).toBe('false');
  });
  it('uses the existing inline confirmation and removes only the selected card', async () => {
    const { card, onAction } = fixture();
    await click(card('b').querySelector('button[aria-label="Delete WebDAV connection"]'));
    expect(card('b').querySelector('[role="dialog"]')?.textContent).toContain('Files on the server will be kept');
    expect(onAction).not.toHaveBeenCalled();
    await click(card('b').querySelector('[data-i18n="confirm_ok"]'));
    expect(onAction).toHaveBeenCalledWith('remove', 'b', {});
  });
  it('allows independent operations and reports a failure on its own card', async () => {
    const { card, onAction } = fixture();
    let release: (value: object) => void = () => {};
    onAction.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; })).mockRejectedValueOnce(new Error('Connection unavailable'));
    await click(card('a').querySelector('input[type="checkbox"]'));
    await click(card('b').querySelector('input[type="checkbox"]'));
    expect(onAction).toHaveBeenCalledWith('enable', 'a', {});
    expect(onAction).toHaveBeenCalledWith('enable', 'b', {});
    expect(card('b').textContent).toContain('Connection unavailable');
    expect(card('a').textContent).not.toContain('Connection unavailable');
    await act(async () => { release({}); });
  });
  it('adds through an empty accordion and returns to empty after deletion', async () => {
    const { host, controller } = fixture({ ...model, connections: [] });
    expect(host.querySelector('[data-webdav-id]')).toBeNull();
    const add = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Add WebDAV'))!;
    await click(add);
    expect(host.querySelector<HTMLInputElement>('[name="password"]')?.required).toBe(true);
    const cancel = [...host.querySelectorAll('button')].find((button) => button.textContent === copy.confirm_cancel)!;
    await click(cancel);
    expect(add.getAttribute('aria-expanded')).toBe('false');
    act(() => controller.render(model));
    act(() => controller.render({ ...model, connections: [] }));
    expect(host.querySelector('[data-webdav-id]')).toBeNull();
    expect(host.textContent).toContain('Add WebDAV');
  });
  it('routes choices per connection and keeps remote-missing data protected', async () => {
    const { card, onAction } = fixture({ ...model, connections: [{ ...item, state: 'choice', remoteMissing: true }, { ...item, id: 'b', state: 'conflict', enabled: true }] });
    const buttons = [...card('a').querySelectorAll('button')];
    expect(buttons.find((button) => button.textContent === copy.webdav_use_remote)).toBeUndefined();
    await click(buttons.find((button) => button.textContent === copy.webdav_upload_local)!);
    expect(onAction).toHaveBeenCalledWith('enable', 'a', { decision: 'local' });
    await click([...card('b').querySelectorAll('button')].find((button) => button.textContent === copy.webdav_use_remote)!);
    expect(onAction).toHaveBeenCalledWith('sync', 'b', { decision: 'remote' });
    expect(card('b').querySelector('[role="status"]')?.getAttribute('data-status')).toBe('warning');
    const compact = '._x_extension_shortcut_compact_2026_unique_';
    expect([...card('b').querySelectorAll('.lumno-webdav-actions button')].every((button) => button.matches(compact))).toBe(true);
  });
  it('offers merging wallpapers only on a first join with a server copy', async () => {
    const { card, onAction } = fixture({ ...model, connections: [{ ...item, state: 'choice' },
      { ...item, id: 'b', state: 'conflict', enabled: true }, { ...item, id: 'c', state: 'choice', remoteMissing: true }] });
    const merge = (id: string) => [...card(id).querySelectorAll('button')].find((button) => button.textContent === copy.webdav_merge_wallpapers);
    expect(merge('b')).toBeUndefined();
    expect(merge('c')).toBeUndefined();
    await click(merge('a')!);
    expect(onAction).toHaveBeenCalledWith('enable', 'a', { decision: 'merge' });
  });
  it('loads conflict differences on demand and shows both sides', async () => {
    const { card, onAction } = fixture({ ...model, connections: [{ ...item, enabled: true, state: 'conflict', conflictsText: 'Shortcuts and icons' }] });
    onAction.mockResolvedValueOnce({ items: [
      { key: 'shortcuts', label: 'Shortcuts and icons', domain: 'shortcuts',
        local: { total: 3, added: { names: ['Figma'], count: 1 }, removed: { names: [], count: 0 }, changed: { names: [], count: 0 }, reordered: false },
        remote: { total: 2, added: { names: [], count: 0 }, removed: { names: [], count: 0 }, changed: { names: [], count: 0 }, reordered: false } },
      { key: 'simple', label: 'Simple mode', domain: 'preference', local: { kind: 'boolean', value: true }, remote: { kind: 'unset' } }
    ] });
    const toggle = [...card('a').querySelectorAll('button')].find((button) => button.textContent?.includes(copy.webdav_view_diff))!;
    await click(toggle);
    expect(onAction).toHaveBeenCalledWith('conflictDetails', 'a');
    const table = card('a').querySelector('[role="table"]')!;
    expect(table.textContent).toContain('Added: Figma');
    expect(table.textContent).toContain(copy.webdav_diff_unchanged);
    expect(table.textContent).toContain(copy.webdav_value_on);
    expect(table.textContent).toContain(copy.webdav_value_default);
    await click([...card('a').querySelectorAll('button')].find((button) => button.textContent?.includes(copy.webdav_hide_diff))!);
    expect(card('a').querySelector('[role="table"]')).toBeNull();
  });
  it('shows one status pill per card and offers sync only while running', () => {
    const now = Date.now();
    const { card } = fixture({ ...model, connections: [
      { ...item, id: 'new', lastSyncAt: null },
      { ...item, id: 'paused' },
      { ...item, id: 'ready', enabled: true, state: 'ready', lastSyncAt: now - 3 * 60 * 1000 },
      { ...item, id: 'fresh', enabled: true, state: 'ready', lastSyncAt: now - 5 * 1000 },
      { ...item, id: 'failed', enabled: true, state: 'error', errorText: 'Sign-in failed', diagnosticText: 'dav-lock-5 / move-race / 201,201' }
    ] });
    const pill = (id: string) => card(id).querySelector<HTMLElement>('._x_extension_sync_status_2024_unique_')!;
    expect(pill('new').textContent).toBe(copy.webdav_state_browser);
    expect(pill('paused').textContent).toBe(copy.webdav_state_paused);
    expect(pill('ready').dataset.status).toBe('success');
    expect(pill('ready').textContent).toContain('3 minutes ago');
    expect(pill('fresh').textContent).toBe(`${copy.webdav_state_ready} · ${copy.webdav_just_now}`);
    expect(pill('failed').dataset.status).toBe('danger');
    expect(card('paused').querySelector(`button[aria-label="${copy.webdav_sync}"]`)).toBeNull();
    expect(card('ready').querySelector(`button[aria-label="${copy.webdav_sync}"]`)).not.toBeNull();
    expect(card('failed').textContent).toContain('Sign-in failed');
    expect(card('failed').textContent).not.toContain('move-race');
    expect([...card('failed').querySelectorAll('button')].some((button) => button.textContent?.includes(copy.webdav_copy_diagnostic))).toBe(true);
  });
  it('retries a failed connection from its notice', async () => {
    const { card, onAction } = fixture({ ...model, connections: [{ ...item, enabled: true, state: 'error', errorText: 'Offline' }] });
    await click([...card('a').querySelectorAll('button')].find((button) => button.textContent?.includes(copy.webdav_retry))!);
    expect(onAction).toHaveBeenCalledWith('sync', 'a', {});
  });
  it('adds and enables in one step from a plain form', async () => {
    const { host, onAction } = fixture({ ...model, lang: 'zh-CN', connections: [] });
    await click([...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Add WebDAV'))!);
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    const endpoint = host.querySelector<HTMLInputElement>('[name="endpoint"]')!;
    expect(endpoint.value).toBe('');
    expect(endpoint.placeholder).toBe('https://dav.jianguoyun.com/dav/');
    await type(endpoint, 'https://dav.jianguoyun.com/dav/');
    expect(host.querySelector('form a')).toBeNull();
    expect(host.querySelector('form')?.textContent).not.toContain(copy.webdav_credentials_hint);
    expect([...host.querySelectorAll('button')].find((button) => button.textContent?.includes(copy.webdav_test))
      ?.matches('._x_extension_shortcut_ghost_2026_unique_')).toBe(true);
    expect(host.querySelector('button[type="submit"]')?.textContent).toBe(copy.webdav_enable);
    await act(async () => { host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onAction).toHaveBeenCalledWith('add', undefined, { config: { endpoint: 'https://dav.jianguoyun.com/dav/', directory: 'lumno', username: '', password: '' }, enable: true });
  });
  it('offers connections from other devices with only the password left to fill in', async () => {
    const synced = { endpoint: 'https://dav.jianguoyun.com/dav/', directory: 'notes', username: 'me@example.com' };
    const { host, onAction } = fixture({ ...model, connections: [], suggestions: [synced] });
    const suggestion = host.querySelector<HTMLElement>('.lumno-webdav-suggestion')!;
    expect(suggestion.textContent).toContain(copy.webdav_provider_jianguoyun);
    expect(suggestion.textContent).toContain('me@example.com · /notes');
    expect(suggestion.textContent).toContain(copy.webdav_suggestion_label);
    await click([...suggestion.querySelectorAll('button')].find((button) => button.textContent === copy.webdav_suggestion_add)!);
    const form = host.querySelector<HTMLFormElement>('.lumno-webdav-editor form')!;
    expect(form.hasAttribute('inert')).toBe(false);
    expect(form.querySelector<HTMLInputElement>('[name="endpoint"]')!.value).toBe(synced.endpoint);
    expect(form.querySelector<HTMLInputElement>('[name="directory"]')!.value).toBe('notes');
    expect(form.querySelector<HTMLInputElement>('[name="username"]')!.value).toBe('me@example.com');
    expect(form.querySelector<HTMLInputElement>('[name="password"]')!.value).toBe('');
    expect(document.activeElement).toBe(form.querySelector('[name="password"]'));
    expect(form.textContent).toContain(copy.webdav_password_hint_synced);
    await type(form.querySelector<HTMLInputElement>('[name="password"]')!, 'secret');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onAction).toHaveBeenCalledWith('add', undefined, { config: { ...synced, password: 'secret' }, enable: true });
  });
  it('dismisses a synced connection and keeps the plain add form generic', async () => {
    const synced = { endpoint: 'https://dav.test/', directory: 'lumno', username: 'user' };
    const { host, onAction } = fixture({ ...model, connections: [], suggestions: [synced] });
    await click([...host.querySelectorAll('.lumno-webdav-suggestion button')].find((button) => button.textContent === copy.webdav_suggestion_dismiss)!);
    expect(onAction).toHaveBeenCalledWith('dismissSuggestion', undefined, { config: synced });
    await click([...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Add WebDAV'))!);
    const form = host.querySelector<HTMLFormElement>('.lumno-webdav-editor form')!;
    expect(form.querySelector<HTMLInputElement>('[name="endpoint"]')!.value).toBe('');
    expect(form.textContent).toContain(copy.webdav_password_hint);
  });
  it('explains local-only credentials with a lock tooltip after the connection name', () => {
    const { card } = fixture();
    const lock = card('a').querySelector<HTMLElement>('.lumno-webdav-local-only')!;
    expect(lock.querySelector('.ri-lock-line')).not.toBeNull();
    expect(lock.dataset.tooltip).toBe(copy.webdav_credentials_hint);
    expect(lock.previousElementSibling?.classList.contains('lumno-webdav-name')).toBe(true);
  });
});
