// Whether a surface is drawn dark. The surface sets it after it switches its
// `data-theme`; the views tinted per site redraw their colors when it changes.
import { createStore } from '../state/store';
import type { Store } from '../state/store';

interface ColorSchemeState {
  dark: boolean;
}

type ColorScheme = Store<ColorSchemeState>;

function createColorScheme(): ColorScheme {
  return createStore<ColorSchemeState>({ dark: false });
}

export { createColorScheme };
export type { ColorScheme, ColorSchemeState };
