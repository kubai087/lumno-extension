import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERLAY_STYLE_IDS, OVERLAY_STYLE_REVEAL_POLICY, createOverlayRevealGate } from './site-fixes';

// The panel stays hidden until its input and result stylesheets apply, for
// at most its budget; past that it shows with the inline fallback styles and
// upgrades once they load.

const FIX_ID = OVERLAY_STYLE_REVEAL_POLICY.id;

// The panel's two stylesheet links in its shadow root. JSDOM loads no
// stylesheet: `load` gives a link the sheet a browser would have parsed.
function createPanel({ loaded = false } = {}) {
  const host = document.body.appendChild(document.createElement('div'));
  const styleRoot = host.attachShadow({ mode: 'open' });
  const links = [OVERLAY_STYLE_IDS.input, OVERLAY_STYLE_IDS.suggestions].map((id) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    styleRoot.appendChild(link);
    return link;
  });
  const load = (link: HTMLLinkElement) => {
    Object.defineProperty(link, 'sheet', { configurable: true, value: new CSSStyleSheet() });
    link.dispatchEvent(new Event('load'));
  };
  if (loaded) {
    links.forEach((link) => Object.defineProperty(link, 'sheet', { configurable: true, value: new CSSStyleSheet() }));
  }
  const overlay = styleRoot.appendChild(document.createElement('div'));
  return { overlay, styleRoot, input: links[0], suggestions: links[1], load };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Overlay reveal gate', () => {
  it('waits on every site for both the input and the result styles', async () => {
    const { overlay, styleRoot, input, suggestions, load } = createPanel();
    const gate = createOverlayRevealGate(window, { overlay, styleRoot, maxWaitMs: 100 });
    expect(gate.active).toBe(true);
    expect(overlay.style.getPropertyValue('visibility')).toBe('hidden');
    expect(overlay.style.getPropertyPriority('visibility')).toBe('important');
    expect(overlay.getAttribute('data-lumno-site-fix-reveal')).toBe(FIX_ID);
    expect(OVERLAY_STYLE_REVEAL_POLICY.styleIds).toEqual([OVERLAY_STYLE_IDS.input, OVERLAY_STYLE_IDS.suggestions]);

    let settled = false;
    const ready = gate.waitUntilReady().then((result) => {
      settled = true;
      return result;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    load(input);
    await Promise.resolve();
    expect(settled).toBe(false);

    load(suggestions);
    expect(await ready).toEqual({ ok: true, reason: 'loaded', fixId: FIX_ID });
    // The entry animation already commits its hidden state across two
    // frames; the gate adds none.
    expect(vi.getTimerCount()).toBe(0);

    gate.release();
    expect(overlay.style.getPropertyValue('visibility')).toBe('');
    expect(overlay.hasAttribute('data-lumno-site-fix-reveal')).toBe(false);
    expect(overlay.getAttribute('data-lumno-site-fix-style-fallback')).toBeNull();
  });

  it('does not delay the reveal for styles already loaded', async () => {
    const { overlay, styleRoot } = createPanel({ loaded: true });
    const gate = createOverlayRevealGate(window, { overlay, styleRoot });
    const result = await gate.waitUntilReady();
    expect(vi.getTimerCount()).toBe(0);
    expect(overlay.style.getPropertyValue('visibility')).toBe('hidden');
    expect([result.ok, result.reason]).toEqual([true, 'already-loaded']);
  });

  it('reveals the safe fallback after its budget, until both stylesheets arrive', async () => {
    const { overlay, styleRoot, input, suggestions, load } = createPanel();
    const gate = createOverlayRevealGate(window, { overlay, styleRoot, maxWaitMs: 8 });
    const ready = gate.waitUntilReady();
    vi.advanceTimersByTime(8);
    expect(await ready).toEqual({ ok: false, reason: 'timeout', fixId: FIX_ID });
    expect(gate.isReady()).toBe(false);

    gate.release();
    expect(overlay.getAttribute('data-lumno-site-fix-style-fallback')).toBe(FIX_ID);
    load(input);
    expect(overlay.getAttribute('data-lumno-site-fix-style-fallback')).toBe(FIX_ID);
    load(suggestions);
    expect(overlay.getAttribute('data-lumno-site-fix-style-fallback')).toBeNull();
    expect(gate.isReady()).toBe(true);
  });
});
