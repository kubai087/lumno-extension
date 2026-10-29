// Sending runtime messages by the protocol in domain/messages.ts. Each call
// forwards to the extension API as it is, so callbacks run at the same time
// and runtime.lastError reads the same; only the request and reply types
// come from the protocol.
import type {
  BackgroundAction,
  BackgroundReply,
  BackgroundRequest,
  PageAction,
  PageReply,
  PageRequest
} from '../domain/messages';

// chrome.runtime, or a page's injected stand-in for it. The reply type is
// the sender's to name, as in the extension API.
interface MessageRuntime {
  sendMessage<R>(message: unknown, responseCallback: (response: R) => void): unknown;
  sendMessage(message: unknown): unknown;
}

// chrome.tabs.
interface MessageTabs {
  sendMessage<R>(tabId: number, message: unknown, responseCallback: (response: R) => void): unknown;
  sendMessage<R>(tabId: number, message: unknown, options: { frameId?: number }, responseCallback: (response: R) => void): unknown;
  sendMessage(tabId: number, message: unknown): unknown;
}

// Sends a message to the background. Without a callback the API's own
// return value comes back (a promise in Manifest V3), as from the API.
// The reply is undefined when no handler answered; runtime.lastError then
// says why.
function sendBackgroundMessage<A extends BackgroundAction>(
  runtime: MessageRuntime,
  request: BackgroundRequest<A>,
  callback?: (reply: BackgroundReply<A> | undefined) => void
): unknown {
  return callback ? runtime.sendMessage(request, callback) : runtime.sendMessage(request);
}

// Sends a message to the extension's own pages (a New Tab, onboarding).
function sendPageMessage<A extends PageAction>(
  runtime: MessageRuntime,
  request: PageRequest<A>,
  callback?: (reply: PageReply<A> | undefined) => void
): unknown {
  return callback ? runtime.sendMessage(request, callback) : runtime.sendMessage(request);
}

// Sends a message to a tab's content scripts, or only those of one frame.
function sendTabMessage<A extends PageAction>(
  tabs: MessageTabs,
  tabId: number,
  request: PageRequest<A>,
  callback?: (reply: PageReply<A> | undefined) => void,
  options?: { frameId?: number }
): unknown {
  if (!callback) {
    return tabs.sendMessage(tabId, request);
  }
  return options ? tabs.sendMessage(tabId, request, options, callback) : tabs.sendMessage(tabId, request, callback);
}

// Sends a message to the background from an extension page through its own
// chrome.runtime; false when there is none or sending threw.
function trySendBackgroundMessage<A extends BackgroundAction>(
  request: BackgroundRequest<A>,
  callback?: (reply: BackgroundReply<A> | undefined) => void
): boolean {
  if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    return false;
  }
  try {
    sendBackgroundMessage(chrome.runtime, request, callback);
    return true;
  } catch {
    return false;
  }
}

export { sendBackgroundMessage, sendPageMessage, sendTabMessage, trySendBackgroundMessage };
export type { MessageRuntime, MessageTabs };
