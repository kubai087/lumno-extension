// The style section: the glass material, whether it adapts to the wallpaper, and the liquid
// material's tint.
import { SectionTrigger, InfoButton, PanelSelect } from './panel-controls';
import { ref, PanelSlider, Switch } from './panel-primitives';
import { collapsible, GLASS_STYLE_SELECT_ID } from './panel-model';
import type { LiquidGlassTintTheme } from './panel-model';
import type { WallpaperPanelContext } from './use-wallpaper-panel';

// The default tint (100% of 0–150%) as a mark on the track.
const TINT_MARKS = [0, 200 / 3, 100];

export function StyleSection({ panel }: { panel: WallpaperPanelContext }) {
  const {
    styleExpanded,
    setStyleExpanded,
    glassStyle,
    actions,
    documentObj,
    registerSelect
  } = panel;
  return (
    <div className="x-nt-wallpaper-section">
      <div className="x-nt-wallpaper-panel-header">
        <SectionTrigger
          bodyId="_x_extension_newtab_style_section_body_2026_unique_"
          expanded={styleExpanded}
          onToggle={() => setStyleExpanded(!styleExpanded)}
          title={glassStyle.sectionTitle}
          titleRef="styleSectionTitle"
          triggerRef="styleSectionTrigger"
        />
      </div>
      <div
        {...ref('styleSectionBody')}
        {...collapsible(styleExpanded)}
        className="x-nt-panel-section-body x-nt-panel-collapsible"
        id="_x_extension_newtab_style_section_body_2026_unique_"
      >
        <div className="x-nt-appearance-setting-row">
          <span className="x-nt-appearance-setting-title-group">
            <span {...ref('glassStyleTitle')} className="x-nt-appearance-setting-title">
              {glassStyle.title}
            </span>
            <InfoButton
              actions={actions}
              label={glassStyle.title}
              name="glassStyleInfoButton"
              tooltip={glassStyle.infoTooltip}
            />
          </span>
          <PanelSelect
            documentObj={documentObj}
            hostRef="glassStyleSelectHost"
            id={GLASS_STYLE_SELECT_ID}
            registerControls={registerSelect}
            select={{
              ariaLabel: glassStyle.ariaLabel,
              onChange: actions.setGlassStyle,
              options: glassStyle.options,
              value: glassStyle.value
            }}
          />
        </div>
        <div
          {...ref('glassAdaptiveRow')}
          {...collapsible(glassStyle.adaptive.visible)}
          className="x-nt-appearance-setting-row x-nt-panel-collapsible"
        >
          <span className="x-nt-appearance-setting-title-group">
            <span {...ref('glassAdaptiveTitle')} className="x-nt-appearance-setting-title">
              {glassStyle.adaptive.title}
            </span>
            <InfoButton
              actions={actions}
              label={glassStyle.adaptive.title}
              name="glassAdaptiveInfoButton"
              tooltip={glassStyle.adaptive.infoTooltip}
            />
          </span>
          <Switch
            name="glassAdaptiveToggle"
            onChange={actions.setGlassAdaptive}
            toggle={glassStyle.adaptive.toggle}
          />
        </div>
        <LiquidTintGroup panel={panel} />
      </div>
    </div>
  );
}

// Liquid glass only: how much tint it keeps, set for each theme.
function LiquidTintGroup({ panel }: { panel: WallpaperPanelContext }) {
  const { actions, sliderBubble } = panel;
  const tint = panel.glassStyle.tint;
  const tintSlider = (theme: LiquidGlassTintTheme) => (
    <div className="x-nt-overlay-control">
      <PanelSlider
        bubble={sliderBubble}
        inputClass="x-nt-overlay-slider x-nt-liquid-tint-slider"
        marks={TINT_MARKS}
        name={theme === 'dark' ? 'liquidTintDarkSlider' : 'liquidTintLightSlider'}
        onChange={(value, change) => actions.setLiquidGlassTint(theme, value, change)}
        reset={{
          label: tint[theme].resetLabel,
          name: theme === 'dark' ? 'liquidTintDarkResetButton' : 'liquidTintLightResetButton',
          onReset: () => actions.resetLiquidGlassTint(theme),
          visible: tint[theme].resetVisible
        }}
        slider={tint[theme]}
      />
    </div>
  );
  return (
    <div
      {...ref('liquidTintGroup')}
      {...collapsible(tint.visible)}
      className="x-nt-panel-field-group x-nt-panel-collapsible"
    >
      <div className="x-nt-appearance-setting-row">
        <span className="x-nt-appearance-setting-title-group">
          <span className="x-nt-appearance-setting-title">{tint.title}</span>
          <InfoButton actions={actions} label={tint.title} name="liquidTintInfoButton" tooltip={tint.infoTooltip} />
        </span>
      </div>
      {tintSlider('light')}
      {tintSlider('dark')}
    </div>
  );
}
