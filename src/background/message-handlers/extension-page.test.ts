import { describe, expect, it } from 'vitest';
import { progressTrackingEnabled } from '../../domain/settings/recent-sites';
import { bootWorker, browserTab, settleWorker } from '../../../tests/fakes/worker';

describe('extension page messages', () => {
  it('answers New Tab’s episode probe only while progress tracking is on', async () => {
    const episode = { id: 5, index: 0, windowId: 1, url: 'https://vidhub3.top/vodplay/55357-1-2.html', title: '某剧 第2集' };
    const fake = await bootWorker({ tabs: [episode], sync: { [progressTrackingEnabled.key]: true } });
    await settleWorker(50);
    const probe = () => fake.sendMessage({ action: 'probeProgressSeries', url: episode.url }, undefined, 1500);

    await expect(probe()).resolves.toEqual({ ok: true, series: true });
    fake.storage.sync.externalSet({ [progressTrackingEnabled.key]: false });
    await settleWorker(20);
    await expect(probe()).resolves.toEqual({ ok: true, series: false });
  });
});

describe('opening pages for a web page', () => {
  const senderTab = browserTab({ id: 5, windowId: 1, url: 'https://example.com/', title: 'Example', active: true });

  it("opens the browser's own New Tab in the requested disposition", async () => {
    const fake = await bootWorker({ tabs: [senderTab] });
    fake.chrome.tabs.create.mockClear();

    expect(await fake.sendMessage({ action: 'openNewTab', disposition: 'backgroundTab' }, { tab: senderTab })).toMatchObject({ ok: true });
    const created = fake.chrome.tabs.create.mock.calls.map(([properties]) => properties);
    expect(created).toHaveLength(1);
    expect(created[0].url).toBeUndefined();
    expect(created[0].active).toBe(false);
  });

  it('opens Settings at the section asked for', async () => {
    const fake = await bootWorker({ tabs: [senderTab] });
    fake.chrome.tabs.create.mockClear();

    expect(await fake.sendMessage({ action: 'openOptionsPage', hash: 'labs' }, { tab: senderTab })).toMatchObject({ ok: true });
    const created = fake.chrome.tabs.create.mock.calls.map(([properties]) => properties);
    expect(created).toHaveLength(1);
    expect(String(created[0].url)).toMatch(/options\.html#labs$/);
  });
});
