// Writes the strings a locale is missing as translation chunks:
//   node scripts/i18n/export-chunks.js <work-dir> [locale ...]
// Each <work-dir>/<locale>/in-NN.json maps an id ("m:<message key>" or
// "o:<onboarding path>") to { en, zh } (zh is the Simplified Chinese the
// copy was written in, when there is one). A translator writes the same ids
// to out-NN.json, mapped to the translated string, and import-chunks.js
// merges them back. With no locales given, every AI-translated locale is
// exported.
const fs = require('fs');
const path = require('path');
const files = require('./locale-files');

const CHUNK_SIZE = 150;

async function main() {
  const uiLocales = await files.readUiLocales();
  const [workDir, ...requested] = process.argv.slice(2);
  if (!workDir) {
    console.error('Usage: node scripts/i18n/export-chunks.js <work-dir> [locale ...]');
    process.exit(1);
  }
  const locales = requested.length ? requested : uiLocales.machineTranslated;
  const unknown = locales.filter((locale) => !uiLocales.ids.includes(locale));
  if (unknown.length) {
    console.error(`Not in UI_LOCALES: ${unknown.join(', ')}`);
    process.exit(1);
  }
  const sourceMessages = files.readMessages(files.SOURCE_LOCALE);
  const referenceMessages = files.readMessages(files.REFERENCE_LOCALE);
  const onboardingSource = await files.readOnboardingSource();
  const onboardingReference = await files.readOnboardingSource(files.REFERENCE_LOCALE);

  locales.forEach((locale) => {
    const messages = files.readMessages(locale) || {};
    const entries = [];
    Object.keys(sourceMessages).forEach((key) => {
      if (!messages[key] || !String(messages[key].message || '').trim()) {
        const zh = referenceMessages[key] && referenceMessages[key].message;
        entries.push([`m:${key}`, { en: sourceMessages[key].message, ...(zh ? { zh } : {}) }]);
      }
    });
    if (uiLocales.machineTranslated.includes(locale)) {
      const onboarding = files.readOnboarding(locale) || {};
      Object.keys(onboardingSource).forEach((key) => {
        if (!String(onboarding[key] || '').trim()) {
          const zh = onboardingReference[key];
          entries.push([`o:${key}`, { en: onboardingSource[key], ...(zh ? { zh } : {}) }]);
        }
      });
    }
    const localeDir = path.join(workDir, locale);
    fs.mkdirSync(localeDir, { recursive: true });
    for (let start = 0; start < entries.length; start += CHUNK_SIZE) {
      const name = `in-${String(start / CHUNK_SIZE + 1).padStart(2, '0')}.json`;
      fs.writeFileSync(
        path.join(localeDir, name),
        `${JSON.stringify(Object.fromEntries(entries.slice(start, start + CHUNK_SIZE)), null, 2)}\n`
      );
    }
    console.log(`${locale}: ${entries.length} strings in ${Math.ceil(entries.length / CHUNK_SIZE)} chunk(s)`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
