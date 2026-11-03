// The style section: the glass material and whether it adapts to the wallpaper.
import { SectionTrigger, InfoButton, PanelSelect } from './panel-controls';
import { ref, Switch } from './panel-primitives';
import { collapsible, GLASS_STYLE_SELECT_ID } from './panel-model';
import type { WallpaperPanelContext } from './use-wallpaper-panel';

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
      </div>
    </div>
  );
}
