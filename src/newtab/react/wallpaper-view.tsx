import { flushSync } from 'react-dom';
import type { SelectMenuControls } from '../../shared/react/select-menu';
import { LinkButton } from '../../shared/react/link-button';
import { RemixIcon } from '../../shared/react/remix-icon';
import { ref } from './wallpaper-panel/panel-primitives';
import {
  SELECT_IDS,
  SELECT_HOST_REFS,
  type WallpaperPanelModel,
  type QuoteSettingsSlot,
  type SectionSettingsSlot,
  type WallpaperPanelStateSlot
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
import { getPagePortals } from '../app/portals';
import { useLayoutEffect } from 'react';
import { useStore } from '../../shared/react/use-store';
import { createViewStore } from '../../shared/react/view-store';
import { createStore } from '../../shared/state/store';
import type { Store } from '../../shared/state/store';
export { EFFECT_SLIDER_KEYS } from './wallpaper-panel/panel-model';
export type { WallpaperSourceTab, WallpaperMode, ThemeScope, TopContentMode, TimeInk, GlassTheme, EffectSliderKey, WallpaperPanelModel, TileState, OnlineTileState, SelectedSourceState, DailyState, PanelSelectModel, CuratedMixState, WallpaperPanelActions, WallpaperPanelState, SectionSettingsActions, SectionSettingsModel, QuoteSettingsActions, QuoteSettingsModel, WallpaperPanelStateSlot, SectionSettingsSlot, QuoteSettingsSlot } from './wallpaper-panel/panel-model';

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
  // The bookmark, site card and quote sections join the panel with the
  // stores their runtimes set.
  attachSettings(stores: Partial<PanelSettingsStores>): void;
}

interface PanelSettingsStores {
  section: Store<SectionSettingsSlot>;
  quote: Store<QuoteSettingsSlot>;
}

const NO_SECTION_SETTINGS = createStore<SectionSettingsSlot>({ model: null });
const NO_QUOTE_SETTINGS = createStore<QuoteSettingsSlot>({ model: null });

interface WallpaperPanelRootProps extends Omit<WallpaperPanelProps, 'state' | 'sectionSettings' | 'quoteSettings'> {
  control: HTMLElement;
  stateStore: Store<WallpaperPanelStateSlot>;
  settingsStores: Store<Partial<PanelSettingsStores>>;
}

// The panel drawn from its owner's state and the sections' models.
function WallpaperPanelRoot({ control, stateStore, settingsStores, ...props }: WallpaperPanelRootProps) {
  const { state } = useStore(stateStore);
  const stores = useStore(settingsStores);
  const sectionSettings = useStore(stores.section || NO_SECTION_SETTINGS).model;
  const quoteSettings = useStore(stores.quote || NO_QUOTE_SETTINGS).model;
  useLayoutEffect(() => {
    control.dataset.panelOpen = state.open ? 'true' : 'false';
  }, [control, state.open]);
  return <WallpaperPanel {...props} quoteSettings={quoteSettings} sectionSettings={sectionSettings} state={state} />;
}

export function createWallpaperViewController(
  config: { documentObj?: Document; model?: WallpaperPanelModel; state: Store<WallpaperPanelStateSlot> }
): WallpaperViewController {
  const documentObj: Document = config.documentObj || document;
  const model = config.model || {};
  const settingsStores = createViewStore<Partial<PanelSettingsStores>>({});
  const selectControls = new Map<string, SelectMenuControls>();
  const registerSelect = (id: string, controls: SelectMenuControls) => {
    selectControls.set(id, controls);
  };
  const control = documentObj.createElement('div');
  control.className = 'x-nt-wallpaper-control';
  control.dataset.reactIsland = 'newtab-wallpaper';
  let destroyed = false;
  getPagePortals().show(control, (
    <WallpaperPanelRoot
      control={control}
      documentObj={documentObj}
      model={model}
      registerSelect={registerSelect}
      settingsStores={settingsStores}
      stateStore={config.state}
    />
  ));
  const panel = queryHtmlTag(control, '[data-wallpaper-ref="panel"]', 'div');
  const button = queryHtmlTag(control, '[data-wallpaper-ref="button"]', 'button');
  if (!panel || !button) {
    getPagePortals().remove(control);
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
      getPagePortals().remove(control);
    },
    focus(name: string) {
      const element = queryHtmlElement(control, `[data-wallpaper-ref="${name}"]`);
      element?.focus();
    },
    getRefs,
    panel,
    attachSettings(stores: Partial<PanelSettingsStores>) {
      if (destroyed) return;
      settingsStores.setState(stores);
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
    }
  };
  return Object.freeze(controller);
}
