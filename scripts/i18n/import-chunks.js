// Merges translated chunks back into the locale files:
//   node scripts/i18n/import-chunks.js <work-dir> [locale ...]
// Reads every <work-dir>/<locale>/out-NN.json written for export-chunks.js
// and writes _locales/<locale>/messages.json and, for AI-translated locales,
// src/onboarding/locales/<locale>.json, both in the English key order.
// Run scripts/check/check-locales.js afterwards.
const fs = require('fs');
const path = require('path');
const files = require('./locale-files');

async function main() {
  const uiLocales = await files.readUiLocales();
  const [workDir, ...requested] = process.argv.slice(2);
  if (!workDir) {
    console.error('Usage: node scripts/i18n/import-chunks.js <work-dir> [locale ...]');
    process.exit(1);
  }
  const locales = requested.length
    ? requested
    : fs.readdirSync(workDir).filter((name) => uiLocales.ids.includes(name));
  const sourceMessages = files.readMessages(files.SOURCE_LOCALE);
  const onboardingSource = await files.readOnboardingSource();
  let failed = false;

  locales.forEach((locale) => {
    const localeDir = path.join(workDir, locale);
    const chunkNames = fs.existsSync(localeDir)
      ? fs.readdirSync(localeDir).filter((name) => /^out-\d+\.json$/.test(name)).sort()
      : [];
    const translated = {};
    chunkNames.forEach((name) => {
      try {
        Object.assign(translated, JSON.parse(fs.readFileSync(path.join(localeDir, name), 'utf8')));
      } catch (error) {
        console.error(`${locale}/${name}: ${error.message}`);
        failed = true;
      }
    });

    const messages = files.readMessages(locale) || {};
    const nextMessages = {};
    Object.keys(sourceMessages).forEach((key) => {
      const text = translated[`m:${key}`];
      if (typeof text === 'string' && text.trim()) {
        nextMessages[key] = { message: text };
      } else if (messages[key]) {
        nextMessages[key] = messages[key];
      }
    });
    files.writeMessages(locale, nextMessages);

    let onboardingCount = 0;
    if (uiLocales.machineTranslated.includes(locale)) {
      const onboarding = files.readOnboarding(locale) || {};
      const nextOnboarding = {};
      Object.keys(onboardingSource).forEach((key) => {
        const text = translated[`o:${key}`];
        if (typeof text === 'string' && text.trim()) {
          nextOnboarding[key] = text;
        } else if (onboarding[key]) {
          nextOnboarding[key] = onboarding[key];
        }
      });
      files.writeOnboarding(locale, nextOnboarding);
      onboardingCount = Object.keys(nextOnboarding).length;
    }
    console.log(`${locale}: ${Object.keys(nextMessages).length}/${Object.keys(sourceMessages).length} messages, ` +
      `${onboardingCount}/${Object.keys(onboardingSource).length} onboarding strings ` +
      `(${chunkNames.length} chunk file(s))`);
  });
  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
