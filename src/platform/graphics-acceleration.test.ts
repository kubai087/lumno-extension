import { describe, expect, it, vi } from 'vitest';
import { getGraphicsSettingsUrl, probeGraphicsRendering } from './graphics-acceleration';
import type { ProbeCanvas, ProbeGpu } from './graphics-acceleration';

const noWebgl = (): ProbeCanvas => ({ getContext: () => null });
const adapter = (value: unknown): ProbeGpu => ({ requestAdapter: () => Promise.resolve(value) });

describe('graphics acceleration probe', () => {
  it('finds the GPU through a WebGL context that refuses a major performance caveat, and releases it', async () => {
    const loseContext = vi.fn();
    const getContext = vi.fn(() => ({ getExtension: () => ({ loseContext }) }));
    expect(await probeGraphicsRendering(() => ({ getContext }), null)).toBe('hardware');
    expect(getContext).toHaveBeenCalledWith('webgl', expect.objectContaining({ failIfMajorPerformanceCaveat: true }));
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('calls it software rendering only when WebGPU finds no GPU either', async () => {
    expect(await probeGraphicsRendering(noWebgl, adapter(null))).toBe('software');
    expect(await probeGraphicsRendering(noWebgl, adapter({ info: { isFallbackAdapter: true } }))).toBe('software');
    expect(await probeGraphicsRendering(noWebgl, adapter({ info: { vendor: 'nvidia' } }))).toBe('unknown');
  });

  it('answers unknown whenever it cannot be sure', async () => {
    expect(await probeGraphicsRendering(noWebgl, null)).toBe('unknown');
    expect(await probeGraphicsRendering(noWebgl, { requestAdapter: () => Promise.reject(new Error('x')) })).toBe('unknown');
    expect(await probeGraphicsRendering(noWebgl, { requestAdapter: () => new Promise(() => {}) }, 20)).toBe('unknown');
    expect(await probeGraphicsRendering(() => null, adapter(null))).toBe('unknown');
    expect(await probeGraphicsRendering(() => ({ getContext() { throw new Error('lost'); } }), adapter(null))).toBe('unknown');
  });

  it("opens the browser's own system settings", () => {
    expect(getGraphicsSettingsUrl('chrome://')).toBe('chrome://settings/system');
    expect(getGraphicsSettingsUrl('edge://')).toBe('edge://settings/system');
    expect(getGraphicsSettingsUrl('opera://')).toBe('chrome://settings/system');
  });
});
