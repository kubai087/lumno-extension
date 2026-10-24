const assert = require('assert');
const settings = require('../../src/shared/settings');
const bindings = require('../../src/options/options-setting-bindings');
const { getToggleSettings } = require('../../src/options/options-toggle-settings');

function createArea(initial) {
  const values = Object.assign({}, initial);
  const writes = [];
  return {
    values,
    writes,
    get(keys, callback) {
      const result = {};
      keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) result[key] = values[key];
      });
      callback(result);
    },
    set(payload) {
      writes.push(payload);
      Object.assign(values, payload);
    }
  };
}

function createInput() {
  const listeners = [];
  return {
    checked: false,
    value: '',
    addEventListener(type, listener) {
      assert.strictEqual(type, 'change');
      listeners.push(listener);
    },
    change(next) {
      if (typeof next === 'boolean') this.checked = next;
      else this.value = next;
      listeners.forEach((listener) => listener());
    }
  };
}

function createPage(initial, options) {
  const area = createArea(initial);
  const registry = bindings.createStorageChangeRegistry({
    isPrimaryAreaName: (name) => name === ((options && options.primary) || 'sync')
  });
  let refreshes = 0;
  const shown = new Map();
  const binder = bindings.createSettingBinder({
    storageArea: area,
    registry,
    refreshCustomSelects: () => { refreshes += 1; },
    setToggleState: (input, value) => { input.checked = Boolean(value); shown.set(input, value); },
    setSelectState: (select, value) => { select.value = String(value); shown.set(select, value); }
  });
  return { area, binder, registry, shown, get refreshes() { return refreshes; } };
}

// The registry runs a handler once per event for any of its keys, in
// registration order, and keeps local-area handlers apart from primary ones.
{
  const calls = [];
  const registry = bindings.createStorageChangeRegistry({ isPrimaryAreaName: (name) => name === 'sync' });
  registry.on(['a', 'b'], (changes, area) => calls.push(['ab', Object.keys(changes).sort().join(','), area]));
  registry.on('b', () => calls.push(['b']));
  registry.on('status', () => calls.push(['local-status']), { area: 'local' });
  registry.on(undefined, () => calls.push(['never']));
  registry.dispatch({ a: { newValue: 1 }, b: { newValue: 2 } }, 'sync');
  registry.dispatch({ a: { newValue: 1 } }, 'local');
  registry.dispatch({ status: { newValue: 1 } }, 'local');
  registry.dispatch({ status: { newValue: 1 } }, 'sync');
  registry.dispatch(null, 'sync');
  assert.deepStrictEqual(calls, [['ab', 'a,b', 'sync'], ['b'], ['local-status']]);
}

// A bound setting is read, normalized, applied and repaired at startup, then
// follows storage changes with its own repair and normalization rules.
{
  const page = createPage({ mode: 'bad' });
  const applied = [];
  page.binder.bindSetting({
    key: 'mode',
    normalize: (value) => (value === 'a' || value === 'b' ? value : 'a'),
    normalizeChange: (value) => (value === 'b' ? 'b' : 'a'),
    apply: (value) => applied.push(value),
    repairOnChange: false,
    refreshSelects: true
  });
  assert.deepStrictEqual(applied, ['a']);
  assert.deepStrictEqual(page.area.writes, [{ mode: 'a' }], 'an invalid stored value is written back once');
  assert.strictEqual(page.refreshes, 1);
  page.registry.dispatch({ mode: { newValue: 'zzz' } }, 'sync');
  assert.deepStrictEqual(applied, ['a', 'a']);
  assert.strictEqual(page.area.writes.length, 1, 'changes are not repaired when repairOnChange is false');
  page.registry.dispatch({ mode: { newValue: 'b' } }, 'local');
  assert.deepStrictEqual(applied, ['a', 'a'], 'changes in a non-primary area are ignored');

  const unread = createPage({ other: 1 });
  const unreadApplied = [];
  unread.binder.bindSetting({ key: 'other', normalize: Number, apply: (v) => unreadApplied.push(v), load: false });
  assert.deepStrictEqual(unreadApplied, [], 'load: false leaves the startup read to the section');
  unread.registry.dispatch({ other: { newValue: '3' } }, 'sync');
  assert.deepStrictEqual(unreadApplied, [3]);
  assert.deepStrictEqual(unread.area.writes, [{ other: 3 }], 'changes are repaired by default');
}

// Every Options switch is bound to its shared storage key and persists its
// own changes; each entry's normalizer decides the startup value.
{
  const table = getToggleSettings(settings);
  const hooks = {
    faviconBlacklistEditor() {},
    newtabShortcutSubcontrols() {},
    selectionQuickActionsAvailability() {}
  };
  const hooked = new Map(getToggleSettings(settings, hooks).map((entry) => [entry.key, entry.afterApply]));
  assert.strictEqual(hooked.get(settings.FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY), hooks.faviconBlacklistEditor);
  assert.strictEqual(hooked.get(settings.NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY), hooks.newtabShortcutSubcontrols);
  assert.strictEqual(hooked.get(settings.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY), hooks.selectionQuickActionsAvailability);
  assert.strictEqual(hooked.get(settings.SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY), hooks.selectionQuickActionsAvailability);
  assert.strictEqual(hooked.get(settings.MOTION_EFFECTS_ENABLED_STORAGE_KEY), undefined);
  const keys = table.map((entry) => entry.key);
  assert(keys.every(Boolean), 'every switch should use a key defined in LumnoSettings');
  assert.strictEqual(new Set(keys).size, keys.length, 'each key is bound once');
  assert.strictEqual(new Set(table.map((entry) => entry.inputId)).size, table.length);
  keys.forEach((key) => {
    assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(key), `${key} should travel with Chrome Sync and export`);
  });

  const byKey = new Map(table.map((entry) => [entry.key, entry]));
  const expectedDefaults = new Map([
    [settings.UPDATE_NOTICE_ENABLED_STORAGE_KEY, true],
    [settings.MOTION_EFFECTS_ENABLED_STORAGE_KEY, true],
    [settings.TAB_SWITCHER_ENABLED_STORAGE_KEY, true],
    [settings.TAB_SWITCHER_SHIFT_TAB_ENABLED_STORAGE_KEY, false],
    [settings.AUTO_PIP_ENABLED_STORAGE_KEY, true],
    [settings.DOCUMENT_PIP_ENABLED_STORAGE_KEY, false],
    [settings.PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY, false],
    [settings.OVERLAY_TAB_PRIORITY_STORAGE_KEY, true],
    [settings.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY, settings.normalizeNewtabTimeSecondsVisible(undefined)],
    [settings.SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY, settings.normalizeSelectionQuickActionsEnabled(undefined)]
  ]);
  expectedDefaults.forEach((expected, key) => {
    assert(byKey.has(key), `${key} should be bound to a switch`);
  });

  table.forEach((entry) => {
    const page = createPage({});
    const input = createInput();
    const hookCalls = [];
    const spec = Object.assign({}, entry, { input, afterApply: (value) => hookCalls.push(value) });
    if (entry.control === 'select') page.binder.bindSelect(spec);
    else page.binder.bindToggle(spec);
    const startupValue = entry.normalize(undefined);
    if (entry.load === false) {
      assert.strictEqual(page.area.writes.length, 0, `${entry.key} is read by its section`);
    } else {
      assert.strictEqual(page.shown.get(input), startupValue, `${entry.key} shows its default`);
      if (expectedDefaults.has(entry.key)) {
        assert.strictEqual(startupValue, expectedDefaults.get(entry.key), `${entry.key} default`);
      }
      assert.deepStrictEqual(
        page.area.writes,
        entry.repairOnLoad === false ? [] : [{ [entry.key]: startupValue }],
        `${entry.key} writes its default back unless it never repairs`
      );
    }
    page.area.writes.length = 0;
    if (entry.control === 'select') {
      const option = settings.SELECTION_QUICK_ACTIONS_PROVIDER_KEYS[1];
      input.change(option);
      assert.deepStrictEqual(page.area.writes, [{ [entry.key]: entry.normalize(option) }]);
    } else {
      input.change(!input.checked);
      const expected = (entry.normalizeInput || entry.normalize)(input.checked);
      assert.deepStrictEqual(page.area.writes, [{ [entry.key]: expected }], `${entry.key} persists switch changes`);
    }
    page.area.writes.length = 0;
    page.registry.dispatch({ [entry.key]: { newValue: 'not-a-value' } }, 'sync');
    const normalized = entry.normalize('not-a-value');
    assert.strictEqual(page.shown.get(input), normalized, `${entry.key} follows storage changes`);
    assert.deepStrictEqual(
      page.area.writes,
      entry.repairOnChange === false || normalized === 'not-a-value' ? [] : [{ [entry.key]: normalized }]
    );
    assert(hookCalls.length > 0, `${entry.key} runs its after hook on apply`);
  });

  const quickSwitch = byKey.get(settings.OVERLAY_TAB_PRIORITY_STORAGE_KEY);
  const page = createPage({ [quickSwitch.key]: false });
  const input = createInput();
  page.binder.bindToggle(Object.assign({}, quickSwitch, { input }));
  assert.strictEqual(input.checked, true, 'tab quick switching stays on');
  assert.deepStrictEqual(page.area.values[quickSwitch.key], true);
}

// A binder made with area 'local' reads and writes chrome.storage.local and
// follows only its changes, whichever area is primary (device-only settings
// such as the overlay's local fonts).
{
  const local = createArea({ fontKey: 'PingFang SC' });
  const registry = bindings.createStorageChangeRegistry({ isPrimaryAreaName: (name) => name === 'sync' });
  const binder = bindings.createSettingBinder({ area: 'local', storageArea: local, registry });
  const applied = [];
  binder.bindSetting({ key: 'fontKey', normalize: (value) => String(value || ''), apply: (value) => applied.push(value) });
  assert.deepStrictEqual(applied, ['PingFang SC'], 'the startup read comes from the local area');
  registry.dispatch({ fontKey: { newValue: 'Zapfino' } }, 'sync');
  assert.deepStrictEqual(applied, ['PingFang SC'], 'a synced copy of the key is ignored');
  registry.dispatch({ fontKey: { newValue: 'Zapfino' } }, 'local');
  assert.deepStrictEqual(applied, ['PingFang SC', 'Zapfino'], 'local changes are followed');
}

console.log('Options setting binding tests passed.');
