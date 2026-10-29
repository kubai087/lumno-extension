// The runtime instances every New Tab feature takes: the settings store and
// the dragged sliders' preview, the language, the page's root and sections,
// and the storage the settings live in.
import type { SettingsStore } from '../../platform/settings-store';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { StartupStorage } from '../startup-storage';
import type { PageStructureRuntime } from '../react/page-structure';
import type { SettingPreview } from '../setting-preview';

interface PageContext {
  settings: SettingsStore;
  preview: SettingPreview;
  locale: SurfaceLocale;
  t: SurfaceLocale['t'];
  formatMessage: SurfaceLocale['formatMessage'];
  root: HTMLElement;
  structure: PageStructureRuntime;
  providerStorageRuntime: StartupStorage['providerStorageRuntime'];
  storageArea: StartupStorage['storageArea'];
  localStorageArea: StartupStorage['storageArea'];
}

export type { PageContext };
