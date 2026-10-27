const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const settings = require('../../src/domain/settings/index.ts');
const help = require('../../src/options/options-translation-help');

const repoRoot = path.resolve(__dirname, '..', '..');
const getMessage = (key, fallback) => fallback;
const formatTemplate = (template, values) => template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
const ISSUE_URL = 'https://github.com/example/repo/issues/new';

function model(locale) {
  return help.buildTranslationHelpModel({
    formatTemplate, getMessage, issueUrl: ISSUE_URL, locale, uiLocales: settings.UI_LOCALES, version: '1.2.3'
  });
}

// Simplified Chinese is the source language: nothing to improve there.
assert.deepStrictEqual(model('zh_CN'), { visible: false });

// Every other language links to the prefilled translation issue form.
{
  const ja = model('ja');
  assert.strictEqual(ja.visible, true);
  assert.strictEqual(ja.title, '帮助改进日本語翻译');
  const url = new URL(ja.reportHref);
  assert.strictEqual(url.origin + url.pathname, ISSUE_URL);
  assert.strictEqual(url.searchParams.get('template'), 'translation.yml');
  assert.strictEqual(url.searchParams.get('language'), '日本語 (ja)');
  assert.strictEqual(url.searchParams.get('version'), '1.2.3');
  assert.ok(url.searchParams.get('title').startsWith('[Translation] 日本語'));
}
assert.strictEqual(help.buildTranslationIssueUrl({ issueUrl: 'not a url', locale: 'de', languageName: 'Deutsch' }), '');
assert.ok(fs.existsSync(path.join(repoRoot, '.github/ISSUE_TEMPLATE/translation.yml')),
  'the issue form the report link opens should exist');
const template = fs.readFileSync(path.join(repoRoot, '.github/ISSUE_TEMPLATE/translation.yml'), 'utf8');
['language', 'problem', 'version'].forEach((id) => {
  assert.ok(template.includes(`id: ${id}`), `the issue form should have the ${id} field the link prefills`);
});

// Translators read English beside their language; English and Traditional
// Chinese read the Simplified Chinese Lumno is written in.
assert.strictEqual(help.getTranslationReferenceLocale('de'), 'en');
assert.strictEqual(help.getTranslationReferenceLocale('en'), 'zh_CN');
assert.strictEqual(help.getTranslationReferenceLocale('zh_TW'), 'zh_CN');

// The sheet opens as UTF-8 in Excel and keeps commas, quotes and line breaks in one cell.
const csv = help.buildTranslationSheetCsv({
  headers: { reference: 'English', current: 'Deutsch', suggestion: 'Vorschlag', note: 'Anmerkung' },
  referenceMessages: {
    plain: { message: 'Open' },
    tricky: { message: 'Say "hi", then\nwave' },
    missing: { message: 'Only English' }
  },
  currentMessages: {
    plain: { message: 'Öffnen' },
    tricky: { message: 'Sag „hi“, dann\nwinken' }
  }
});
assert.ok(csv.startsWith('\uFEFFID,English,Deutsch,Vorschlag,Anmerkung\r\n'));
assert.ok(csv.includes('\r\nplain,Open,Öffnen,,\r\n'));
assert.ok(csv.includes('\r\ntricky,"Say ""hi"", then\nwave","Sag „hi“, dann\nwinken",,\r\n'));
assert.ok(csv.endsWith('\r\nmissing,Only English,,,\r\n'));

// A filled sheet goes back into the locale file; mismatched {tokens} stay out.
{
  const en = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales/en/messages.json'), 'utf8'));
  const tokenKey = Object.keys(en).find((key) => /\{\w+\}/.test(en[key].message));
  // Saved by a spreadsheet app that separates with ; (as in German locales).
  const sheet = [
    '\uFEFFID;English;Deutsch;Vorschlag;Anmerkung',
    'settings_language_title;Language;Sprache;"Sprache; neu";klingt besser',
    `${tokenKey};x;y;Kein Platzhalter;`,
    'settings_update_notice_title;x;y;;',
    ''
  ].join('\r\n');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumno-sheet-'));
  const file = path.join(dir, 'sheet.csv');
  fs.writeFileSync(file, sheet);
  const output = execFileSync(process.execPath, [path.join(repoRoot, 'scripts/i18n/import-sheet.js'), file, 'de', '--dry-run'], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(output.includes('settings_language_title'), output);
  assert.ok(output.includes('"Sprache; neu"'), output);
  assert.ok(output.includes(`${tokenKey}: has tokens (none)`), output);
  assert.ok(output.includes('settings_language_title: klingt besser'), output);
  assert.ok(output.includes('de: 1 message(s) would change'), output);
}

(async () => {
  // Downloading builds the sheet from the reference and current copy.
  const loaded = [];
  const saved = [];
  const documentObj = {
    body: { appendChild() {} },
    createElement: () => ({ click() { saved.push(this.download); }, remove() {} }),
    defaultView: {
      Blob: class { constructor(parts, options) { this.text = parts.join(''); this.type = options.type; saved.push(this); } },
      URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
      setTimeout: (callback) => callback()
    }
  };
  const model = help.buildTranslationHelpModel({
    formatTemplate,
    getMessage,
    issueUrl: ISSUE_URL,
    locale: 'fr',
    onDownload: () => help.downloadTranslationSheet({
      documentObj,
      getMessage,
      locale: 'fr',
      loadLocaleMessages: (locale) => {
        loaded.push(locale);
        return Promise.resolve({ greeting: { message: locale === 'en' ? 'Hello' : 'Bonjour' } });
      },
      uiLocales: settings.UI_LOCALES
    }),
    uiLocales: settings.UI_LOCALES,
    version: '1.2.3'
  });
  assert.strictEqual(model.visible, true);
  await model.onDownload();
  assert.deepStrictEqual(loaded, ['en', 'fr']);
  assert.ok(saved[0].text.includes('greeting,Hello,Bonjour,,'));
  assert.strictEqual(saved[1], 'lumno-translation-fr.csv');
  console.log('Options translation help tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
