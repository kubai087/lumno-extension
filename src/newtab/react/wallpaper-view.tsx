import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { SelectMenuControls } from '../../shared/react/select-menu';
import { LinkButton } from '../../shared/react/link-button';
import { RemixIcon } from '../../shared/react/remix-icon';
import { ref } from './wallpaper-panel/panel-primitives';
import {
  SELECT_IDS,
  SELECT_HOST_REFS,
  type WallpaperPanelModel,
  type QuoteSettingsModel,
  type SectionSettingsModel,
  type WallpaperPanelState
} from './wallpaper-panel/panel-model';
import { useWallpaperPanel, type WallpaperPanelProps } from './wallpaper-panel/use-wallpaper-panel';
import { ThemeSection } from './wallpaper-panel/theme-section';
import { StyleSection } from './wallpaper-panel/style-section';
import { SearchSection } from './wallpaper-panel/search-section';
import { ShortcutsSection } from './wallpaper-panel/shortcuts-section';
import { BookmarkSettingsSection } from './wallpaper-panel/bookmark-settings-section';
import { RecentSettingsSection } from './wallpaper-panel/recent-settings-section';
import { QuoteSection } from './wallpaper-panel/quote-section';
import { WallpaperSection } from './wallpaper-panel/wallpaper-section';
import { FaviconSection } from './wallpaper-panel/favicon-section';
import { queryHtmlElement, queryHtmlElements, queryHtmlTag } from '../../shared/dom-lookup';
export { EFFECT_SLIDER_KEYS } from './wallpaper-panel/panel-model';
export type { WallpaperSourceTab, WallpaperMode, ThemeScope, TopContentMode, TimeInk, GlassTheme, EffectSliderKey, WallpaperPanelModel, TileState, OnlineTileState, SelectedSourceState, DailyState, PanelSelectModel, CuratedMixState, WallpaperPanelActions, WallpaperPanelState, SectionSettingsActions, SectionSettingsModel, QuoteSettingsActions, QuoteSettingsModel } from './wallpaper-panel/panel-model';

function WallpaperPanel(props: WallpaperPanelProps) {
  const panel = useWallpaperPanel(props);
  const {
    state,
    sliderBubble,
    actions,
    bubbleNode
  } = panel;
  return (
    <>
      <div
        {...ref('panel')}
        aria-label={state.panelLabel || undefined}
        aria-modal="false"
        className="x-nt-wallpaper-panel"
        data-open={state.open ? 'true' : 'false'}
        onScrollCapture={() => {
          sliderBubble.hide(null, true);
          actions.hideTooltip();
        }}
        role="dialog"
      >
        <div className="x-nt-appearance-header">
          <div {...ref('appearanceTitle')} className="x-nt-wallpaper-panel-title">
            {state.header.title}
          </div>
          <LinkButton
            {...ref('moreSettingsLink')}
            aria-label={state.header.moreSettingsLabel || undefined}
            className="x-nt-appearance-more-settings"
            href={state.header.moreSettingsUrl}
            labelProps={{
              ...ref('moreSettingsText'),
              className: 'x-nt-appearance-more-settings-text'
            }}
          >
            {state.header.moreSettingsLabel}
          </LinkButton>
        </div>
        <div className="x-nt-wallpaper-panel-scroll">
          <ThemeSection panel={panel} />
          <div className="x-nt-panel-divider" />
          <StyleSection panel={panel} />
          <div className="x-nt-panel-divider" />
          <SearchSection panel={panel} />
          <div className="x-nt-panel-divider" />
          <ShortcutsSection panel={panel} />
          {panel.sectionSettings ? (
            <>
              <div className="x-nt-panel-divider" />
              <BookmarkSettingsSection panel={panel} settings={panel.sectionSettings} />
              <div className="x-nt-panel-divider" />
              <RecentSettingsSection settings={panel.sectionSettings} />
            </>
          ) : null}
          {panel.quoteSettings ? (
            <>
              <div {...ref('quoteDivider')} className="x-nt-panel-divider" />
              <QuoteSection panel={panel} settings={panel.quoteSettings} />
            </>
          ) : null}
          <div className="x-nt-panel-divider" />
          <WallpaperSection panel={panel} />
          <div className="x-nt-panel-divider" />
          <FaviconSection panel={panel} />
        </div>
        <p className="x-nt-appearance-help-footer">
          <span {...ref('helpFooterPrompt')} className="x-nt-appearance-help-footer-prompt">
            {state.header.helpPrompt}
          </span>
          <LinkButton
            {...ref('helpFooterLink')}
            className="x-nt-appearance-help-footer-link"
            external
            href={state.header.helpUrl}
            labelProps={ref('helpFooterText')}
          >
            {state.header.helpText}
          </LinkButton>
        </p>
      </div>
      <button
        {...ref('button')}
        aria-expanded={state.open ? 'true' : 'false'}
        aria-haspopup="dialog"
        aria-label={state.button.label || undefined}
        aria-pressed={state.button.active ? 'true' : 'false'}
        className="x-nt-wallpaper-button"
        data-active={state.button.active ? 'true' : 'false'}
        data-open={state.open ? 'true' : 'false'}
        onBlur={() => actions.hideTooltip()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          actions.hideTooltip();
          actions.togglePanel();
        }}
        onFocus={(event) => actions.showButtonTooltip(event.currentTarget)}
        onMouseEnter={(event) => actions.showButtonTooltip(event.currentTarget)}
        onMouseLeave={() => actions.hideTooltip()}
        type="button"
      >
        <RemixIcon name="ri-t-shirt-2-line" size={20} />
      </button>
      {bubbleNode}
    </>
  );
}

export interface WallpaperViewController {
  button: HTMLButtonElement;
  closeOpenSelect(options?: { restoreFocus?: boolean }): boolean;
  containsSelectMenuTarget(target: Node | null): boolean;
  control: HTMLDivElement;
  destroy(): void;
  /** Moves focus to a rendered element, by its data-wallpaper-ref name. */
  focus(name: string): void;
  /** Elements by data-wallpaper-ref, for the sections other runtimes fill in. */
  getRefs(): Record<string, HTMLElement>;
  panel: HTMLDivElement;
  /** Renders the panel from new state; the DOM is up to date when this returns. */
  render(state: WallpaperPanelState): void;
  // Draws the bookmark and site card sections from their runtime's model.
  renderSectionSettings(model: SectionSettingsModel): void;
  // Draws the quote section from its runtime's model.
  renderQuoteSettings(model: QuoteSettingsModel): void;
}

export function createWallpaperViewController(
  config: { documentObj?: Document; model?: WallpaperPanelModel; state: WallpaperPanelState }
): WallpaperViewController {
  const documentObj: Document = config.documentObj || document;
  const model = config.model || {};
  let state = config.state;
  let sectionSettings: SectionSettingsModel | null = null;
  let quoteSettings: QuoteSettingsModel | null = null;
  const selectControls = new Map<string, SelectMenuControls>();
  const registerSelect = (id: string, controls: SelectMenuControls) => {
    selectControls.set(id, controls);
  };
  const control = documentObj.createElement('div');
  control.className = 'x-nt-wallpaper-control';
  control.dataset.reactIsland = 'newtab-wallpaper';
  const root: Root = createRoot(control);
  let destroyed = false;
  const renderRoot = () => {
    control.dataset.panelOpen = state.open ? 'true' : 'false';
    flushSync(() => root.render(
      <WallpaperPanel
        documentObj={documentObj}
        model={model}
        quoteSettings={quoteSettings}
        registerSelect={registerSelect}
        sectionSettings={sectionSettings}
        state={state}
      />
    ));
  };
  renderRoot();
  const panel = queryHtmlTag(control, '[data-wallpaper-ref="panel"]', 'div');
  const button = queryHtmlTag(control, '[data-wallpaper-ref="button"]', 'button');
  if (!panel || !button) {
    flushSync(() => root.unmount());
    throw new Error('Lumno React wallpaper view did not mount.');
  }
  const getRefs = () => {
    const refs: Record<string, HTMLElement> = {};
    queryHtmlElements(control, '[data-wallpaper-ref]')
      .forEach((element) => {
        const name = element.dataset.wallpaperRef;
        if (name) {
          refs[name] = element;
        }
      });
    return refs;
  };

  const controller: WallpaperViewController = {
    button,
    control,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      flushSync(() => root.unmount());
    },
    focus(name: string) {
      const element = queryHtmlElement(control, `[data-wallpaper-ref="${name}"]`);
      element?.focus();
    },
    getRefs,
    panel,
    render(nextState: WallpaperPanelState) {
      if (destroyed) return;
      state = nextState;
      renderRoot();
    },
    closeOpenSelect(options?: { restoreFocus?: boolean }) {
      const openId = SELECT_IDS.find((id) => selectControls.get(id)?.isOpen());
      if (!openId) {
        return false;
      }
      flushSync(() => selectControls.get(openId)?.setOpen(false));
      if (options?.restoreFocus) {
        queryHtmlElement(control, `[data-wallpaper-ref="${SELECT_HOST_REFS[openId]}"] button`)?.focus();
      }
      return true;
    },
    // The menus are portaled to the body but still belong to the panel.
    containsSelectMenuTarget(target: Node | null) {
      return Boolean(target && SELECT_IDS.some((id) => documentObj
        .querySelector(`[data-react-select-owner="${id}"]`)?.contains(target)));
    },
    renderQuoteSettings(nextModel: QuoteSettingsModel) {
      if (destroyed) return;
      quoteSettings = nextModel;
      renderRoot();
    },
    renderSectionSettings(nextModel: SectionSettingsModel) {
      if (destroyed) return;
      sectionSettings = nextModel;
      renderRoot();
    }
  };
  return Object.freeze(controller);
}
