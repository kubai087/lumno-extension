// The parts the search box's mode draws in, and all of the surface's
// options for it.
import type { ModeMenuConfig } from './menu';
import type { ModeTagConfig } from './tag';
import type { ModeTabKeysConfig } from './keys';
import type { InputModeOwnConfig } from './mode-options';
import type { ModeMenuView } from './mode-menu-model';
import type { ModeTagView, TabHintView } from '../../react/search/mode-tag';
import type { PortalHost } from '../../react/portal-host';

// The elements the surface's React view draws for the mode, and the views
// the controller draws them through. The controller animates and measures
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
  modeTagView: ModeTagView;
  tabHintView: TabHintView;
  // The mode menu, with its scrolling content and footer.
  modeMenu: HTMLElement;
  modeMenuContent: HTMLElement;
  modeMenuFooter: HTMLElement;
  modeMenuView: ModeMenuView;
}


type InputModeConfig = InputModeOwnConfig & ModeMenuConfig & ModeTagConfig & ModeTabKeysConfig;

export type { InputModeConfig, InputModeParts };
