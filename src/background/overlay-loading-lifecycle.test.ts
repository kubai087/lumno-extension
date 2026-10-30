import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyInvocationResult,
  applySessionUpdate,
  applyTopFrameNavigationState,
  createRecord,
  createTopFrameNavigationState,
  decideRecovery,
  getPendingInjectableUrl,
  shouldDeferRestrictedLoadingTab,
  updateTopFrameNavigationState,
  type InjectionResult
} from './overlay-loading-lifecycle';
import { canOpenOverlayOnUrl } from '../platform/url-guards';
import { required } from '../../tests/fakes/dom';

// Whether an overlay opened while its tab loads comes back in the Document
// that replaces the loading one. How the worker uses these decisions on tab
// events is covered with the overlay open service.

const LOADING_TAB = { id: 42, status: 'loading', url: 'https://before.example/', pendingUrl: 'https://after.example/' };
const DRAFT = { inputValue: 'design inspiration', selectionStart: 7, selectionEnd: 18, selectionDirection: 'forward', focused: true };

// What the overlay probe answers in the tab's top frame.
const probe = (documentId: string, runtimeReady: boolean, overlayOpenState: string, overlayConnected: boolean): InjectionResult[] => [
  { frameId: 0, documentId, result: { runtimeReady, overlayOpenState, overlayConnected } }
];
const opened = (documentId: string): InjectionResult[] => [{ frameId: 0, documentId, result: { ok: true, overlayOpen: true } }];

// A record of an overlay opened in the loading Document, with a draft typed.
function openedWithDraft() {
  const opening = applyInvocationResult(createRecord(LOADING_TAB, 'commands', 1000), opened('doc-old'), 1100);
  const typed = applySessionUpdate(opening.record, DRAFT, { documentId: 'doc-old', now: 1150 });
  return { opening, typed };
}

describe('Top-frame navigation state', () => {
  const slow = required(createTopFrameNavigationState({ tabId: 54, frameId: 0, url: 'https://destination.example.test/slow' }, 900), 'the navigation state');
  const staleTab = { id: 54, status: 'complete', url: 'about:blank', pendingUrl: '' };

  it('records a top-frame navigation', () => {
    expect(slow).toEqual({ tabId: 54, url: 'https://destination.example.test/slow', startedAt: 900, updatedAt: 900 });
  });

  it('overrides the stale complete status tabs.query gives during a slow navigation, keeping the shortcut', () => {
    const resolved = applyTopFrameNavigationState(staleTab, slow, { now: 1000 });
    expect(resolved.status).toBe('loading');
    expect(resolved.pendingUrl).toBe('https://destination.example.test/slow');
    expect(shouldDeferRestrictedLoadingTab(resolved, canOpenOverlayOnUrl)).toBe(true);
    expect(createRecord(resolved, 'commands', 1000)).not.toBeNull();
  });

  it('leaves a later command alone once the navigation expired', () => {
    expect(applyTopFrameNavigationState(staleTab, slow, { now: 901000, ttlMs: 1000 })).toBe(staleTab);
  });

  it('never lets a subframe navigation claim the tab', () => {
    expect(createTopFrameNavigationState({ tabId: 54, frameId: 1, url: 'https://frame.example.test/' }, 900)).toBeNull();
  });

  it('follows a top-frame redirect at commit', () => {
    const committed = updateTopFrameNavigationState(slow, { tabId: 54, frameId: 0, url: 'https://destination.example.test/final' }, 1100);
    expect(committed?.url).toBe('https://destination.example.test/final');
  });
});

describe('Deferred injection into a loading tab', () => {
  it.each([
    ['a Google Auth navigation from about:blank', 'about:blank', 'https://accounts.google.com/o/oauth2/auth'],
    ['a Feishu navigation from the browser New Tab', 'chrome://newtab/', 'https://www.feishu.cn/'],
    ['an HTTP navigation from another Chromium internal page', 'edge://newtab/', 'http://intranet.example.test/dashboard'],
    ['an HTTPS navigation replacing an extension Document', 'chrome-extension://example/newtab.html', 'https://destination.example.test/path'],
    ['an HTTPS navigation before Chrome exposes a current URL', '', 'https://destination.example.test/early']
  ])('waits for %s to commit', (_name, url, pendingUrl) => {
    expect(getPendingInjectableUrl({ id: 43, status: 'loading', url, pendingUrl }, canOpenOverlayOnUrl)).toBe(pendingUrl);
  });

  it.each([
    ['about:blank before Chrome exposes the target', { id: 54, status: 'loading', url: 'about:blank', pendingUrl: '' }],
    ['the browser New Tab before Chrome exposes the target', { id: 55, status: 'loading', url: 'chrome://newtab/' }],
    ['a loading tab before Chrome exposes either URL', { id: 56, status: 'loading', url: '', pendingUrl: '' }]
  ])('keeps the shortcut for %s without inventing a target', (_name, tab) => {
    expect(getPendingInjectableUrl(tab, canOpenOverlayOnUrl)).toBe('');
    expect(shouldDeferRestrictedLoadingTab(tab, canOpenOverlayOnUrl)).toBe(true);
  });

  it.each([
    ['a protected browser target', 'loading', 'chrome://newtab/', 'chrome://settings/'],
    ['an extension target', 'loading', 'about:blank', 'chrome-extension://example/options.html'],
    ['the extension store', 'loading', 'about:blank', 'https://chromewebstore.google.com/detail/example/abc'],
    ['an unsupported protocol', 'loading', 'about:blank', 'mailto:hello@example.test'],
    ['an already injectable current Document', 'loading', 'https://before.example.test/', 'https://after.example.test/'],
    ['a completed restricted Document without a target', 'complete', 'about:blank', '']
  ])('keeps the ordinary behaviour for %s', (_name, status, url, pendingUrl) => {
    const tab = { id: 48, status, url, pendingUrl };
    expect(getPendingInjectableUrl(tab, canOpenOverlayOnUrl)).toBe('');
    expect(shouldDeferRestrictedLoadingTab(tab, canOpenOverlayOnUrl)).toBe(false);
  });
});

describe('Overlay loading record', () => {
  it('tracks a loading tab, also one whose HTTP(S) Document already committed, and not a completed one', () => {
    expect(createRecord(LOADING_TAB, 'commands', 1000)).not.toBeNull();
    expect(createRecord({ id: 41, status: 'loading', url: 'https://already-committed.example.test/', pendingUrl: '' }, 'commands', 1000)).not.toBeNull();
    expect(createRecord({ ...LOADING_TAB, status: 'complete', pendingUrl: '' }, 'commands', 1000)).toBeNull();
  });

  it('injects into a deferred target as soon as it commits, before loading completes', () => {
    const record = createRecord({ id: 43, status: 'loading', url: 'about:blank', pendingUrl: 'https://accounts.google.com/o/oauth2/auth' }, 'commands', 1000);
    expect(decideRecovery(record, probe('doc-auth', false, 'unknown', false), { now: 1050, complete: false }).action).toBe('restore');
  });

  it('carries the exact draft, selection and focus typed in the loading Document', () => {
    const { opening, typed } = openedWithDraft();
    expect(opening.action).toBe('keep');
    expect(opening.record?.documentId).toBe('doc-old');
    expect(typed.action).toBe('keep');
    expect(typed.record?.session).toEqual({ ...DRAFT, revision: 1, updatedAt: 1150 });
  });

  it('restores the overlay with its draft in the Document that replaced the loading one', () => {
    const { typed } = openedWithDraft();
    const committed = decideRecovery(typed.record, probe('doc-new', false, 'unknown', false), { now: 1200, complete: false });
    expect(committed.action).toBe('restore');
    expect(committed.reason).toBe('document-changed');
    expect(committed.record?.session).toEqual(typed.record?.session);

    // A late message from the replaced Document keeps the draft.
    const stale = applySessionUpdate(committed.record, { inputValue: 'stale draft', selectionStart: 11, selectionEnd: 11, focused: false },
      { documentId: 'doc-old', now: 1275 });
    expect(stale.reason).toBe('stale-document');
    expect(stale.record?.session).toEqual(typed.record?.session);
  });

  it('keeps tracking after the first completion so a chained navigation still restores, and clears once stable', () => {
    const { typed } = openedWithDraft();
    const committed = decideRecovery(typed.record, probe('doc-new', false, 'unknown', false), { now: 1200, complete: false });
    const restored = applyInvocationResult(committed.record, opened('doc-new'), 1300);
    const completed = decideRecovery(restored.record, probe('doc-new', true, 'open', true), { now: 1400, complete: true });
    expect(completed.action).toBe('keep');
    expect(completed.reason).toBe('complete-awaiting-stability');
    expect(completed.record?.session).toEqual(typed.record?.session);

    const chained = decideRecovery(completed.record, probe('doc-chained', false, 'unknown', false), { now: 1450, complete: false });
    expect(chained.action).toBe('restore');
    expect(chained.record?.session).toEqual(typed.record?.session);

    expect(decideRecovery(completed.record, probe('doc-new', true, 'open', true), { now: 3000, complete: true, stable: true }).action).toBe('clear');
  });

  it('does not reopen an overlay closed on purpose in the same Document', () => {
    const { opening } = openedWithDraft();
    expect(decideRecovery(opening.record, probe('doc-old', true, 'closed', false), { now: 1250, complete: true }).action).toBe('clear');
  });

  it('restores a host the page removed without closing it', () => {
    const { opening } = openedWithDraft();
    expect(decideRecovery(opening.record, probe('doc-old', true, 'open', false), { now: 1250, complete: false }).action).toBe('restore');
  });

  it('reads the closed flag of a replacement Document as no close of the old overlay', () => {
    const { opening } = openedWithDraft();
    expect(decideRecovery(opening.record, probe('doc-new', true, 'closed', false), { now: 1250, complete: false }).action).toBe('restore');
  });

  it('needs no permission beyond tabs', () => {
    const manifest: unknown = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));
    const permissions = typeof manifest === 'object' && manifest !== null && 'permissions' in manifest ? manifest.permissions : null;
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions).not.toContain('webNavigation');
  });
});
