// The onboarding's slides in the reader's language: the link's locale or
// lang parameter, else the stored language, else the browser's. A translated
// language's copy ships as JSON beside the page; without it the page falls
// back to English.
import * as LumnoSettings from '../../domain/settings/locale';
import { getContextSettingsStore } from '../../platform/settings-store';
import * as MODEL from '../onboarding-content';
import type { OnboardingBlueprint } from '../onboarding-content';

// The browser's language; outside the extension, the navigator's.
function getBrowserLocale(): string {
  try {
    return (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language || 'en';
  } catch (error) {
    return navigator.language || 'en';
  }
}

function readLocale(params: URLSearchParams): Promise<string> {
  const fromParam = params.get('locale') || params.get('lang') || '';
  if (fromParam) {
    return Promise.resolve(MODEL.normalizeLocale(fromParam));
  }
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return Promise.resolve(MODEL.normalizeLocale(getBrowserLocale()));
  }
  const settingsStore = getContextSettingsStore(chrome);
  return settingsStore.include(LumnoSettings.language).then(() => {
    const stored = settingsStore.get(LumnoSettings.language);
    return MODEL.normalizeLocale(stored !== 'system' ? stored : getBrowserLocale());
  });
}

function loadLocaleText(locale: string): Promise<void> {
  if (!MODEL.needsOnboardingLocaleText(locale) || typeof fetch !== 'function') {
    return Promise.resolve();
  }
  return fetch(`locales/${locale}.json`)
    .then((response) => response.json())
    .then((translations: unknown) => MODEL.registerOnboardingLocaleText(locale, translations))
    .catch(() => {});
}

function loadOnboardingBlueprint(params: URLSearchParams): Promise<OnboardingBlueprint> {
  return readLocale(params).then((locale) => loadLocaleText(locale).then(() => MODEL.getOnboardingBlueprint(locale)));
}

export { loadOnboardingBlueprint };
