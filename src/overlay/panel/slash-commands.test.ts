import { describe, expect, it } from 'vitest';
import { createSlashCommands } from './slash-commands';

const mediaQuery: MediaQueryList = {
  matches: false,
  media: '(prefers-color-scheme: dark)',
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => true
};

describe('overlay slash commands', () => {
  it.each(['clip', 'webclip', 'web clip'])('finds web clip for the old plain input "%s"', (input) => {
    const commands = createSlashCommands({
      t: (_key, fallback) => fallback,
      formatMessage: (_key, fallback) => fallback,
      updateInputRightPadding() {},
      detectPageTheme: () => null,
      overlayMediaQuery: mediaQuery,
      elements: { inputParts: null, searchInput: null },
      documentPipEnabledAtOpen: true,
      overlayThemeChoice: { mode: 'system' }
    });

    expect(commands.getCommandMatches(input).map((command) => command.type)).toEqual(['commandDocumentPip']);
  });
});
