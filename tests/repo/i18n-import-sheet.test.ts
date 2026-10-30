import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readLocaleMessages, repoPath } from './repository';

const created: string[] = [];

// Dry-runs scripts/i18n/import-sheet.js on a returned sheet; returns what it reports.
function importSheet(sheet: string, locale: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'lumno-sheet-'));
  created.push(dir);
  const file = join(dir, 'sheet.csv');
  writeFileSync(file, sheet);
  return execFileSync(process.execPath, [repoPath('scripts/i18n/import-sheet.js'), file, locale, '--dry-run'], { encoding: 'utf8' });
}

afterEach(() => {
  created.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

// The sheet Settings → Language → Improve translation downloads, filled in
// by a translator, goes back into the locale file.
describe('translation sheet import', () => {
  it('takes filled suggestions, prints notes and leaves out suggestions whose tokens differ', () => {
    const tokenKey = Object.entries(readLocaleMessages('en')).find(([, message]) => /\{\w+\}/.test(message))?.[0];
    expect(tokenKey).toBeDefined();
    // Saved by a spreadsheet app that separates with ; (as in German locales).
    const output = importSheet([
      '﻿ID;English;Deutsch;Vorschlag;Anmerkung',
      'settings_language_title;Language;Sprache;"Sprache; neu";klingt besser',
      `${tokenKey};x;y;Kein Platzhalter;`,
      'settings_update_notice_title;x;y;;',
      ''
    ].join('\r\n'), 'de');
    expect(output).toContain('settings_language_title');
    expect(output).toContain('"Sprache; neu"');
    expect(output).toContain(`${tokenKey}: has tokens (none)`);
    expect(output).toContain('settings_language_title: klingt besser');
    expect(output).toContain('de: 1 message(s) would change');
  });
});
