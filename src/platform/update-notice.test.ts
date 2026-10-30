import { describe, expect, it, vi } from 'vitest';
import { updateNoticeEnabled, updateNoticeState } from '../domain/settings/features';
import { createSettingsStore } from './settings-store';
import {
  UPDATE_NOTICE_MAX_DISPLAY_COUNT,
  fetchReleaseTitle,
  formatVersionLabel,
  getUpdateNoticeDisplayCountKey,
  normalizeUpdateNoticeDisplayCount,
  normalizeUpdateNoticePayload,
  normalizeVersionTag,
  publishUpdateNotice,
  shouldShowUpdateNotice
} from './update-notice';
import type { ReleaseFetch } from './update-notice';
import { createBrowserFake } from '../../tests/fakes/browser';

const API = 'https://api.github.com/repos/kubai087/lumno-extension/releases/tags/';

function release(body: unknown) {
  return { ok: true, json: async () => body, text: async () => String(body) };
}

const missing = { ok: false, json: async () => ({}), text: async () => '' };

describe('update notice data', () => {
  it('writes versions as v-tags and shows them without the v', () => {
    expect(normalizeVersionTag('0.9.10')).toBe('v0.9.10');
    expect(normalizeVersionTag('v0.9.10')).toBe('v0.9.10');
    expect(formatVersionLabel('v0.9.10')).toBe('0.9.10');
  });

  it('counts at most three showings per release', () => {
    expect(UPDATE_NOTICE_MAX_DISPLAY_COUNT).toBe(3);
    expect(normalizeUpdateNoticeDisplayCount(undefined)).toBe(0);
    expect(normalizeUpdateNoticeDisplayCount(2.9)).toBe(2);
    expect(normalizeUpdateNoticeDisplayCount(10)).toBe(3);
    expect(getUpdateNoticeDisplayCountKey('0.9.10')).not.toBe(getUpdateNoticeDisplayCountKey('0.9.11'));
  });

  it('shows a published notice only on the version it was published for', () => {
    const notice = normalizeUpdateNoticePayload({
      version: '0.9.10',
      previousVersion: '0.9.9',
      title: 'Release title from GitHub',
      releaseUrl: 'https://example.com/release/?version=v0.9.10',
      reason: 'update',
      updatedAt: 10
    });
    expect(notice?.version).toBe('v0.9.10');
    expect(notice?.title).toBe('Release title from GitHub');
    expect(shouldShowUpdateNotice(notice, '0.9.10')).toBe(true);
    expect(shouldShowUpdateNotice(notice, '0.9.9')).toBe(false);
  });

  it('keeps its on/off switch in a synced preference', () => {
    expect(updateNoticeEnabled.key).toBe('_x_extension_update_notice_enabled_2026_unique_');
  });

  it('reads the release title from the GitHub release', async () => {
    const fetchImpl = vi.fn<ReleaseFetch>(async () => release({ tag_name: 'v0.9.10', name: 'Release title from GitHub' }));
    expect(await fetchReleaseTitle('0.9.10', { fetchImpl })).toBe('Release title from GitHub');
    expect(fetchImpl).toHaveBeenCalledWith(`${API}0.9.10`, { headers: { Accept: 'application/vnd.github+json' } });
  });

  it('tries the v-tag and then the bare version tag', async () => {
    const urls: string[] = [];
    const fetchImpl: ReleaseFetch = async (url) => {
      urls.push(url);
      return url.endsWith('/0.9.10') ? release({ tag_name: '0.9.10', name: 'Minor Bug Fixes' }) : missing;
    };
    expect(await fetchReleaseTitle('v0.9.10', { fetchImpl })).toBe('Minor Bug Fixes');
    expect(urls).toEqual([`${API}v0.9.10`, `${API}0.9.10`]);
  });

  it('falls back to the release page title when the API answers nothing', async () => {
    const fetchImpl: ReleaseFetch = async (url) => {
      if (!url.startsWith('https://api.github.com/') && url.endsWith('/0.9.10')) {
        return release('<title>Release Minor Bug Fixes · kubai087/lumno-extension · GitHub</title>');
      }
      return missing;
    };
    expect(await fetchReleaseTitle('v0.9.10', { fetchImpl })).toBe('Minor Bug Fixes');
  });

  it('publishes the notice once, with the release title it looked up', async () => {
    const chromeApi = createBrowserFake();
    const set = vi.spyOn(chromeApi.storage.sync, 'set');
    await publishUpdateNotice({
      chromeApi,
      settingsStore: createSettingsStore({ chromeApi, settings: [] }),
      version: 'v0.9.10',
      previousVersion: '0.9.9',
      reason: 'update',
      fetchImpl: async () => release({ tag_name: '0.9.10', name: 'Minor Bug Fixes' })
    });
    const writes = set.mock.calls.filter(([values]) => updateNoticeState.key in values);
    expect(writes).toHaveLength(1);
    expect(chromeApi.storage.sync.values[updateNoticeState.key]).toMatchObject({ version: 'v0.9.10', title: 'Minor Bug Fixes' });
  });
});
