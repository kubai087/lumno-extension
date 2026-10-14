const fs = require('fs');
const path = require('path');

const LOCALE_ROOT = '_locales';
const SOURCE_ROOTS = ['src'];
const INCLUDED_EXTENSIONS = new Set(['.js', '.html']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git']);
const MAX_HITS_PER_FILE = 30;
const HAN_RE = /\p{Script=Han}/u;
const STRING_RE = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

const ALLOWLIST = [
  'brand/provider names in assets/data/site-search.json and provider defaults',
  'AI provider remote page selector probes in src/background/ai-provider-submit.js',
  'localized onboarding content model in src/onboarding/onboarding-content.js',
  'localized update notice fallback model in src/shared/update-notice.js',
  'localized selection prompt model in src/shared/selection-intent.js',
  'browser built-in bookmark folder aliases used only for folder detection',
  'debug-only score reason strings when the debug flag is disabled by default',
  'Chinese search-intent tokens in src/shared/search-utils.js scoring dictionaries',
  'question filler words dropped from help center queries in src/shared/help-center-search.js',
  'episode and chapter title patterns in src/shared/progress-match.js',
  'photographer names credited in src/newtab/wallpaper-catalog.js'
];
const I18N_CALL_RE = /(?:^|[^\w])(?:t|baseT|getMessage|formatMessage|updateSyncStatusText|attachPopconfirm|createPopconfirmWrap|createModeOption)\s*\(/;

function walk(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    return INCLUDED_EXTENSIONS.has(path.extname(root)) ? [root] : [];
  }
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    if (IGNORED_DIRS.has(entry.name)) {
      return;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      return;
    }
    if (entry.isFile() && INCLUDED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  });
  return files;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Failed to parse ${file}: ${error.message}`);
    process.exit(1);
  }
}

function auditLocales() {
  const localeNames = fs.readdirSync(LOCALE_ROOT)
    .filter((name) => fs.existsSync(path.join(LOCALE_ROOT, name, 'messages.json')))
    .sort();
  const localeMaps = {};
  localeNames.forEach((locale) => {
    localeMaps[locale] = readJson(path.join(LOCALE_ROOT, locale, 'messages.json'));
  });
  const allKeys = Array.from(new Set(
    Object.values(localeMaps).flatMap((messages) => Object.keys(messages))
  )).sort();

  const rows = localeNames.map((locale) => {
    const messages = localeMaps[locale];
    const missing = allKeys.filter((key) => !Object.prototype.hasOwnProperty.call(messages, key));
    const empty = Object.keys(messages)
      .filter((key) => !String(messages[key] && messages[key].message || '').trim())
      .sort();
    return { locale, keyCount: Object.keys(messages).length, missing, empty };
  });

  console.log('Locale key parity:');
  rows.forEach((row) => {
    console.log(
      `${row.locale} keys=${row.keyCount}` +
      ` missing=${row.missing.length}` +
      ` empty=${row.empty.length}`
    );
    if (row.missing.length > 0) {
      console.log(`  missing: ${row.missing.slice(0, 20).join(', ')}`);
    }
    if (row.empty.length > 0) {
      console.log(`  empty: ${row.empty.slice(0, 20).join(', ')}`);
    }
  });
  return rows;
}

function stripHtmlTags(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isAllowlistedLine(file, line) {
  if (file === 'src/background/ai-provider-submit.js') {
    return true;
  }
  if (file === 'src/shared/search-utils.js') {
    return true;
  }
  if (file === 'src/shared/selection-intent.js') {
    return true;
  }
  if (file === 'src/shared/help-center-search.js') {
    return true;
  }
  if (file === 'src/shared/progress-match.js') {
    return true;
  }
  if (file === 'src/onboarding/onboarding-content.js') {
    return true;
  }
  if (file === 'src/newtab/wallpaper-catalog.js') {
    return true;
  }
  if (file === 'src/shared/update-notice.js' &&
      /\b(?:badgeFallback|textFallback|linkFallback|closeLabelFallback):\s*['"`]/.test(line)) {
    return true;
  }
  if (file === 'src/onboarding/onboarding.js' && /\b(?:error|copied):\s*['"`]/.test(line)) {
    return true;
  }
  if (/title === 'bookmarks bar'/.test(line) ||
      /['"`](?:书签栏|其他书签|移动设备书签|書籤列|書籤欄)['"`]/.test(line)) {
    return true;
  }
  if (/name:\s*['"`]/.test(line) && (
      /site-search|provider|engine|search/i.test(file + line) ||
      (file === 'src/background/background.js' || file === 'src/newtab/newtab.js')
    )) {
    return true;
  }
  if (file === 'src/newtab/newtab.js' && /'weibo\.com':\s*['"`]微博['"`]/.test(line)) {
    return true;
  }
  if (file === 'src/background/background.js' && /近(?:30分钟|24小时)切换/.test(line)) {
    return true;
  }
  if (/debug|score|reason/i.test(line) && !/textContent|placeholder|aria-label|title/.test(line)) {
    return true;
  }
  return false;
}

function hasI18nCall(line) {
  return I18N_CALL_RE.test(line) ||
    /chrome\.i18n\.getMessage/.test(line) ||
    /data-i18n/.test(line) ||
    /__MSG_/.test(line);
}

function countParenDelta(line) {
  const withoutStrings = line.replace(STRING_RE, '""');
  const opens = (withoutStrings.match(/\(/g) || []).length;
  const closes = (withoutStrings.match(/\)/g) || []).length;
  return opens - closes;
}

function updateI18nJsState(line, state) {
  if (state.i18nDepth > 0) {
    state.i18nDepth = Math.max(0, state.i18nDepth + countParenDelta(line));
    return true;
  }
  if (!I18N_CALL_RE.test(line)) {
    return false;
  }
  const delta = countParenDelta(line);
  state.i18nDepth = Math.max(0, delta);
  return delta > 0;
}

function scanJsLine(file, line, lineNumber) {
  if (isAllowlistedLine(file, line)) {
    return [];
  }
  const hits = [];
  const sinkPatterns = [
    { type: 'textContent', regex: /\.(?:textContent|innerText)\s*=\s*(['"`])([\s\S]*?)\1/g },
    { type: 'placeholder', regex: /\.placeholder\s*=\s*(['"`])([\s\S]*?)\1/g },
    { type: 'title', regex: /\.title\s*=\s*(['"`])([\s\S]*?)\1/g },
    { type: 'setAttribute', regex: /\.setAttribute\s*\(\s*['"`](?:title|aria-label)['"`]\s*,\s*(['"`])([\s\S]*?)\1/g },
    { type: 'dialog', regex: /\b(?:confirm|alert|prompt)\s*\(\s*(['"`])([\s\S]*?)\1/g },
    { type: 'fallback', regex: /\b(?:labelFallback|placeholderFallback|descriptionFallback)\s*:\s*(['"`])([\s\S]*?)\1/g }
  ];

  sinkPatterns.forEach((pattern) => {
    let match = null;
    while ((match = pattern.regex.exec(line))) {
      const value = match[2];
      if (value && HAN_RE.test(value) && !hasI18nCall(line)) {
        hits.push({ file, lineNumber, type: pattern.type, text: line.trim() });
      }
    }
  });

  if (hits.length === 0 && HAN_RE.test(line) && !hasI18nCall(line)) {
    const strings = Array.from(line.matchAll(STRING_RE))
      .map((match) => match[2])
      .filter((value) => HAN_RE.test(value));
    if (strings.length > 0) {
      hits.push({ file, lineNumber, type: 'han-literal', text: line.trim() });
    }
  }
  return hits;
}

function scanHtmlLine(file, line, lineNumber, state) {
  const trimmed = line.trim();
  if (/<style\b/i.test(trimmed)) {
    state.inStyle = true;
  }
  if (/<script\b/i.test(trimmed)) {
    state.inScript = true;
  }
  if (/\bdata-i18n(?:-[\w-]+)?=/.test(trimmed)) {
    state.inI18nTag = true;
  }
  const shouldSkip = state.inStyle || state.inScript || state.inI18nTag || hasI18nCall(trimmed);
  const hits = [];
  if (!shouldSkip && HAN_RE.test(trimmed)) {
    const text = stripHtmlTags(trimmed);
    if (text && HAN_RE.test(text)) {
      hits.push({ file, lineNumber, type: 'html-text', text: trimmed });
    }
  }
  if (/<\/style>/i.test(trimmed)) {
    state.inStyle = false;
  }
  if (/<\/script>/i.test(trimmed)) {
    state.inScript = false;
  }
  if (state.inI18nTag && />\s*$/.test(trimmed)) {
    state.inI18nTag = false;
  }
  return hits;
}

function auditSources() {
  const files = SOURCE_ROOTS
    .flatMap(walk)
    .map((file) => path.normalize(file).replace(/\\/g, '/'))
    .sort();
  const hits = [];
  files.forEach((file) => {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const htmlState = { inStyle: false, inScript: false, inI18nTag: false };
    const jsState = { i18nDepth: 0 };
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (file.endsWith('.html')) {
        hits.push(...scanHtmlLine(file, line, lineNumber, htmlState));
        return;
      }
      if (updateI18nJsState(line, jsState)) {
        return;
      }
      hits.push(...scanJsLine(file, line, lineNumber));
    });
  });
  return hits;
}

function printSourceHits(hits) {
  console.log('');
  console.log('Unreviewed hardcoded user-facing string candidates:');
  if (hits.length === 0) {
    console.log('none');
    return;
  }
  const byFile = new Map();
  hits.forEach((hit) => {
    if (!byFile.has(hit.file)) {
      byFile.set(hit.file, []);
    }
    byFile.get(hit.file).push(hit);
  });
  Array.from(byFile.keys()).sort().forEach((file) => {
    const fileHits = byFile.get(file);
    console.log(`${file} hits=${fileHits.length}`);
    fileHits.slice(0, MAX_HITS_PER_FILE).forEach((hit) => {
      console.log(`  ${hit.lineNumber} ${hit.type}: ${hit.text.slice(0, 180)}`);
    });
    if (fileHits.length > MAX_HITS_PER_FILE) {
      console.log(`  ... ${fileHits.length - MAX_HITS_PER_FILE} more`);
    }
  });
}

console.log('I18n audit allowlist categories:');
ALLOWLIST.forEach((item) => console.log(`- ${item}`));
auditLocales();
const sourceHits = auditSources();
printSourceHits(sourceHits);
console.log('');
console.log(`i18n audit candidate count=${sourceHits.length}`);
