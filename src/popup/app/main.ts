// The toolbar popup's entry, an ES module that runs once the markup is
// parsed: it reads the settings, the page facts and the language together,
// then draws the popup once; from there the view follows its stores.
import * as LocaleSettings from '../../domain/settings/locale';
import * as PageCacheSettings from '../../domain/settings/page-cache';
import { getContextSettingsStore } from '../../platform/settings-store';
import { isElementTextTruncated } from '../../shared/react/text-overflow';
import * as LumnoCursorTooltip from '../../shared/ui/cursor-tooltip';
import * as LumnoTooltip from '../../shared/ui/tooltip';
import { isHtmlElement } from '../../shared/dom-guards';
import { PopupActions } from '../actions';
import { createPopupPorts } from '../browser';
import { PopupToast } from '../dom/toast';
import { loadPopupLocale } from '../locale';
import { loadPageFacts } from '../page-facts';
import { followOverflow, followTheme, syncOverflow } from './document-state';
import { POPUP_READ_SETTINGS, mountPopup } from './root';
import type { PopupTooltips } from './root';
import { PortalHost } from '../../shared/react/portal-host';

// Lumno's tooltip for the controls, and the cursor tooltip that shows a
// page title or address cut short in full beside the pointer.
function createTooltips(doc: Document, win: Window, portals: PortalHost): PopupTooltips {
  const tooltip = LumnoTooltip.createController({
    portals,
    documentObj: doc,
    windowObj: win,
    id: 'x-lumno-popup-tooltip',
    appendTo: doc.body,
    maxWidth: 272
  });
  const cursorTooltip = LumnoCursorTooltip.createController({
    portals,
    documentObj: doc,
    windowObj: win,
    id: 'x-lumno-popup-cursor-tooltip',
    appendTo: doc.body,
    maxWidth: 280,
    offsetX: 12,
    offsetY: 16
  });
  return {
    onShowTooltip: (target, text) => tooltip.show(target, text, { placement: 'top' }),
    onHideTooltip: () => tooltip.hide(),
    bindTruncationTooltip(element) {
      cursorTooltip.bind(element, () => (element ? element.textContent || '' : ''), {
        shouldShow: (target) => isElementTextTruncated(target)
      });
    }
  };
}

async function start(chromeApi: typeof chrome, host: HTMLElement): Promise<void> {
  const doc = window.document;
  const settingsStore = getContextSettingsStore(chromeApi, globalThis);
  const settingsLoaded = settingsStore.include([
    ...POPUP_READ_SETTINGS,
    LocaleSettings.language,
    PageCacheSettings.optionsThemePreload
  ]);
  const localeLoaded = settingsLoaded.then(() => (
    loadPopupLocale(chromeApi, settingsStore.get(LocaleSettings.language))
  ));
  const [facts, locale] = await Promise.all([loadPageFacts(chromeApi), localeLoaded]);
  doc.documentElement.lang = locale.lang;
  followTheme(settingsStore, doc, window);
  const portals = new PortalHost(host);
  mountPopup(portals, host, {
    facts,
    locale,
    settingsStore,
    actions: new PopupActions(createPopupPorts(chromeApi, window), facts, locale.t, new PopupToast(doc, window)),
    tooltips: createTooltips(doc, window, portals),
    onRendered: () => {
      window.requestAnimationFrame(() => syncOverflow(doc, window));
    }
  });
  followOverflow(host, doc, window);
}

const chromeApi = globalThis.chrome;
const host = document.getElementById('x-lumno-popup-root');
if (chromeApi && isHtmlElement(host)) {
  start(chromeApi, host).catch((error) => {
    console.error('[Lumno] The popup failed to start.', error);
  });
}
