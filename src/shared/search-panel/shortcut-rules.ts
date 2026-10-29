// The browser shortcut rules (assets/data/shortcut-rules.json): words that
// open a browser page or a site, or narrow search to one source. They are
// read once per page, through the worker when this page's copy of the
// extension cannot fetch its own files.
import type { ShortcutRule } from '../../domain/messages';
import { readShortcutRules } from '../../domain/shortcut-rules-reader';
import * as LumnoMessaging from '../../platform/messaging';

let loadedRules: ShortcutRule[] | undefined;
let pendingRules: Promise<ShortcutRule[]> | undefined;

function loadShortcutRules(): Promise<ShortcutRule[]> {
  if (loadedRules) {
    return Promise.resolve(loadedRules);
  }
  if (!pendingRules) {
    pendingRules = fetch(chrome.runtime.getURL('assets/data/shortcut-rules.json'))
      .then((response) => response.json())
      .then((data: unknown) => readShortcutRules(data))
      .catch(() => new Promise<ShortcutRule[]>((resolve) => {
        try {
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getShortcutRules' }, (response) => {
            resolve(readShortcutRules(response));
          });
        } catch {
          resolve([]);
        }
      }))
      .then((rules) => {
        loadedRules = rules;
        return rules;
      });
  }
  return pendingRules;
}

// The rules once loaded; undefined before.
function getLoadedShortcutRules(): ShortcutRule[] | undefined {
  return loadedRules;
}

export { getLoadedShortcutRules, loadShortcutRules };
