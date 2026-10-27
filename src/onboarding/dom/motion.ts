// How the page moves: whether the reader asked for less motion, and how long
// the copy takes to swap, from the page's stylesheet.
const TEXT_SWAP_FALLBACK_DURATION_MS = 200;

function getCssTimeMs(value: string, fallback: number): number {
  const raw = value.trim();
  if (!raw) {
    return fallback;
  }
  const numeric = Number.parseFloat(raw);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return raw.endsWith('s') && !raw.endsWith('ms') ? numeric * 1000 : numeric;
}

function getTextSwapDurationMs(): number {
  if (typeof getComputedStyle !== 'function' || !document.documentElement) {
    return TEXT_SWAP_FALLBACK_DURATION_MS;
  }
  return getCssTimeMs(
    getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur'),
    TEXT_SWAP_FALLBACK_DURATION_MS
  );
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { getTextSwapDurationMs, prefersReducedMotion };
