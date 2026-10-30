import { describe, expect, it, vi } from 'vitest';
import { bootWorker, browserTab } from '../../../tests/fakes/worker';

const senderTab = browserTab({ id: 5, windowId: 1, url: 'https://example.com/', title: 'Example', active: true });

describe('tab messages', () => {
  it("answers an overlay's loading-session update asynchronously", async () => {
    const fake = await bootWorker({ tabs: [{ ...senderTab }] });
    const sendResponse = vi.fn();
    const results = fake.chrome.runtime.onMessage.fire(
      { action: 'updateOverlayLoadingSession', session: { inputValue: 'draft', revision: 1 } },
      { tab: senderTab, frameId: 0 },
      sendResponse
    );

    expect(results).toContain(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: expect.any(Boolean) })));
  });

  it('answers every committed top-frame document', async () => {
    const fake = await bootWorker({ tabs: [{ ...senderTab }] });

    expect(await fake.sendMessage(
      { action: 'notifyTopFrameDocumentStarted', documentUrl: senderTab.url, observedAt: Date.now() },
      { tab: senderTab, frameId: 0 }
    )).toMatchObject({ ok: expect.any(Boolean) });
  });
});
