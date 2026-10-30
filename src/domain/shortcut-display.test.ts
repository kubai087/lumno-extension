import { describe, expect, it } from 'vitest';
import { formatShortcutChord, formatShortcutReference, formatShortcutTemplate, getNavigatorPlatform } from './shortcut-display';

const mac = { navigatorLike: { platform: 'Linux x86_64', userAgentData: { platform: 'macOS' }, userAgent: 'Mozilla/5.0' } };
const windows = { navigatorLike: { platform: 'Win32', userAgentData: { platform: 'Windows' }, userAgent: 'Mozilla/5.0' } };

describe('shortcut display', () => {
  it('reads macOS from client hints when navigator.platform is reduced, and Windows', () => {
    expect(getNavigatorPlatform(mac.navigatorLike)).toBe('mac');
    expect(getNavigatorPlatform(windows.navigatorLike)).toBe('windows');
  });

  it('shows Option and arrow symbols on macOS, and Alt with arrow symbols on Windows', () => {
    expect(formatShortcutReference('Alt+ArrowUp / Alt+ArrowDown', mac)).toBe('⌥↑ / ⌥↓');
    expect(formatShortcutReference('Alt+ArrowUp / Alt+ArrowDown', windows)).toBe('Alt+↑ / Alt+↓');
  });

  it('shows a release instruction with the platform modifier', () => {
    expect(formatShortcutReference('Enter / release Alt', mac)).toBe('↩ / ⌥↑');
    expect(formatShortcutReference('Enter / release Alt', windows)).toBe('Enter / Alt↑');
    expect(formatShortcutReference('Enter / release Ctrl', mac)).toBe('↩ / ⌃↑');
  });

  it('does not split the list at a slash key inside a chord', () => {
    expect(formatShortcutReference('Ctrl+Shift+/ / Tab', windows)).toBe('Ctrl+Shift+/ / Tab');
  });

  it('shows a double Tab as two presses', () => {
    expect(formatShortcutReference('Tab Tab', mac)).toBe('⇥ ⇥');
    expect(formatShortcutReference('Tab Tab', windows)).toBe('Tab Tab');
  });

  it('shows an Alt chord with the Option symbol on macOS only', () => {
    expect(formatShortcutChord('Alt+Q', mac)).toBe('⌥Q');
    expect(formatShortcutChord('Alt+Q', windows)).toBe('Alt+Q');
  });

  it('fills a shortcut placeholder in the platform convention', () => {
    expect(formatShortcutTemplate('Press {shortcut}', 'Alt+Q', mac)).toBe('Press ⌥Q');
  });

  it('keeps the long-hold number jump text as it is', () => {
    expect(formatShortcutReference('Command 0.4s → 0–9', { platform: 'mac' })).toBe('Command 0.4s → 0–9');
    expect(formatShortcutReference('Ctrl 0.4s → 0–9', { platform: 'windows' })).toBe('Ctrl 0.4s → 0–9');
  });
});
