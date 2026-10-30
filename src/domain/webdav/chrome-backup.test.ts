import { describe, expect, it } from 'vitest';
import { newtabShortcutsLegacy } from '../settings/newtab-shortcuts';
import { createShortcutRecord } from '../shortcuts/normalize';
import { createShortcutStoragePlan } from '../shortcuts/storage-plan';
import { planChromeBackup } from './chrome-backup';
import { SHORTCUT_SYNC_KEYS, byteLength } from './state-base';

const firstShortcut = createShortcutRecord({ id: 'first', title: 'First', url: 'https://example.com/' }, { now: 100 });

describe('the bounded browser sync backup', () => {
  it('updates every shortcut chunk together within the item quota and clears stale tails', () => {
    const longList = Array.from({ length: 60 }, (_, index) => createShortcutRecord({
      id: `long-${index}`, title: 'Long shortcut', url: `https://example.com/${'x'.repeat(1000)}?id=${index}`
    }, { now: 100 }));
    const localPlan = createShortcutStoragePlan({ items: longList }, { maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER });
    const plan = planChromeBackup(localPlan.payload, { [SHORTCUT_SYNC_KEYS[2]]: { r: 'stale', s: [['first', 0, 'First', 'example.com/']] } });

    expect(plan.complete).toBe(false);
    expect(Object.keys(plan.payload)).toHaveLength(3);
    expect(byteLength(JSON.stringify(plan.payload[SHORTCUT_SYNC_KEYS[0]]))).toBeLessThan(8192);
    expect(JSON.stringify(plan.payload)).not.toContain('"first"');
  });

  it('leaves the legacy list for older devices', () => {
    const plan = planChromeBackup(createShortcutStoragePlan({ items: [firstShortcut] }).payload, { [newtabShortcutsLegacy.key]: [firstShortcut] });

    expect(plan.remove).not.toContain(newtabShortcutsLegacy.key);
    expect(Object.hasOwn(plan.payload, newtabShortcutsLegacy.key)).toBe(false);
  });

  it('does not rewrite an unchanged grouped copy for a new revision alone', () => {
    const payload = createShortcutStoragePlan({ items: [firstShortcut] }).payload;
    const plan = planChromeBackup(payload, payload);

    expect(plan.complete).toBe(true);
    expect(SHORTCUT_SYNC_KEYS.some((key) => Object.hasOwn(plan.payload, key))).toBe(false);
  });
});
