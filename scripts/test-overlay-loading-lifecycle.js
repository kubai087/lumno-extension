const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const lifecycle = require(path.join(
  __dirname,
  '..',
  'src',
  'background',
  'overlay-loading-lifecycle.js'
));

const urlGuardSandbox = { URL };
urlGuardSandbox.globalThis = urlGuardSandbox;
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'shared', 'url-guards.js'), 'utf8'),
  urlGuardSandbox,
  { filename: 'src/shared/url-guards.js' }
);
const canInjectOverlayUrl = urlGuardSandbox.LumnoUrlGuards.canOpenOverlayOnUrl;

const loadingTab = {
  id: 42,
  status: 'loading',
  url: 'https://before.example/',
  pendingUrl: 'https://after.example/'
};
const initialRecord = lifecycle.createRecord(loadingTab, 'commands', 1000);

const slowNavigationState = lifecycle.createTopFrameNavigationState({
  tabId: 54,
  frameId: 0,
  url: 'https://destination.example.test/slow'
}, 900);
assert.deepStrictEqual(slowNavigationState, {
  tabId: 54,
  url: 'https://destination.example.test/slow',
  startedAt: 900,
  updatedAt: 900
});
const staleCommandTabDuringNavigation = {
  id: 54,
  status: 'complete',
  url: 'about:blank',
  pendingUrl: ''
};
const resolvedCommandTabDuringNavigation = lifecycle.applyTopFrameNavigationState(
  staleCommandTabDuringNavigation,
  slowNavigationState,
  { now: 1000 }
);
assert.strictEqual(
  resolvedCommandTabDuringNavigation.status,
  'loading',
  'a top-frame navigation event should override stale complete status from tabs.query'
);
assert.strictEqual(
  resolvedCommandTabDuringNavigation.pendingUrl,
  'https://destination.example.test/slow',
  'the navigation event should supply the target Chrome omitted from pendingUrl'
);
assert.strictEqual(
  lifecycle.shouldDeferRestrictedLoadingTab(
    resolvedCommandTabDuringNavigation,
    canInjectOverlayUrl
  ),
  true,
  'the exact about:blank slow-navigation race should retain the shortcut intent'
);
assert.ok(
  lifecycle.createRecord(resolvedCommandTabDuringNavigation, 'commands', 1000),
  'the exact slow-navigation race should create a recoverable loading record'
);
assert.strictEqual(
  lifecycle.applyTopFrameNavigationState(
    staleCommandTabDuringNavigation,
    slowNavigationState,
    { now: 901000, ttlMs: 1000 }
  ),
  staleCommandTabDuringNavigation,
  'an expired navigation event must not affect a later command'
);
assert.strictEqual(
  lifecycle.createTopFrameNavigationState({
    tabId: 54,
    frameId: 1,
    url: 'https://frame.example.test/'
  }, 900),
  null,
  'subframe navigation must never claim the tab-level shortcut intent'
);
const committedSlowNavigationState = lifecycle.updateTopFrameNavigationState(
  slowNavigationState,
  {
    tabId: 54,
    frameId: 0,
    url: 'https://destination.example.test/final'
  },
  1100
);
assert.strictEqual(
  committedSlowNavigationState.url,
  'https://destination.example.test/final',
  'the tracked target should follow a top-frame redirect at commit'
);
assert.ok(
  lifecycle.createRecord({
    id: 41,
    status: 'loading',
    url: 'https://already-committed.example.test/',
    pendingUrl: ''
  }, 'commands', 1000),
  'an already committed HTTP(S) Document should still be tracked until loading completes'
);

const injectablePendingNavigationCases = [
  {
    name: 'reported Google Auth navigation from about:blank',
    tab: {
      id: 43,
      status: 'loading',
      url: 'about:blank',
      pendingUrl: 'https://accounts.google.com/o/oauth2/auth'
    }
  },
  {
    name: 'reported Feishu navigation from the browser New Tab',
    tab: {
      id: 44,
      status: 'loading',
      url: 'chrome://newtab/',
      pendingUrl: 'https://www.feishu.cn/'
    }
  },
  {
    name: 'ordinary HTTP navigation from another Chromium internal page',
    tab: {
      id: 45,
      status: 'loading',
      url: 'edge://newtab/',
      pendingUrl: 'http://intranet.example.test/dashboard'
    }
  },
  {
    name: 'ordinary HTTPS navigation replacing an extension Document',
    tab: {
      id: 46,
      status: 'loading',
      url: 'chrome-extension://example/src/newtab/newtab.html',
      pendingUrl: 'https://destination.example.test/path'
    }
  },
  {
    name: 'ordinary HTTPS navigation before Chrome exposes a current URL',
    tab: {
      id: 47,
      status: 'loading',
      url: '',
      pendingUrl: 'https://destination.example.test/early'
    }
  }
];

injectablePendingNavigationCases.forEach(({ name, tab }) => {
  assert.strictEqual(
    lifecycle.getPendingInjectableUrl(tab, canInjectOverlayUrl),
    tab.pendingUrl,
    `${name} should use the shared deferred-injection rule`
  );
});

const unknownPendingNavigationCases = [
  {
    name: 'about:blank before Chrome exposes the target URL',
    tab: {
      id: 54,
      status: 'loading',
      url: 'about:blank',
      pendingUrl: ''
    }
  },
  {
    name: 'browser New Tab before Chrome exposes the target URL',
    tab: {
      id: 55,
      status: 'loading',
      url: 'chrome://newtab/'
    }
  },
  {
    name: 'loading tab before Chrome exposes either URL',
    tab: {
      id: 56,
      status: 'loading',
      url: '',
      pendingUrl: ''
    }
  }
];

unknownPendingNavigationCases.forEach(({ name, tab }) => {
  assert.strictEqual(
    lifecycle.getPendingInjectableUrl(tab, canInjectOverlayUrl),
    '',
    `${name} should not invent a target URL`
  );
  assert.strictEqual(
    lifecycle.shouldDeferRestrictedLoadingTab(tab, canInjectOverlayUrl),
    true,
    `${name} should preserve the shortcut until the same tab commits`
  );
});

const nonDeferredNavigationCases = [
  {
    name: 'protected browser target',
    tab: {
      id: 48,
      status: 'loading',
      url: 'chrome://newtab/',
      pendingUrl: 'chrome://settings/'
    }
  },
  {
    name: 'browser extension target',
    tab: {
      id: 49,
      status: 'loading',
      url: 'about:blank',
      pendingUrl: 'chrome-extension://example/options.html'
    }
  },
  {
    name: 'browser extension-store target',
    tab: {
      id: 50,
      status: 'loading',
      url: 'about:blank',
      pendingUrl: 'https://chromewebstore.google.com/detail/example/abc'
    }
  },
  {
    name: 'unsupported protocol target',
    tab: {
      id: 51,
      status: 'loading',
      url: 'about:blank',
      pendingUrl: 'mailto:hello@example.test'
    }
  },
  {
    name: 'already injectable current Document',
    tab: {
      id: 52,
      status: 'loading',
      url: 'https://before.example.test/',
      pendingUrl: 'https://after.example.test/'
    }
  },
  {
    name: 'completed restricted Document without a pending target',
    tab: {
      id: 53,
      status: 'complete',
      url: 'about:blank',
      pendingUrl: ''
    }
  }
];

nonDeferredNavigationCases.forEach(({ name, tab }) => {
  assert.strictEqual(
    lifecycle.getPendingInjectableUrl(tab, canInjectOverlayUrl),
    '',
    `${name} should retain the ordinary restricted/current-Document behavior`
  );
  assert.strictEqual(
    lifecycle.shouldDeferRestrictedLoadingTab(tab, canInjectOverlayUrl),
    false,
    `${name} should not create an unknown navigation intent`
  );
});

assert.ok(initialRecord, 'a loading tab should keep a temporary Overlay-open intent');
assert.strictEqual(
  lifecycle.createRecord({ ...loadingTab, status: 'complete', pendingUrl: '' }, 'commands', 1000),
  null,
  'a completed tab should not create loading-persistence state'
);

const provisionalRecord = lifecycle.createRecord({
  id: 43,
  status: 'loading',
  url: 'about:blank',
  pendingUrl: 'https://accounts.google.com/o/oauth2/auth'
}, 'commands', 1000);
const committedProvisionalTarget = lifecycle.decideRecovery(provisionalRecord, [{
  frameId: 0,
  documentId: 'doc-auth',
  result: {
    runtimeReady: false,
    overlayOpenState: 'unknown',
    overlayConnected: false
  }
}], { now: 1050, complete: false });
assert.strictEqual(
  committedProvisionalTarget.action,
  'restore',
  'committing a deferred target should request injection before loading completes'
);

const openedInOldDocument = lifecycle.applyInvocationResult(initialRecord, [{
  frameId: 0,
  documentId: 'doc-old',
  result: { ok: true, overlayOpen: true }
}], 1100);
assert.strictEqual(openedInOldDocument.action, 'keep');
assert.strictEqual(openedInOldDocument.record.documentId, 'doc-old');

const typedInOldDocument = lifecycle.applySessionUpdate(
  openedInOldDocument.record,
  {
    inputValue: 'design inspiration',
    selectionStart: 7,
    selectionEnd: 18,
    selectionDirection: 'forward',
    focused: true
  },
  { documentId: 'doc-old', now: 1150 }
);
assert.strictEqual(typedInOldDocument.action, 'keep');
assert.deepStrictEqual(
  typedInOldDocument.record.session,
  {
    inputValue: 'design inspiration',
    selectionStart: 7,
    selectionEnd: 18,
    selectionDirection: 'forward',
    focused: true,
    revision: 1,
    updatedAt: 1150
  },
  'the loading record should carry the exact draft, selection, and focus state'
);

const committedDocument = lifecycle.decideRecovery(typedInOldDocument.record, [{
  frameId: 0,
  documentId: 'doc-new',
  result: {
    runtimeReady: false,
    overlayOpenState: 'unknown',
    overlayConnected: false
  }
}], { now: 1200, complete: false });
assert.strictEqual(
  committedDocument.action,
  'restore',
  'a newly committed Document should restore the Overlay that was open during loading'
);
assert.strictEqual(committedDocument.reason, 'document-changed');
assert.deepStrictEqual(
  committedDocument.record.session,
  typedInOldDocument.record.session,
  'committing a replacement Document must retain the live input session'
);

const staleOldDocumentUpdate = lifecycle.applySessionUpdate(
  committedDocument.record,
  {
    inputValue: 'stale draft',
    selectionStart: 11,
    selectionEnd: 11,
    focused: false
  },
  { documentId: 'doc-old', now: 1275 }
);
assert.strictEqual(staleOldDocumentUpdate.reason, 'stale-document');
assert.deepStrictEqual(
  staleOldDocumentUpdate.record.session,
  typedInOldDocument.record.session,
  'a late message from the replaced Document must not overwrite the retained draft'
);

const restoredInNewDocument = lifecycle.applyInvocationResult(committedDocument.record, [{
  frameId: 0,
  documentId: 'doc-new',
  result: { ok: true, overlayOpen: true }
}], 1300);
const completedInNewDocument = lifecycle.decideRecovery(restoredInNewDocument.record, [{
  frameId: 0,
  documentId: 'doc-new',
  result: {
    runtimeReady: true,
    overlayOpenState: 'open',
    overlayConnected: true
  }
}], { now: 1400, complete: true });
assert.strictEqual(
  completedInNewDocument.action,
  'clear',
  'completion in the restored Document should only clear tracking, never toggle the Overlay again'
);

const intentionallyClosed = lifecycle.decideRecovery(openedInOldDocument.record, [{
  frameId: 0,
  documentId: 'doc-old',
  result: {
    runtimeReady: true,
    overlayOpenState: 'closed',
    overlayConnected: false
  }
}], { now: 1250, complete: true });
assert.strictEqual(
  intentionallyClosed.action,
  'clear',
  'an intentional close in the same Document must not be reopened at load completion'
);

const detachedHost = lifecycle.decideRecovery(openedInOldDocument.record, [{
  frameId: 0,
  documentId: 'doc-old',
  result: {
    runtimeReady: true,
    overlayOpenState: 'open',
    overlayConnected: false
  }
}], { now: 1250, complete: false });
assert.strictEqual(
  detachedHost.action,
  'restore',
  'a page-side DOM replacement should restore an Overlay host that disappeared without closing'
);

const closedStateInNewDocument = lifecycle.decideRecovery(openedInOldDocument.record, [{
  frameId: 0,
  documentId: 'doc-new',
  result: {
    runtimeReady: true,
    overlayOpenState: 'closed',
    overlayConnected: false
  }
}], { now: 1250, complete: false });
assert.strictEqual(
  closedStateInNewDocument.action,
  'restore',
  'a default closed flag in a replacement Document is not an intentional close of the old Overlay'
);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
assert.ok(
  Array.isArray(manifest.permissions) && !manifest.permissions.includes('webNavigation'),
  'loading intent tracking should reuse the existing tabs permission'
);
const backgroundSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'background', 'background.js'),
  'utf8'
);
assert.ok(
  backgroundSource.includes("if (changeInfo.status === 'loading') {\n      rememberOverlayTopFrameNavigation({"),
  'the tabs loading event should be recorded independently of the stale tabs.query snapshot'
);
assert.ok(
  backgroundSource.includes('const cachedNavigationState = overlayNavigationStateByTabId.get(tab.id) || null;'),
  'shortcut dispatch should merge the navigation event with the stale tabs.query snapshot'
);
assert.ok(
  backgroundSource.includes("if (changeInfo.status === 'complete') {\n      clearOverlayNavigationState(tabId);"),
  'the transient navigation state should be cleared when that tab finishes loading'
);

console.log('overlay loading lifecycle tests passed');
