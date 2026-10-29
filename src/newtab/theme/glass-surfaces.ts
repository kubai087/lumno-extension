// The glass material: which surfaces the liquid style bends the wallpaper
// under, the stored glass style and theme, and the ink hint remembered for
// the next load.
import { createLiquidSurfaces } from '../dom/liquid-glass';
import { newtabGlassInkHint } from '../../domain/settings/newtab-wallpaper';
import type { SettingsStore } from '../../platform/settings-store';
import { newtabGlassStyle, newtabGlassTheme } from '../../domain/settings/newtab-page';
import * as SETTINGS from '../../domain/settings';
import { adaptiveToneEvents } from '../wallpaper/tone-requests';

interface GlassSurfacesDeps {
  settings: Pick<SettingsStore, 'get' | 'include' | 'subscribe'>;
  syncBookmarkTopbarSurfaceAppearance(options: { updateMenu: boolean }): void;
}

function createGlassSurfaces(deps: GlassSurfacesDeps) {
  const {
    settings,
    syncBookmarkTopbarSurfaceAppearance
  } = deps;


  // Surfaces whose rim bends the wallpaper under the liquid style; the search bar, the results
  // plate it grows into and the site search panel that opens under it, and the dock's cards.
  // Chrome 155 sometimes draws a lens on a layer of its own (will-change: transform) as its
  // displacement map instead of the bent backdrop when another layer appears, such as a tooltip:
  // menus and the Appearance panel, which need their layers, go without the bend, and the cards drop
  // their will-change under liquid glass (glass-style.css). Only the search bar, its results and the
  // site search panel fringe into colors along the rim: a card's wide rim turns even a slight split,
  // softened by the blur ahead of the lens, into an orange and blue haze in its corners. A surface
  // can set its rim in --x-nt-glass-rim and scale its bend in --x-nt-glass-refraction-strength (the
  // search bar, its results plate and the site search panel share both, in glass-style.css).
  const NEWTAB_LIQUID_SEARCH_SELECTOR = [
    '#_x_extension_newtab_root_2024_unique_',
    '#_x_extension_newtab_suggestions_surface_2026_unique_',
    '.x-lumno-search-input-mode__menu[data-surface="newtab"]'
  ].join(',');
  const NEWTAB_LIQUID_SURFACE_SELECTOR = [
    NEWTAB_LIQUID_SEARCH_SELECTOR,
    '.x-nt-recent-card-visual',
    '.x-nt-bookmark-card:not(.x-nt-bookmarks-topbar .x-nt-bookmark-card):not(.x-nt-bookmark-card-drag-preview)'
  ].join(',');
  let newtabLiquidSurfaces: ReturnType<typeof createLiquidSurfaces> | null = null;

  function syncNewtabLiquidSurfaces(enabled: boolean): void {
    if (!enabled) {
      if (newtabLiquidSurfaces) {
        newtabLiquidSurfaces.destroy();
        newtabLiquidSurfaces = null;
      }
      return;
    }
    if (newtabLiquidSurfaces) {
      return;
    }
    newtabLiquidSurfaces = createLiquidSurfaces({
      documentObj: document,
      windowObj: window,
      selector: NEWTAB_LIQUID_SURFACE_SELECTOR,
      dispersionSelector: NEWTAB_LIQUID_SEARCH_SELECTOR,
      property: '--x-nt-glass-refraction',
      rimProperty: '--x-nt-glass-rim',
      strengthProperty: '--x-nt-glass-refraction-strength'
    });
  }

  // Floating surfaces sample the wallpaper where they open, so resample as they open and close.
  let newtabGlassOpenObserver: MutationObserver | null = null;
  function syncNewtabGlassOpenObserver(enabled: boolean): void {
    if (!enabled) {
      if (newtabGlassOpenObserver) {
        newtabGlassOpenObserver.disconnect();
        newtabGlassOpenObserver = null;
      }
      return;
    }
    if (newtabGlassOpenObserver || typeof MutationObserver !== 'function') {
      return;
    }
    newtabGlassOpenObserver = new MutationObserver(() => adaptiveToneEvents.emit('stale', {}));
    newtabGlassOpenObserver.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-open', 'data-menu-open', 'data-show', 'data-nt-suggestions-open', 'data-wallpaper-panel-open']
    });
  }

  // Plates open in the ink the last page's wallpaper sample settled on (light text over a dark
  // wallpaper), so they do not start white and flip once this page's sample lands.
  function applyRememberedGlassInkHint(): void {
    if (document.body.hasAttribute('data-glass-ink-hint')) {
      return;
    }
    try {
      const hint = window.localStorage.getItem(newtabGlassInkHint.key);
      if (hint === 'light' || hint === 'dark') {
        document.body.setAttribute('data-glass-ink-hint', hint);
      }
    } catch {
      // Without the hint the plates start in the theme's ink and the sample flips them.
    }
  }

  function applyNewtabGlassStyle(): void {
    const style = settings.get(newtabGlassStyle);
    if (style === 'none') {
      document.body.removeAttribute('data-glass-style');
    } else {
      document.body.setAttribute('data-glass-style', style);
      applyRememberedGlassInkHint();
    }
    syncNewtabGlassThemeOverride();
    syncNewtabLiquidSurfaces(style === 'liquid');
    syncNewtabGlassOpenObserver(style !== 'none');
    // The bookmarks bar's "match style" background follows the page's material.
    syncBookmarkTopbarSurfaceAppearance({ updateMenu: false });
    adaptiveToneEvents.emit('stale', { resetInk: true });
  }

  // A material set to light or dark holds the page's theme there (appearance-modes.ts reads the
  // same settings) and marks the body, so the wallpaper sampler keeps light glass light instead
  // of turning it dark over a dark wallpaper.
  function syncNewtabGlassThemeOverride(): void {
    const override = SETTINGS.getNewtabGlassThemeOverride(settings.get(newtabGlassStyle), settings.get(newtabGlassTheme));
    if (override) {
      document.body.setAttribute('data-glass-theme', override);
      if (override === 'light') {
        document.body.setAttribute('data-glass-ink-hint', 'dark');
      }
    } else {
      document.body.removeAttribute('data-glass-theme');
    }
  }

  // Puts the stored material on the page once read, and again on every change.
  function followNewtabGlassStyle(): Promise<void> {
    settings.subscribe([newtabGlassStyle, newtabGlassTheme], applyNewtabGlassStyle);
    return settings.include([newtabGlassStyle, newtabGlassTheme]).then(applyNewtabGlassStyle);
  }

  return {
    followNewtabGlassStyle
  };
}

type GlassSurfaces = ReturnType<typeof createGlassSurfaces>;

export { createGlassSurfaces };
export type { GlassSurfaces, GlassSurfacesDeps };
