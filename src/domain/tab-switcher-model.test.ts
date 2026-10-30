import { describe, expect, it } from 'vitest';
import type { TabSwitcherItem } from './messages';
import { tabSwitcherThumbnail } from './settings/features';
import {
  getDefaultSwitcherSelectedIndex,
  getFailedOpenTabSwitcherState,
  getSwitcherRegistrableThemeHost,
  getSwitcherThemeHostCandidates,
  getSwitcherThumbnailStatusForFailureReason,
  getTabSwitcherHeadSignature,
  getTabSwitcherThumbnailStorageKey,
  getThumbnailPersistSignature,
  isSwitcherThumbnailRefreshNeeded,
  normalizeOpenTabSwitcherStateResponse,
  normalizeOpenTabSwitcherStateScriptResults,
  normalizeTabSwitcherCommitResponse,
  normalizeTabSwitcherCommitScriptResults,
  normalizeTabSwitcherHostOkResponse,
  normalizeTabSwitcherHostOkScriptResults,
  readScriptResults,
  readTabSwitcherThumbnailStatus
} from './tab-switcher-model';

function item(id: number): TabSwitcherItem {
  return {
    id, windowId: 1, url: '', title: '', favIconUrl: '', accentRgb: null, active: false, pinned: false,
    current: false, thumbnail: '', thumbnailStatus: '', thumbnailReason: ''
  };
}

describe('tab switcher model', () => {
  const items = [10, 11, 12, 13].map(item);

  it('opens forward on the tab used before the current one', () => {
    expect(getDefaultSwitcherSelectedIndex(items, 10, 1)).toBe(1);
    expect(getDefaultSwitcherSelectedIndex(items, 12, 1)).toBe(2);
    expect(getDefaultSwitcherSelectedIndex(items, 99, 1)).toBe(0);
    expect(getDefaultSwitcherSelectedIndex([item(10)], 10, 1)).toBe(0);
    expect(getDefaultSwitcherSelectedIndex(items, undefined, 1)).toBe(0);
  });

  it('opens in reverse on the oldest tab, wrapping back from the current one', () => {
    expect(getDefaultSwitcherSelectedIndex(items, 10, -1)).toBe(3);
    expect(getDefaultSwitcherSelectedIndex(items, 12, -1)).toBe(1);
    expect(getDefaultSwitcherSelectedIndex(items, 99, -1)).toBe(3);
  });

  it('reads the replies of the page', () => {
    expect(normalizeTabSwitcherHostOkResponse({ ok: true })).toBe(true);
    expect(normalizeTabSwitcherHostOkResponse({ ok: 'yes' })).toBeNull();
    expect(normalizeTabSwitcherCommitResponse({ ok: true, committed: false })).toBe(false);
    expect(normalizeTabSwitcherCommitResponse({ ok: true })).toBeNull();
    expect(normalizeOpenTabSwitcherStateResponse({ ok: true, open: true })).toEqual({ ok: true, open: true });
    expect(normalizeOpenTabSwitcherStateResponse({ ok: false, open: true })).toBeNull();
    expect(getFailedOpenTabSwitcherState()).toEqual({ ok: false, open: false });
  });

  it('counts any frame whose script did it', () => {
    const frames = [{ result: { ok: false } }, { result: null }, 'junk', { result: { ok: true, open: false, committed: true } }];
    expect(readScriptResults(frames)).toEqual([{ ok: false }, { ok: true, open: false, committed: true }]);
    expect(normalizeTabSwitcherHostOkScriptResults(frames)).toBe(true);
    expect(normalizeTabSwitcherHostOkScriptResults([{ result: { ok: false } }])).toBeNull();
    expect(normalizeTabSwitcherCommitScriptResults(frames)).toBe(true);
    expect(normalizeOpenTabSwitcherStateScriptResults(frames)).toEqual({ ok: true, open: false });
    expect(normalizeOpenTabSwitcherStateScriptResults(null)).toBeNull();
  });

  it('keeps thumbnail state under the thumbnail setting and signs it by its image, not its bytes', () => {
    expect(readTabSwitcherThumbnailStatus('stale')).toBe('stale');
    expect(readTabSwitcherThumbnailStatus('weird')).toBe('');
    expect(getTabSwitcherThumbnailStorageKey(7)).toBe(tabSwitcherThumbnail.keyFor(7));
    expect(getThumbnailPersistSignature({
      updatedAt: 2, capturedAt: 1, status: 'ok', url: 'https://a/', reason: 'r', dataUrl: 'data:abc'
    })).toBe('2|1|ok|https://a/|r|8');
    expect(getTabSwitcherHeadSignature({ stack: [1, 2], thumbnailTabIds: [2] })).toBe('[[1,2],[2]]');
  });

  it.each([
    [null, true],
    [{ status: 'restricted' }, false],
    [{ status: 'pending' }, false],
    [{ status: 'stale' }, true],
    [{ status: 'failed' }, true],
    [{ status: 'ok', dataUrl: 'data:image/jpeg;base64,AA' }, false],
    [{ status: 'ok', dataUrl: '' }, true]
  ])('refreshes a thumbnail in state %j: %s', (state, expected) => {
    expect(isSwitcherThumbnailRefreshNeeded(state)).toBe(expected);
  });

  it('marks pages the browser will not capture as restricted', () => {
    expect(getSwitcherThumbnailStatusForFailureReason('Cannot access contents of the page')).toBe('restricted');
    expect(getSwitcherThumbnailStatusForFailureReason('untracked-tab')).toBe('restricted');
    expect(getSwitcherThumbnailStatusForFailureReason('timeout')).toBe('failed');
  });

  it('themes a host by its registrable domain first', () => {
    expect(getSwitcherRegistrableThemeHost('docs.github.com')).toBe('github.com');
    expect(getSwitcherRegistrableThemeHost('www.bbc.co.uk')).toBe('bbc.co.uk');
    expect(getSwitcherRegistrableThemeHost('192.168.1.10')).toBe('192.168.1.10');
    expect(getSwitcherRegistrableThemeHost('dev.app.localhost')).toBe('dev.app.localhost');
    expect(getSwitcherThemeHostCandidates('gist.github.com')).toEqual(['github.com', 'gist.github.com']);
    expect(getSwitcherThemeHostCandidates('app.dodopayments.com')).toEqual(['dodopayments.com', 'app.dodopayments.com']);
    expect(getSwitcherThemeHostCandidates('github.com')).toEqual(['github.com']);
  });
});
