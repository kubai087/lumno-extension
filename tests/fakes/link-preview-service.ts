// A link preview service over the worker fake: session rules kept in a map
// the way declarativeNetRequest keeps them, a screenshot for every capture,
// and a preview surface in each tab that answers as the test says.
import { createLinkPreviewService } from '../../src/background/link-preview/service';
import type { LinkPreviewServiceOptions } from '../../src/background/link-preview/types';
import { browserTab, installWorkerFake, settleWorker } from './worker';

type Rule = chrome.declarativeNetRequest.Rule;

const SCREENSHOT = 'data:image/jpeg;base64,AAAA';
const PREVIEW_FRAME_ID = 42;

interface SurfaceMessage extends Record<string, unknown> {
  action: string;
}

function isSurfaceMessage(value: unknown): value is SurfaceMessage {
  return typeof value === 'object' && value !== null && 'action' in value && typeof value.action === 'string';
}

interface PreviewHarnessOptions extends Omit<LinkPreviewServiceOptions, 'chromeApi'> {
  // The surface's answer to a message; true when it is left out.
  respond?: (message: SurfaceMessage) => unknown;
}

function createPreviewHarness(options: PreviewHarnessOptions = {}) {
  const fake = installWorkerFake();
  const rules = new Map<number, Rule>();
  let respond = options.respond || (() => true);
  const dnr = fake.chrome.declarativeNetRequest;
  dnr.updateSessionRules.mockImplementation((update, callback) => {
    (update.removeRuleIds || []).forEach((id) => rules.delete(id));
    (update.addRules || []).forEach((rule) => rules.set(rule.id, rule));
    if (callback) callback();
    return undefined;
  });
  dnr.getSessionRules.mockImplementation((callback) => {
    if (callback) callback(Array.from(rules.values()));
    return undefined;
  });
  fake.chrome.tabs.captureVisibleTab.mockImplementation((_windowId, optionsOrCallback, callback) => {
    const done = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
    if (done) done(SCREENSHOT);
    return undefined;
  });
  fake.chrome.tabs.sendMessage.mockImplementation((_tabId, message, optionsOrCallback, callback) => {
    const done = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
    if (done) done(isSurfaceMessage(message) ? respond(message) : undefined);
    return undefined;
  });
  fake.chrome.scripting.executeScript.mockImplementation((_injection, callback) => {
    if (callback) callback([{ result: undefined }]);
    return undefined;
  });
  const { respond: _respond, ...serviceOptions } = options;
  const service = createLinkPreviewService({ chromeApi: chrome, ...serviceOptions });
  const sent = () => fake.chrome.tabs.sendMessage.mock.calls
    .map(([tabId, message]) => ({ tabId, message: isSurfaceMessage(message) ? message : { action: '' } }));
  const tabRules = (tabId: number) => Array.from(rules.values())
    .filter((rule) => (rule.condition.tabIds || []).includes(tabId));
  const frameSender = (tabId: number, url: string, frameId = PREVIEW_FRAME_ID) => ({ tab: browserTab({ id: tabId, windowId: 1 }), frameId, url });
  // The secret the surface was handed for the tab's preview.
  const prewarmSecret = (tabId: number) => {
    const prewarms = sent().filter((entry) => entry.tabId === tabId && entry.message.action === 'lumnoLinkPreviewPrewarm');
    return prewarms[prewarms.length - 1].message.frameSecret;
  };
  return {
    fake,
    service,
    rules,
    sent,
    tabRules,
    frameSender,
    prewarmSecret,
    setRespond(next: (message: SurfaceMessage) => unknown) {
      respond = next;
    },
    hasTabRules: (tabId: number) => tabRules(tabId).length > 0,
    allowedDomains(tabId: number): string[] {
      const [rule] = tabRules(tabId);
      return rule ? (rule.condition.requestDomains || []).slice().sort() : [];
    },
    // The preview frame binding with its secret, as the surface's frame would.
    bindPreviewFrame: (tabId: number, url: string) => service.bindFrame(frameSender(tabId, url), prewarmSecret(tabId)),
    created: () => fake.chrome.tabs.create.mock.calls.map(([properties]) => properties),
    captures: () => fake.chrome.tabs.captureVisibleTab.mock.calls.length,
    injections: () => fake.chrome.scripting.executeScript.mock.calls.map(([injection]) => injection),
    flush: () => settleWorker(5)
  };
}

// The surface answering true to everything but the overrides.
function surfaceResponder(overrides: Record<string, unknown> = {}) {
  return (message: SurfaceMessage) => (Object.hasOwn(overrides, message.action) ? overrides[message.action] : true);
}

type PreviewHarness = ReturnType<typeof createPreviewHarness>;

export { PREVIEW_FRAME_ID, SCREENSHOT, createPreviewHarness, surfaceResponder };
export type { PreviewHarness, SurfaceMessage };
