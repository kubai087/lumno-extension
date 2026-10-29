// The parts the search box's mode draws in, and all of the surface's
// options for it.
import type { ModeMenuConfig } from './menu';
import type { ModeTagConfig } from './tag';
import type { ModeTabKeysConfig } from './keys';
import type { InputModeOwnConfig } from './mode-options';
import type { ModeMenuStore } from '../../react/search/mode-menu';
import type { ModeTagStore, TabHintStore } from '../../react/search/mode-tag';
import type { PortalHost } from '../../react/portal-host';

// The elements the surface's React view draws for the mode, and the stores
// the controller sets for it to draw. The controller animates and measures
// the elements.
interface InputModeParts {
  container: HTMLElement;
  // The React root the input was drawn through, which draws its tooltips too.
  portals: PortalHost;
  input: HTMLInputElement;
  modePrefix: HTMLElement;
  modePrefixIconFrame: HTMLElement;
  modePrefixGlyph: HTMLElement;
  modePrefixLineIcon: SVGElement;
  modePrefixCurrent: HTMLElement;
  modeTabHint: HTMLElement;
  modeTagStore: ModeTagStore;
  tabHintStore: TabHintStore;
  // The mode menu, with its scrolling content and footer.
  modeMenu: HTMLElement;
  modeMenuContent: HTMLElement;
  modeMenuFooter: HTMLElement;
  modeMenuStore: ModeMenuStore;
}


type InputModeConfig = InputModeOwnConfig & ModeMenuConfig & ModeTagConfig & ModeTabKeysConfig;

export type { InputModeConfig, InputModeParts };
