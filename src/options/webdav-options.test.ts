import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '../../_locales/en/messages.json';
import type { StorageChangeListener, StorageItems } from '../domain/storage-port';
import { webdavStatus } from '../domain/settings/sync-state';
import type { WebDavCardModel } from './react/account-tab';
import { createController, type WebDavChromeApi } from './webdav-options';

const copy: Record<string, string> = Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.message]));
const getMessage = (key: string, fallback: string) => copy[key] || fallback;

interface Request {
  operation?: unknown;
  id?: unknown;
}

// Conflict summaries as the worker describes them.
const noNames = { names: [], count: 0 };
const unchangedList = { total: 0, added: noNames, removed: noNames, changed: noNames, reordered: false };
const unset = { kind: 'unset' };
const CONFLICT_ITEMS = [
  { key: 'shortcuts', domain: 'shortcuts', local: unchangedList, remote: unchangedList },
  { key: '_x_extension_simple_mode_enabled_2026_unique_', domain: 'preference', local: unset, remote: unset },
  { key: '_x_extension_search_blacklist_2026_unique_', domain: 'preference', local: unset, remote: unset },
  { key: '_x_extension_unknown_2026_unique_', domain: 'preference', local: unset, remote: unset },
  { key: '_x_extension_newtab_zen_mode_2026_unique_', domain: 'preference', local: unset, remote: unset },
  { key: '_x_extension_newtab_quote_prefs_2026_unique_', field: 'position', domain: 'preference',
    local: { kind: 'text', value: 'bottom' }, remote: { kind: 'text', value: 'input' } },
  { key: '_x_extension_bookmark_folder_color_refs_2026_unique_', field: 'aaaaaaaaaaaaaaaa', domain: 'preference',
    local: { kind: 'text', value: '#22C55E' }, remote: { kind: 'text', value: '#F59E0B' } },
  { key: '_x_extension_bookmark_topbar_surface_mode_2026_unique_', domain: 'preference',
    local: { kind: 'text', value: 'clear' }, remote: { kind: 'text', value: 'custom' } },
  { key: '_x_extension_bookmark_topbar_surface_color_dark_2026_unique_', domain: 'preference',
    local: { kind: 'text', value: '#000000' }, remote: { kind: 'text', value: '#445566' } }
];

const paused = {
  id: 'a', state: 'paused', enabled: false,
  config: { endpoint: 'https://dav.test/', directory: 'lumno', username: 'user', hasPassword: true }
};

function errorOf(value: unknown): Error & { diagnostic?: unknown } {
  if (!(value instanceof Error)) throw new Error('Expected the action to fail with an Error.');
  return value;
}

// The controller over a worker that reports `status` and answers each action.
function setUp() {
  const requests: Request[] = [];
  const listeners: StorageChangeListener[] = [];
  const status: { connections: object[]; clientRevision: string; syncRevision: string } = {
    connections: [], clientRevision: 'dav-lock-5', syncRevision: 'dav-multi-1'
  };
  const failures: Array<Record<string, unknown>> = [];
  const area = {
    get: (_keys: unknown, callback?: (items: StorageItems) => void) => callback?.({}),
    set: (_items: StorageItems, callback?: () => void) => callback?.()
  };
  const chromeApi: WebDavChromeApi = {
    runtime: {
      lastError: null,
      getManifest: () => ({ version: '9.9.9' }),
      sendMessage(request: Request, callback?: (response: unknown) => void) {
        requests.push(request);
        const answer = (response: unknown) => callback?.(response);
        if (request.operation === 'status') return answer({ ok: true, ...status });
        const failure = failures.shift();
        if (failure) return answer({ ok: false, ...failure });
        if (request.operation === 'conflictDetails') return answer({ ok: true, items: CONFLICT_ITEMS });
        return answer({ ok: true });
      }
    },
    storage: {
      sync: area,
      local: area,
      onChanged: {
        addListener: (listener: StorageChangeListener) => { listeners.push(listener); },
        removeListener: () => {}
      }
    }
  };
  let card: WebDavCardModel | null = null;
  const controller = createController({ chromeApi, getMessage, onRender: (model) => { card = model; } });
  const model = () => {
    if (!card) throw new Error('The WebDAV card was never drawn.');
    return card;
  };
  return {
    controller,
    requests,
    status,
    model,
    list: () => model().list,
    // The worker's next answer to an action other than status is this failure.
    failNext: (failure: Record<string, unknown>) => failures.push(failure),
    // The action's rejection, which must happen.
    rejection: async (operation: string, id?: string) => errorOf(await controller.onAction(operation, id).then(() => null, (cause: unknown) => cause)),
    storageChanged: (key: string) => listeners.forEach((listener) => listener({ [key]: {} }, 'local'))
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Options WebDAV card', () => {
  it('shows the empty card with its title, beta hint and setup hint', async () => {
    const page = setUp();
    await page.controller.refresh();
    expect(page.list()).toMatchObject({ ready: true, connections: [] });
    expect(page.model()).toMatchObject({ info: copy.webdav_beta_hint, title: copy.webdav_title, showSetupHint: true });
    expect(page.list().copy.webdav_add).toBe('Add WebDAV');
  });

  it('warns about an incomplete browser-sync backup only while the install is local-only', async () => {
    const page = setUp();
    page.status.connections = [
      { ...paused, id: 'backup', enabled: true, state: 'ready', localPrimary: true, chromeBackup: 'incomplete' },
      { ...paused, id: 'migrated', enabled: true, state: 'ready', localPrimary: false, chromeBackup: 'incomplete' }
    ];
    await page.controller.refresh();
    const [backup, migrated] = page.list().connections;
    expect(backup.warningText).toBe(copy.webdav_warning_chrome_backup);
    expect(backup.errorText).toBe('');
    expect(migrated.warningText).toBe('');
  });

  it('waits out a server refusing requests, naming the next try instead of a failure', async () => {
    const page = setUp();
    page.status.connections = [
      { ...paused, id: 'busy', enabled: true, state: 'pending', error: 'http-503', retryAt: Date.now() + 600000 },
      { ...paused, id: 'failed', enabled: true, state: 'error', error: 'http-503' }
    ];
    await page.controller.refresh();
    const [busy, failed] = page.list().connections;
    expect(busy.errorText).toBe('');
    expect(busy.warningText).toMatch(/HTTP 503.*try again automatically after \S/);
    expect(failed.warningText).toBe('');
    expect(failed.errorText).toBe(copy.webdav_error_unavailable);
  });

  it('lets the choice panel alone explain a missing remote copy', async () => {
    const page = setUp();
    page.status.connections = [paused, { ...paused, id: 'b', state: 'conflict', conflicts: ['shortcuts', 'wallpapers'], error: 'remote-missing' }];
    await page.controller.refresh();
    const missing = page.list().connections[1];
    expect(page.list().connections).toHaveLength(2);
    expect(missing.remoteMissing).toBe(true);
    expect(missing.conflictsText).toContain('Shortcuts and icons');
    expect(missing.errorText).toBe('');
    expect(page.model().showSetupHint).toBe(false);
  });

  it('points blocked connections to the one to restore and gives every failure its exact code', async () => {
    const page = setUp();
    page.status.connections = [
      { ...paused, id: 'blocked', error: 'interrupted-apply', enabled: false, hasMigrationBackup: true,
        config: { ...paused.config, endpoint: 'https://broken.test/' } },
      { ...paused, id: 'waiting', enabled: true, state: 'error', error: 'interrupted-apply',
        diagnostic: { revision: 'dav-lock-5', phase: 'move-race', statuses: [201, 201] } }
    ];
    await page.controller.refresh();
    const [blocked, waiting] = page.list().connections;
    expect(blocked.needsRecovery).toBe(true);
    expect(waiting.errorText).toContain('broken.test');
    expect(waiting.diagnosticText).toBe('Lumno 9.9.9 · interrupted-apply · dav-lock-5 / move-race / 201,201');
    expect(blocked.diagnosticText).toBe('Lumno 9.9.9 · interrupted-apply');
  });

  it('sends each connection\'s actions to the worker', async () => {
    const page = setUp();
    await page.controller.onAction('pause', 'a');
    await page.controller.onAction('remove', 'b');
    await page.controller.onAction('add', undefined, { config: { endpoint: 'https://new.test/' } });
    expect(page.requests).toContainEqual(expect.objectContaining({ operation: 'pause', id: 'a' }));
    expect(page.requests).toContainEqual(expect.objectContaining({ operation: 'remove', id: 'b' }));
    const add = page.requests.find((request) => request.operation === 'add');
    expect(add).toBeDefined();
    expect(add).not.toHaveProperty('id');
  });

  it('names conflicting settings by their visible titles and values without refreshing the list', async () => {
    const page = setUp();
    await page.controller.refresh();
    const statusReads = () => page.requests.filter((request) => request.operation === 'status').length;
    const reads = statusReads();
    const details = await page.controller.onAction('conflictDetails', 'b');
    const items = details.items || [];
    const darkSurface = `${copy.bookmark_topbar_surface_title} · ${copy.theme_label_dark}`;
    expect(items.map((item) => item.label)).toEqual([
      'Shortcuts and icons', copy.settings_simple_mode_title, copy.settings_tab_blacklist, copy.webdav_preference_other,
      copy.webdav_preference_zen_mode, copy.newtab_quote_position, copy.folder_color_title, copy.bookmark_topbar_surface_title,
      darkSurface
    ]);
    const values = items.map((item) => [item.local, item.remote].map((side) => ('value' in side ? side.value : undefined)));
    // Record fields show option names; folder colors hide the folder reference.
    expect(values[5]).toEqual([copy.newtab_quote_bottom, copy.newtab_quote_input]);
    expect(values[6]).toEqual(['#22C55E', '#F59E0B']);
    // The bookmark bar names its material and tells light and dark colors apart.
    expect(values.slice(7)).toEqual([
      [copy.bookmark_topbar_surface_clear, copy.bookmark_topbar_surface_custom],
      ['#000000', '#445566']
    ]);
    expect(statusReads()).toBe(reads);
  });

  it('keeps diagnostics out of the sentence a failure shows', async () => {
    const page = setUp();
    page.failNext({ error: 'conditional-write-unsupported', diagnostic: { revision: 'dav-lock-5', phase: 'move-race', statuses: [201, 201], password: 'never-display' } });
    const error = await page.rejection('test', 'a');
    expect(error.diagnostic).toBe('Lumno 9.9.9 · conditional-write-unsupported · dav-lock-5 / move-race / 201,201');
    expect(error.message).not.toContain('move-race');
    expect(error.message).not.toContain('never-display');
    page.failNext({ error: 'duplicate-connection' });
    expect((await page.rejection('add')).message).toMatch(/same server, folder and username/);
  });

  it('tells a bad record on this device from a bad copy on the server, by record kind', async () => {
    const page = setUp();
    page.failNext({ error: 'local-invalid-wallpaper' });
    const local = await page.rejection('sync', 'a');
    expect(local.message).toBe(copy.webdav_error_local_invalid_wallpaper);
    expect(local.message).toMatch(/This device’s wallpaper/);
    expect(local.diagnostic).toBe('Lumno 9.9.9 · local-invalid-wallpaper');
    page.failNext({ error: 'invalid-wallpaper' });
    expect((await page.rejection('sync', 'a')).message).toBe(copy.webdav_error_invalid_wallpaper);
    expect(copy.webdav_error_invalid_wallpaper).not.toBe(copy.webdav_error_invalid_shortcuts);
    page.failNext({ error: 'remote-unreadable', diagnostic: { revision: 'dav-lock-5', phase: 'state-read', statuses: [204] } });
    expect((await page.rejection('sync', 'a')).diagnostic).toBe('Lumno 9.9.9 · remote-unreadable · dav-lock-5 / state-read / 204');
    page.failNext({ error: 'http-502' });
    expect((await page.rejection('sync', 'a')).message).toMatch(/HTTP 502/);
    page.failNext({ error: 'unknown-thing' });
    expect((await page.rejection('sync', 'a')).message).toBe(copy.webdav_error_generic);
    page.failNext({ error: 'network-error' });
    expect((await page.rejection('sync', 'a')).message).toMatch(/Local data is retained/);
  });

  it('asks for a reload after a worker update and refuses all but pausing until then', async () => {
    const page = setUp();
    page.status.syncRevision = 'dav-parallel-1';
    await page.controller.refresh();
    expect(page.list().outdated).toBe(true);
    expect(page.model().notice).toBe(copy.webdav_error_outdated);
    const count = page.requests.length;
    expect((await page.rejection('add')).message).toMatch(/multiple WebDAV connections/);
    expect((await page.rejection('remove', 'a')).message).toMatch(/multiple WebDAV connections/);
    expect(page.requests).toHaveLength(count);
    await page.controller.onAction('pause', 'a');
    expect(page.requests.at(-2)).toMatchObject({ operation: 'pause', id: 'a' });
  });

  it('refreshes when a connection\'s status changes elsewhere', async () => {
    const page = setUp();
    page.status.connections = [paused];
    await page.controller.refresh();
    expect(page.model().showSetupHint).toBe(false);
    page.status.connections = [];
    page.storageChanged(`${webdavStatus.key}:b`);
    await vi.waitFor(() => expect(page.list().connections).toHaveLength(0));
    expect(page.model()).toMatchObject({ showSetupHint: true, notice: '' });
  });
});
