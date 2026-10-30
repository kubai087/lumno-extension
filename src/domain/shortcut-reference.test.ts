import { describe, expect, it } from 'vitest';
import en from '../../_locales/en/messages.json';
import ja from '../../_locales/ja/messages.json';
import zhCN from '../../_locales/zh_CN/messages.json';
import zhTW from '../../_locales/zh_TW/messages.json';
import { formatShortcutReference } from './shortcut-display';
import { getBrowserShortcutDefinitions, getFixedShortcutDefinitions, getShortcutReferenceGroups } from './shortcut-reference';
import type { ShortcutDefinition } from './shortcut-reference';

const definitions = getBrowserShortcutDefinitions().concat(getFixedShortcutDefinitions());

function definition(id: string): ShortcutDefinition | undefined {
  return definitions.find((each) => each.id === id);
}

function searchItem(platform: string, id: string) {
  const group = getShortcutReferenceGroups({ platform }).find((each) => each.id === 'search');
  return group?.items.find((item) => item.id === id);
}

const LOCALES: Array<[string, Record<string, { message: string }>]> = [['en', en], ['ja', ja], ['zh_CN', zhCN], ['zh_TW', zhTW]];
const NUMBER_JUMP_KEYS = [
  'shortcut_reference_search_number_jump_title',
  'shortcut_reference_search_number_jump_desc',
  'shortcut_reference_search_number_jump_shortcut',
  'search_number_jump_release_hint'
];

describe('shortcut reference', () => {
  it('lists the double-Tab search scope shortcut in the search group', () => {
    expect(definition('search-open-scope-menu')?.shortcut).toBe('Tab Tab');
    expect(searchItem('mac', 'search-open-scope-menu')).toBeDefined();
  });

  it('lists the number jump with its platform modifier', () => {
    const numberJump = definition('search-number-jump');
    expect(numberJump?.defaultShortcut).toEqual({ default: 'Ctrl 0.4s → 0–9', mac: 'Command 0.4s → 0–9' });
    expect(numberJump?.shortcutLabelKey).toBe('shortcut_reference_search_number_jump_shortcut');
    expect(searchItem('mac', 'search-number-jump')?.shortcut).toBe('Command 0.4s → 0–9');
    expect(searchItem('windows', 'search-number-jump')?.shortcut).toBe('Ctrl 0.4s → 0–9');
  });

  it.each(LOCALES)('has the number jump copy in %s', (_locale, messages) => {
    NUMBER_JUMP_KEYS.forEach((key) => {
      expect(messages[key]?.message.trim(), key).toBeTruthy();
    });
  });

  it.each(definitions.map((each) => [each.id, each]))('shows %s without Alt on macOS or raw arrow key names', (_id, each) => {
    const macLabel = formatShortcutReference(each.shortcut || each.defaultShortcut?.mac || '', { platform: 'mac' });
    const windowsLabel = formatShortcutReference(each.shortcut || each.defaultShortcut?.default || '', { platform: 'windows' });
    expect(macLabel).not.toMatch(/\bAlt\b|Arrow(?:Up|Down|Left|Right)/);
    expect(windowsLabel).not.toMatch(/Arrow(?:Up|Down|Left|Right)/);
  });
});
