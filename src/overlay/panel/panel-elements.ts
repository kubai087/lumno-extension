// The overlay panel's parts made when it mounts: the panel and its shadow
// root, the React view and root drawing into it, the search input with its
// mode controller and history, the results' container, and the tooltips. A panel still
// closing from an earlier opening is held until this session replaces it.
import type { createSearchInputHistoryController } from '../../domain/search/search-input-history';
import type { PortalHost } from '../../shared/react/portal-host';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { CursorTooltipController } from '../../shared/ui/cursor-tooltip-model';
import type { TooltipController } from '../../shared/ui/tooltip';
import type { OverlayMount } from '../react/shell';

type InputHistoryController = ReturnType<typeof createSearchInputHistoryController>;

class OverlayPanelElements {
  private overlayPart: HTMLElement | null = null;
  private overlayPortalsPart: PortalHost | null = null;
  private overlayStyleRootPart: ShadowRoot | null = null;
  private inputPartsPart: SearchInputParts | null = null;
  private searchInputPart: HTMLInputElement | null = null;
  private inputContainerPart: HTMLElement | null = null;
  private modeBadgePart: HTMLElement | null = null;
  private suggestionsContainerPart: HTMLElement | null = null;
  private inputModeControllerPart: InputModeController | null = null;
  private inputHistoryControllerPart: InputHistoryController | null = null;
  private topActionTooltipPart: TooltipController | null = null;
  private cursorTooltipPart: CursorTooltipController | null = null;

  get overlay(): HTMLElement | null {
    return this.overlayPart;
  }

  get overlayPortals(): PortalHost | null {
    return this.overlayPortalsPart;
  }

  get overlayStyleRoot(): ShadowRoot | null {
    return this.overlayStyleRootPart;
  }

  get inputParts(): SearchInputParts | null {
    return this.inputPartsPart;
  }

  get searchInput(): HTMLInputElement | null {
    return this.searchInputPart;
  }

  get inputContainer(): HTMLElement | null {
    return this.inputContainerPart;
  }

  get modeBadge(): HTMLElement | null {
    return this.modeBadgePart;
  }

  get suggestionsContainer(): HTMLElement | null {
    return this.suggestionsContainerPart;
  }

  get inputModeController(): InputModeController | null {
    return this.inputModeControllerPart;
  }

  get inputHistoryController(): InputHistoryController | null {
    return this.inputHistoryControllerPart;
  }

  get topActionTooltip(): TooltipController | null {
    return this.topActionTooltipPart;
  }

  get cursorTooltip(): CursorTooltipController | null {
    return this.cursorTooltipPart;
  }

  // A panel left on the page by an earlier opening.
  holdExisting(panel: HTMLElement | null): void {
    this.overlayPart = panel;
  }

  mountShell(mount: Pick<OverlayMount, 'panel' | 'portals' | 'root'>): void {
    this.overlayPart = mount.panel;
    this.overlayPortalsPart = mount.portals;
    this.overlayStyleRootPart = mount.root;
  }

  mountInput(parts: SearchInputParts, history: InputHistoryController): void {
    this.inputPartsPart = parts;
    this.searchInputPart = parts.input;
    this.inputContainerPart = parts.container;
    this.modeBadgePart = parts.modeBadge;
    this.inputHistoryControllerPart = history;
  }

  mountResults(container: HTMLElement): void {
    this.suggestionsContainerPart = container;
  }

  mountModeController(controller: InputModeController): void {
    this.inputModeControllerPart = controller;
  }

  mountTooltips(topAction: TooltipController, cursor: CursorTooltipController): void {
    this.topActionTooltipPart = topAction;
    this.cursorTooltipPart = cursor;
  }

  // The input the page's events reach, when the browser replaced it.
  followLiveInput(input: HTMLInputElement): void {
    this.searchInputPart = input;
  }

  releaseInputControllers(): void {
    if (this.inputModeControllerPart) {
      this.inputModeControllerPart.destroy();
      this.inputModeControllerPart = null;
    }
    if (this.inputHistoryControllerPart && typeof this.inputHistoryControllerPart.destroy === 'function') {
      this.inputHistoryControllerPart.destroy();
    }
    this.inputHistoryControllerPart = null;
  }
}

export { OverlayPanelElements };
