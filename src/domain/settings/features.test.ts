import { describe, expect, it } from 'vitest';
import {
  normalizeGraphicsProbe,
  selectionQuickActionsEnabled,
  selectionQuickActionsGroupEnabled,
  selectionQuickActionsProvider,
  tabSwitcherEnabled,
  updateNoticeEnabled
} from './features';
import * as settings from './index';

describe('feature settings', () => {
  it('reads an unrecognised graphics probe answer as unknown, checked at no time', () => {
    expect(normalizeGraphicsProbe({ rendering: 'gpu', checkedAt: -1 })).toEqual({ rendering: 'unknown', checkedAt: 0 });
  });

  it('keeps the tab switcher on until it is turned off, under its stored key', () => {
    expect(tabSwitcherEnabled.key).toBe('_x_extension_tab_switcher_enabled_2026_unique_');
    expect(tabSwitcherEnabled.parse(undefined)).toBe(true);
  });
});

describe('notice and selection settings', () => {
  it('keeps the update notice and the tab switcher on unless turned off', () => {
    expect([false, true, undefined, 'false'].map((value) => updateNoticeEnabled.parse(value))).toEqual([false, true, true, true]);
    expect([false, true, 'false'].map((value) => tabSwitcherEnabled.parse(value))).toEqual([false, true, true]);
  });

  it('keeps selection quick actions and their tab group off unless turned on, under their keys', () => {
    expect(selectionQuickActionsEnabled.key).toBe('_x_extension_selection_quick_actions_enabled_2026_unique_');
    expect([false, true, undefined, 'false'].map((value) => selectionQuickActionsEnabled.parse(value))).toEqual([false, true, false, false]);
    expect(selectionQuickActionsGroupEnabled.key).toBe('_x_extension_selection_quick_actions_group_enabled_2026_unique_');
    expect([false, true, undefined, 'true'].map((value) => selectionQuickActionsGroupEnabled.parse(value))).toEqual([false, true, false, false]);
  });

  it('reads a known selection provider case-insensitively, GPT otherwise', () => {
    expect(selectionQuickActionsProvider.key).toBe('_x_extension_selection_quick_actions_provider_2026_unique_');
    expect(['gpt', ' KIMI ', 'unsupported', undefined].map((value) => selectionQuickActionsProvider.parse(value))).toEqual(['gpt', 'kimi', 'gpt', 'gpt']);
  });

  it('has no selection icon set or trigger style settings any more', () => {
    [
      'normalizeSelectionQuickActionsIconSet',
      'SELECTION_QUICK_ACTIONS_ICON_SET_STORAGE_KEY',
      'normalizeSelectionQuickActionsTriggerStyle',
      'resolveSelectionQuickActionsTriggerStyle',
      'SELECTION_QUICK_ACTIONS_TRIGGER_STYLE_STORAGE_KEY'
    ].forEach((name) => expect(Object.keys(settings)).not.toContain(name));
  });
});
