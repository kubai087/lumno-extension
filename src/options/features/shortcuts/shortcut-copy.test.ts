import { describe, expect, it } from 'vitest';
import { required } from '../../../../tests/fakes/dom';
import { buildShortcutReference, getCtrlTabLink, getSearchShortcutLabel } from './shortcut-copy';

const fallback = (_key: string, text: string) => text;

describe('Options search shortcut chip', () => {
  it('says nothing is set before the browser answers', () => {
    expect(getSearchShortcutLabel({ read: false, commands: undefined }, false, fallback)).toBe('未设置');
  });

  it('shows the platform default without a bound command', () => {
    expect(getSearchShortcutLabel({ read: true, commands: [] }, false, fallback)).toBe('Ctrl+Shift+K');
  });

  it('shows the bound chord, trimmed and formatted', () => {
    expect(getSearchShortcutLabel({ read: true, commands: [{ name: 'show-search', shortcut: ' ⌥K ' }] }, true, fallback)).toBe('⌥K');
  });

  it('falls back to the platform default in browsers without commands or after a failed read', () => {
    expect(getSearchShortcutLabel({ read: true, commands: undefined }, true, fallback)).toBe('⌘⇧K');
  });
});

const MESSAGES: Record<string, string> = {
  settings_tab_switcher_ctrl_tab_link: 'Switch with {shortcut}, like Arc',
  settings_tab_switcher_ctrl_tab_guide: 'Guide: {shortcut} like Arc'
};
const HELP_URL = 'https://lumno.kubai.design/en/help/tab-switcher/#ctrl-tab';

// The rows the view receives and the tab switcher row's link, for a browser
// that binds `shortcut` to the tab switcher.
function render(shortcut: string, isMac: boolean) {
  const state = {
    read: true,
    commands: [
      { name: 'show-search', shortcut: '⇧⌘K' },
      { name: 'show-tab-switcher', shortcut }
    ]
  };
  const getMessage = (key: string, text: string) => MESSAGES[key] || text;
  const items = buildShortcutReference(state, isMac, getMessage).groups.flatMap((group) => group.items);
  return {
    link: required(getCtrlTabLink(state, isMac, getMessage, HELP_URL), 'the Ctrl+Tab link'),
    label: (id: string) => required(items.find((item) => item.id === id), id).shortcutLabel
  };
}

describe('Options shortcut reference rows', () => {
  it('has no Ctrl+Tab link until the commands are read', () => {
    expect(getCtrlTabLink({ read: false, commands: undefined }, true, fallback, HELP_URL)).toBeNull();
  });

  it('links an unbound tab switcher to the Ctrl+Tab help and cycles with its own key', () => {
    const unbound = render('⌥Q', true);
    expect(unbound.link).toEqual({ href: HELP_URL, label: 'Switch with ⌃Tab, like Arc', bound: false });
    expect(unbound.label('tab-switcher-cycle')).toBe('Q / ⇥ / ↑↓←→');
    expect(unbound.label('tab-switcher-confirm')).toBe('↩ / ⌥↑');
  });

  it('names the keys as printed on Windows and Linux', () => {
    expect(render('Alt+Q', false).link.label).toBe('Switch with Ctrl+Tab, like Arc');
  });

  it('turns the link into the guide once Ctrl+Tab is bound, cycling with Tab and committing on Control', () => {
    const boundMac = render('⌃⇥', true);
    expect(boundMac.link).toEqual({ href: HELP_URL, label: 'Guide: ⌃Tab like Arc', bound: true });
    expect(boundMac.label('tab-switcher-cycle')).toBe('⇥ / ↑↓←→');
    expect(boundMac.label('tab-switcher-confirm')).toBe('↩ / ⌃↑');

    const boundWindows = render('Ctrl+Tab', false);
    expect(boundWindows.link.label).toBe('Guide: Ctrl+Tab like Arc');
    expect(boundWindows.label('tab-switcher-confirm')).toBe('Enter / Ctrl↑');
  });

  it('does not split a shortcut ending in a slash as a list', () => {
    const slash = render('Ctrl+Shift+/', false);
    expect(slash.label('show-tab-switcher')).toBe('Ctrl+Shift+/');
    expect(slash.label('tab-switcher-cycle')).toBe('/ / Tab / ↑↓←→');
    // Shift is held along, so releasing Control commits.
    expect(slash.label('tab-switcher-confirm')).toBe('Enter / Ctrl↑');
  });

  it('falls back to the default Alt+Q without a shortcut', () => {
    const unset = render('', true);
    expect(unset.label('tab-switcher-cycle')).toBe('Q / ⇥ / ↑↓←→');
    expect(unset.label('tab-switcher-confirm')).toBe('↩ / ⌥↑');
  });
});
