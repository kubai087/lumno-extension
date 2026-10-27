// Asks open New Tab pages to redraw a part of themselves after a setting
// they draw from changed here. No New Tab may be open to answer.
import * as LumnoMessaging from '../../platform/messaging';

function notifyNewtab(section: string): void {
  if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    return;
  }
  try {
    LumnoMessaging.sendPageMessage(chrome.runtime, { action: 'lumno:newtab-refresh-sections', section: section || 'all' }, () => {
      // An unanswered message leaves runtime.lastError set; nothing else to do.
      void chrome.runtime.lastError;
    });
  } catch (error) {
    // The worker may be restarting; the next change asks again.
  }
}

export { notifyNewtab };
