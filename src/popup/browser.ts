// The browser calls the popup makes, as promises that settle on every
// failure: a missing API, a thrown call or a lastError all give the empty
// answer instead of rejecting. The actions reach the browser only through
// PopupPorts, so tests run them against stand-ins.
import * as LumnoMessaging from '../platform/messaging';
import type { BackgroundAction, BackgroundReply, BackgroundRequest } from '../domain/messages';
import { isRecord } from './model';

// The worker's reply, or null when it did not answer.
function sendMessage<A extends BackgroundAction>(
  chromeApi: typeof chrome,
  payload: BackgroundRequest<A>
): Promise<BackgroundReply<A> | null> {
  return new Promise((resolve) => {
    try {
      LumnoMessaging.sendBackgroundMessage(chromeApi.runtime, payload, (reply) => {
        resolve(chromeApi.runtime.lastError || reply === undefined ? null : reply);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

function queryActiveTab(chromeApi: typeof chrome): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    try {
      chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(!chromeApi.runtime.lastError && tabs[0] ? tabs[0] : null);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

function readCommands(chromeApi: typeof chrome): Promise<chrome.commands.Command[]> {
  return new Promise((resolve) => {
    // Not every browser has the commands API.
    if (!chromeApi.commands || typeof chromeApi.commands.getAll !== 'function') {
      resolve([]);
      return;
    }
    try {
      chromeApi.commands.getAll((commands) => {
        resolve(chromeApi.runtime.lastError ? [] : commands);
      });
    } catch (error) {
      resolve([]);
    }
  });
}

// A function run in the tab, in the page's own world or the extension's.
type ScriptDetails = { func: () => unknown; world?: `${chrome.scripting.ExecutionWorld}` };

// The script's result when it is an object; null otherwise.
function executeInTab(
  chromeApi: typeof chrome,
  tabId: number,
  details: ScriptDetails
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    try {
      chromeApi.scripting.executeScript({ target: { tabId }, ...details }, (results) => {
        const first = !chromeApi.runtime.lastError && Array.isArray(results) ? results[0] : null;
        const result: unknown = first ? first.result : null;
        resolve(isRecord(result) ? result : null);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

// What the popup's actions need from the browser.
interface PopupPorts {
  sendMessage<A extends BackgroundAction>(payload: BackgroundRequest<A>): Promise<BackgroundReply<A> | null>;
  executeInTab(tabId: number, details: ScriptDetails): Promise<Record<string, unknown> | null>;
  writeClipboard(text: string): Promise<void>;
  closePopup(): void;
}

function createPopupPorts(chromeApi: typeof chrome, win: Window): PopupPorts {
  return {
    sendMessage: (payload) => sendMessage(chromeApi, payload),
    executeInTab: (tabId, details) => executeInTab(chromeApi, tabId, details),
    writeClipboard: (text) => win.navigator.clipboard.writeText(text),
    closePopup: () => win.close()
  };
}

export { createPopupPorts, executeInTab, queryActiveTab, readCommands, sendMessage };
export type { PopupPorts, ScriptDetails };
