// Merges a translation spreadsheet a native speaker sent back:
//   node scripts/i18n/import-sheet.js <file.csv> <locale> [--dry-run]
// The sheet is the one Settings → Language → Improve translation downloads
// (src/options/options-translation-help.ts): ID, reference text, current
// text, Suggestion, Note. Every non-empty Suggestion replaces that message
// in _locales/<locale>/messages.json; a suggestion whose {tokens} or line
// breaks differ from English is reported and left out. Notes are printed
// for review. Run scripts/check/check-locales.js afterwards.
const fs = require('fs');
const files = require('./locale-files');

const ID_COLUMN = 0;
const SUGGESTION_COLUMN = 3;
const NOTE_COLUMN = 4;

// The separator the header row uses: spreadsheet apps in locales that write
// decimals with a comma save with ; and some export tabs.
function detectDelimiter(source) {
  const header = source.split(/\r?\n/, 1)[0];
  return [',', ';', '\t'].reduce((best, candidate) => (
    header.split(candidate).length > header.split(best).length ? candidate : best
  ), ',');
}

// RFC 4180 rows: quoted fields may hold separators, quotes ("") and line breaks.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [file, locale] = args.filter((arg) => arg !== '--dry-run');
  if (!file || !locale) {
    console.error('Usage: node scripts/i18n/import-sheet.js <file.csv> <locale> [--dry-run]');
    process.exit(1);
  }
  if (!(await files.readUiLocales()).ids.includes(locale)) {
    console.error(`Not in UI_LOCALES: ${locale}`);
    process.exit(1);
  }
  const sourceMessages = files.readMessages(files.SOURCE_LOCALE);
  const messages = files.readMessages(locale) || {};
  const rows = parseCsv(fs.readFileSync(file, 'utf8')).slice(1);
  const changed = [];
  const rejected = [];
  const notes = [];

  rows.forEach((row) => {
    const key = String(row[ID_COLUMN] || '').trim();
    if (!key) {
      return;
    }
    const suggestion = String(row[SUGGESTION_COLUMN] || '').replace(/\r\n?/g, '\n').trim();
    const note = String(row[NOTE_COLUMN] || '').trim();
    if (note) {
      notes.push(`${key}: ${note}`);
    }
    if (!suggestion) {
      return;
    }
    const source = sourceMessages[key];
    if (!source) {
      rejected.push(`${key}: not a message key`);
      return;
    }
    const sourceTokens = files.getTemplateTokens(source.message).join(' ');
    const tokens = files.getTemplateTokens(suggestion).join(' ');
    if (tokens !== sourceTokens) {
      rejected.push(`${key}: has tokens ${tokens || '(none)'}, English has ${sourceTokens || '(none)'}`);
      return;
    }
    if (files.countLineBreaks(suggestion) !== files.countLineBreaks(source.message)) {
      rejected.push(`${key}: has ${files.countLineBreaks(suggestion)} line breaks, English has ${files.countLineBreaks(source.message)}`);
      return;
    }
    if (suggestion.includes('$')) {
      rejected.push(`${key}: contains "$", which chrome.i18n reads as a placeholder`);
      return;
    }
    const current = messages[key] && messages[key].message;
    if (current === suggestion) {
      return;
    }
    changed.push({ key, from: current || '', to: suggestion });
    messages[key] = { ...(messages[key] || {}), message: suggestion };
  });

  changed.forEach(({ key, from, to }) => {
    console.log(`${key}\n  - ${JSON.stringify(from)}\n  + ${JSON.stringify(to)}`);
  });
  if (rejected.length) {
    console.log(`\nLeft out (${rejected.length}):\n  ${rejected.join('\n  ')}`);
  }
  if (notes.length) {
    console.log(`\nNotes (${notes.length}):\n  ${notes.join('\n  ')}`);
  }
  if (!dryRun && changed.length) {
    files.writeMessages(locale, messages);
  }
  console.log(`\n${locale}: ${changed.length} message(s) ${dryRun ? 'would change' : 'changed'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
