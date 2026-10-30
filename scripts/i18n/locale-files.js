// Reading and writing the UI copy files: _locales/<locale>/messages.json
// and the translated onboarding copy in src/onboarding/locales/<locale>.json.
const fs = require('fs');
const path = require('path');
const { importSource } = require('../node/source-module');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SOURCE_LOCALE = 'en';
// zh_CN is the language Lumno is written in; translators read it beside the English.
const REFERENCE_LOCALE = 'zh_CN';
// Characters that vanish in an editor are written as \u escapes.
const INVISIBLE_CHARACTERS_RE = /[\u00A0\u00AD\u200B-\u200F\u2028\u2029\u202F\u2060\uFEFF]/g;

function messagesPath(locale) {
  return path.join(REPO_ROOT, '_locales', locale, 'messages.json');
}

function onboardingPath(locale) {
  return path.join(REPO_ROOT, 'src', 'onboarding', 'locales', `${locale}.json`);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`.replace(
    INVISIBLE_CHARACTERS_RE,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function readMessages(locale) {
  return readJson(messagesPath(locale), null);
}

function writeMessages(locale, messages) {
  writeJson(messagesPath(locale), messages);
}

function readOnboarding(locale) {
  return readJson(onboardingPath(locale), null);
}

function writeOnboarding(locale, translations) {
  writeJson(onboardingPath(locale), translations);
}

// The UI languages Lumno ships (ids are _locales folders), and those whose
// copy no native speaker has reviewed yet.
async function readUiLocales() {
  const { UI_LOCALES } = await importSource('src/domain/settings/locale.ts');
  return {
    ids: UI_LOCALES.map((entry) => entry.id),
    machineTranslated: UI_LOCALES.filter((entry) => entry.machineTranslated).map((entry) => entry.id)
  };
}

// The English onboarding strings every translated onboarding file follows,
// or the same strings in another locale written in onboarding-content.ts.
async function readOnboardingSource(locale = SOURCE_LOCALE) {
  const content = await importSource('src/onboarding/onboarding-content.ts');
  return content.getOnboardingTranslationSource(locale);
}

// The {name} tokens a string fills in at runtime.
function getTemplateTokens(value) {
  return (String(value).match(/\{[A-Za-z0-9_]+\}/g) || []).sort();
}

function countLineBreaks(value) {
  return (String(value).match(/\n/g) || []).length;
}

module.exports = {
  REPO_ROOT,
  SOURCE_LOCALE,
  REFERENCE_LOCALE,
  messagesPath,
  onboardingPath,
  readMessages,
  writeMessages,
  readOnboarding,
  writeOnboarding,
  readUiLocales,
  readOnboardingSource,
  getTemplateTokens,
  countLineBreaks
};
