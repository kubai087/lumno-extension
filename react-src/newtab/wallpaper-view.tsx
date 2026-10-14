import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { CSSProperties, ReactNode } from 'react';
import { SegmentedTabs } from './segmented-tabs';
import { SelectMenu, type SelectMenuOption } from './select-menu';
import { LinkButton } from '../shared/link-button';
import {
  RangeSliderField
} from '../shared/range-slider';

type WallpaperItem = {
  id: string;
  path?: string;
  thumbnailUrl: string;
};

type FaviconItem = {
  id: string;
  inlineSvg?: string;
  previewUrl?: string;
};

type CuratedCategoryItem = {
  label: string;
  value: string;
};

const WALLPAPER_SOURCE_TABS = [
  { label: 'Built-in', name: 'builtInTab', tab: 'built-in' },
  { label: 'Local', name: 'localTab', tab: 'local' },
  { label: 'Bing', name: 'bingTab', tab: 'bing' },
  { label: 'Curated', name: 'curatedTab', tab: 'curated' }
];

type TopContentItem = {
  label: string;
  value: 'brand' | 'time' | 'off';
};

type EffectInkToneItem = {
  fallback: string;
  tone: 'dark' | 'light';
};

const DEFAULT_EFFECT_INK_TONES: EffectInkToneItem[] = [
  { tone: 'dark', fallback: 'Dark' },
  { tone: 'light', fallback: 'Light' }
];

const ref = (name: string) => ({ 'data-wallpaper-ref': name });

function Switch({
  ariaLabel,
  name
}: {
  ariaLabel?: string;
  name: string;
}) {
  return (
    <label className="x-nt-wallpaper-switch">
      <input
        {...ref(name)}
        aria-label={ariaLabel}
        role="switch"
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className="x-nt-wallpaper-switch-slider"
      />
    </label>
  );
}

// Leading chevron + title form one disclosure hot area for every panel section.
function SectionTrigger({
  arrowIcon,
  bodyId,
  expanded,
  id,
  titleClassName = '',
  titleRef,
  triggerRef
}: {
  arrowIcon: string;
  bodyId: string;
  expanded: boolean;
  id?: string;
  titleClassName?: string;
  titleRef: string;
  triggerRef: string;
}) {
  return (
    <button
      {...ref(triggerRef)}
      aria-controls={bodyId}
      aria-expanded={expanded ? 'true' : 'false'}
      className="x-nt-section-trigger"
      id={id}
      type="button"
    >
      <span
        aria-hidden="true"
        className="x-nt-section-chevron"
        dangerouslySetInnerHTML={{ __html: arrowIcon }}
      />
      <span
        {...ref(titleRef)}
        className={`x-nt-wallpaper-panel-title${titleClassName ? ` ${titleClassName}` : ''}`}
      />
    </button>
  );
}

type RangeSliderTick = {
  align?: string;
  key?: string;
  label: string;
  percent?: number;
  searchKey?: string;
};

// Ticks become notches on the track; the component drops the implied start/end marks.
function tickMarks(ticks: RangeSliderTick[] = []) {
  return ticks.map((tick) =>
    typeof tick.percent === 'number'
      ? tick.percent
      : tick.align === 'start'
        ? 0
        : tick.align === 'end'
          ? 100
          : 50
  );
}

function SliderControl({
  controlClass = 'x-nt-effect-slider-control',
  controlRef,
  labelClass = 'x-nt-appearance-setting-title x-nt-effect-slider-label',
  labelRef,
  sliderClass = 'x-nt-overlay-slider x-nt-effect-slider',
  sliderRef,
  ticks,
  visible = true,
  wrapClass = 'x-nt-overlay-slider-wrap x-nt-effect-slider-wrap'
}: {
  controlClass?: string;
  controlRef: string;
  labelClass?: string;
  labelRef: string;
  sliderClass?: string;
  sliderRef: string;
  ticks: RangeSliderTick[];
  visible?: boolean;
  wrapClass?: string;
}) {
  return (
    <div
      {...ref(controlRef)}
      aria-hidden={visible ? 'false' : 'true'}
      className={controlClass}
      data-visible={visible ? 'true' : 'false'}
    >
      <RangeSliderField
        {...ref(sliderRef)}
        label={<span {...ref(labelRef)} className={labelClass} />}
        className={wrapClass}
        inputClass={sliderClass}
        max="100"
        min="0"
        rowClassName="x-nt-range-slider-row"
        step="1"
        valueInputProps={{
          ...ref(`${sliderRef}ValueInput`),
          'aria-label': 'Slider value',
          defaultValue: '50',
          inputMode: 'numeric'
        }}
        marks={tickMarks(ticks)}
      />
    </div>
  );
}

// A section whose header switch turns the page section on or off; the body ships
// collapsed and is filled in by the page runtime.
function ToggleSection({
  arrowIcon,
  children,
  name
}: {
  arrowIcon: string;
  children: ReactNode;
  name: string;
}) {
  const bodyId = `_x_extension_newtab_${name}_body_2026_unique_`;
  return (
    <div {...ref(`${name}Section`)} className="x-nt-wallpaper-section">
      <div className="x-nt-wallpaper-panel-header">
        <SectionTrigger
          arrowIcon={arrowIcon}
          bodyId={bodyId}
          expanded={false}
          titleRef={`${name}Title`}
          triggerRef={`${name}Trigger`}
        />
        <Switch name={`${name}Toggle`} />
      </div>
      <div
        {...ref(`${name}Body`)}
        className="x-nt-panel-section-body x-nt-panel-collapsible"
        hidden
        id={bodyId}
      >
        {children}
      </div>
    </div>
  );
}

function SettingRow({ children, titleRef }: { children: ReactNode; titleRef: string }) {
  return (
    <div className="x-nt-appearance-setting-row">
      <span {...ref(titleRef)} className="x-nt-appearance-setting-title" />
      {children}
    </div>
  );
}

// Dropdown on the right of a setting row; the view controller renders the menu into it.
function RowSelect({ hostRef }: { hostRef: string }) {
  return (
    <div
      {...ref(hostRef)}
      className="_x_extension_select_wrap_2024_unique_ _x_extension_custom_select_2024_unique_ x-nt-row-select"
    />
  );
}

// Segmented choice on the right of a setting row. Labels are filled in by the page
// runtime unless the values are their own labels.
function RowTabs({
  attribute,
  labeled = false,
  name,
  values
}: {
  attribute: `data-${string}`;
  labeled?: boolean;
  name: string;
  values: string[];
}) {
  return (
    <SegmentedTabs
      className="x-nt-wallpaper-tabs x-nt-row-tabs"
      indicatorClassName="x-nt-wallpaper-tabs-indicator"
      indicatorRef={`${name}Indicator`}
      name={`${name}Tabs`}
      role="group"
    >
      {values.map((value) => (
        <button
          {...{ [attribute]: value }}
          aria-pressed="false"
          className="x-nt-segmented-tab x-nt-wallpaper-tab"
          data-active="false"
          key={value}
          type="button"
        >
          {labeled ? value : null}
        </button>
      ))}
    </SegmentedTabs>
  );
}

// Whole-number slider with its value box; the page runtime sets the value and labels.
function CountSlider({
  defaultValue,
  marks,
  max,
  min,
  name
}: {
  defaultValue: string;
  marks: number[];
  max: string;
  min: string;
  name: string;
}) {
  return (
    <div className="x-nt-overlay-control">
      <RangeSliderField
        label={<span {...ref(`${name}Label`)} className="x-nt-appearance-setting-title" />}
        {...ref(`${name}Slider`)}
        className="x-nt-overlay-slider-wrap"
        defaultValue={defaultValue}
        inputClass="x-nt-overlay-slider"
        max={max}
        min={min}
        rowClassName="x-nt-range-slider-row"
        step="1"
        valueInputProps={{
          ...ref(`${name}SliderValueInput`),
          defaultValue,
          inputMode: 'numeric'
        }}
        marks={marks}
      />
    </div>
  );
}

function WallpaperTile({
  checkIcon,
  item
}: {
  checkIcon: string;
  item: WallpaperItem;
}) {
  return (
    <button
      aria-pressed="false"
      className="x-nt-wallpaper-tile"
      data-selected="false"
      data-wallpaper-id={item.id}
      data-wallpaper-path={item.path}
      type="button"
    >
      <span className="x-nt-wallpaper-thumb">
        <img
          alt=""
          decoding="async"
          draggable={false}
          loading="lazy"
          src={item.thumbnailUrl}
        />
      </span>
      <span
        className="x-nt-wallpaper-check"
        dangerouslySetInnerHTML={{
          __html: checkIcon
        }}
      />
    </button>
  );
}

function FaviconTile({
  checkIcon,
  item
}: {
  checkIcon: string;
  item: FaviconItem;
}) {
  return (
    <button
      aria-pressed="false"
      className="x-nt-wallpaper-tile x-nt-favicon-option"
      data-newtab-favicon-id={item.id}
      data-selected="false"
      type="button"
    >
      <span className="x-nt-wallpaper-thumb x-nt-favicon-thumb">
        {item.inlineSvg ? (
          <span
            aria-hidden="true"
            className="x-nt-favicon-image x-nt-favicon-svg-preview"
            dangerouslySetInnerHTML={{ __html: item.inlineSvg }}
          />
        ) : (
          <img
            alt=""
            className="x-nt-favicon-image"
            draggable={false}
            src={item.previewUrl}
          />
        )}
      </span>
      <span
        className="x-nt-wallpaper-check"
        dangerouslySetInnerHTML={{ __html: checkIcon }}
      />
    </button>
  );
}

function WallpaperPanel({ model }: { model: Record<string, any> }) {
  const defaultTicks: RangeSliderTick[] = [
    { align: 'start', label: '0' },
    { key: 'default', label: 'Default' },
    { align: 'end', label: '100%' }
  ];
  const checkIcon = String(model.icons?.check || '');
  const arrowIcon = String(model.icons?.arrow || '');
  const topContentOptions: TopContentItem[] = Array.isArray(model.topContentOptions)
    ? model.topContentOptions
    : [
        { value: 'brand', label: 'Brand' },
        { value: 'time', label: 'Time' },
        { value: 'off', label: 'Hide' }
      ];
  const timeFontWeightMin = Number(model.timeFontWeight?.min) || 300;
  const timeFontWeightMax = Number(model.timeFontWeight?.max) || 800;
  const timeFontWeightDefault = Number(model.timeFontWeight?.defaultValue) || 320;
  const timeFontWeightTicks: RangeSliderTick[] = [
    { align: 'start', label: String(timeFontWeightMin) },
    {
      label: String(Math.round((timeFontWeightMin + timeFontWeightMax) / 2))
    },
    { align: 'end', label: String(timeFontWeightMax) }
  ];
  const curatedCategories: CuratedCategoryItem[] = Array.isArray(model.curatedCategories)
    ? model.curatedCategories
    : [];
  const effectInkTones: EffectInkToneItem[] = Array.isArray(model.effectInkTones)
    ? model.effectInkTones
    : DEFAULT_EFFECT_INK_TONES;
  const shortcutColumnsMin = Number(model.shortcutColumns?.min) || 4;
  const shortcutColumnsMax = Math.max(
    shortcutColumnsMin,
    Number(model.shortcutColumns?.max) || 16
  );
  const shortcutColumnsDefault = Math.min(
    shortcutColumnsMax,
    Math.max(
      shortcutColumnsMin,
      Number(model.shortcutColumns?.defaultValue) || 10
    )
  );
  const shortcutColumnTicks: RangeSliderTick[] = Array.isArray(
    model.shortcutColumns?.ticks
  )
    ? model.shortcutColumns.ticks
    : [
        { align: 'start', label: '4', percent: 0 },
        { label: '8', percent: 100 / 3 },
        { label: '12', percent: 200 / 3 },
        { align: 'end', label: '16', percent: 100 }
      ];
  const shortcutSizeMin = Number(model.shortcutSize?.min) || 48;
  const shortcutSizeMax = Math.max(
    shortcutSizeMin,
    Number(model.shortcutSize?.max) || 80
  );
  const shortcutSizeDefault = Math.min(
    shortcutSizeMax,
    Math.max(shortcutSizeMin, Number(model.shortcutSize?.defaultValue) || 64)
  );
  const shortcutSizeTicks: RangeSliderTick[] = Array.isArray(
    model.shortcutSize?.ticks
  )
    ? model.shortcutSize.ticks
    : [
        { align: 'start', label: '48', percent: 0 },
        { label: '64', percent: 50 },
        { align: 'end', label: '80', percent: 100 }
      ];
  const shortcutGapMin = Number.isFinite(Number(model.shortcutGap?.min))
    ? Number(model.shortcutGap.min)
    : 0;
  const shortcutGapMax = Math.max(
    shortcutGapMin,
    Number(model.shortcutGap?.max) || 24
  );
  const shortcutGapModelValue = Number(model.shortcutGap?.defaultValue);
  const shortcutGapDefault = Math.min(
    shortcutGapMax,
    Math.max(
      shortcutGapMin,
      Number.isFinite(shortcutGapModelValue) ? shortcutGapModelValue : 4
    )
  );
  const shortcutGapTicks: RangeSliderTick[] = Array.isArray(
    model.shortcutGap?.ticks
  )
    ? model.shortcutGap.ticks
    : [
        { align: 'start', label: '0', percent: 0 },
        { label: '8', percent: 100 / 3 },
        { label: '16', percent: 200 / 3 },
        { align: 'end', label: '24', percent: 100 }
      ];
  return (
    <>
      <div
        {...ref('panel')}
        aria-modal="false"
        className="x-nt-wallpaper-panel"
        data-open="false"
        role="dialog"
      >
        <div className="x-nt-appearance-header">
          <div
            {...ref('appearanceTitle')}
            className="x-nt-wallpaper-panel-title"
          />
          <LinkButton
            {...ref('moreSettingsLink')}
            className="x-nt-appearance-more-settings"
            href={model.moreSettingsUrl}
            labelProps={{
              ...ref('moreSettingsText'),
              className: 'x-nt-appearance-more-settings-text'
            }}
          />
        </div>
        <div className="x-nt-wallpaper-panel-scroll">
          <div className="x-nt-appearance-section">
            <div className="x-nt-wallpaper-panel-header">
              <div className="x-nt-appearance-title-group">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_theme_section_body_2026_unique_"
                  expanded
                  titleRef="themeSectionTitle"
                  triggerRef="themeSectionTrigger"
                />
                <button
                  {...ref('appearanceInfoButton')}
                  className="x-nt-appearance-info-button"
                  dangerouslySetInnerHTML={{
                    __html: String(model.icons?.info || '')
                  }}
                  type="button"
                />
              </div>
              <SegmentedTabs
                ariaLabel="Theme scope"
                className="x-nt-wallpaper-tabs x-nt-appearance-scope-tabs"
                indicatorClassName="x-nt-wallpaper-tabs-indicator"
                indicatorRef="appearanceScopeTabsIndicator"
                name="appearanceScopeTabs"
                role="group"
              >
                {['global', 'home'].map((scope) => (
                  <button
                    aria-pressed="false"
                    className="x-nt-segmented-tab x-nt-wallpaper-tab x-nt-appearance-scope-tab"
                    data-active="false"
                    data-theme-scope={scope}
                    key={scope}
                    type="button"
                  >
                    {scope === 'home' ? 'New Tab' : 'Global'}
                  </button>
                ))}
              </SegmentedTabs>
            </div>
            <div
              {...ref('themeSectionBody')}
              className="x-nt-panel-section-body x-nt-panel-collapsible"
              data-visible="true"
              id="_x_extension_newtab_theme_section_body_2026_unique_"
            >
              <div
                {...ref('appearanceOptions')}
                className="x-nt-appearance-options"
              >
                {model.appearanceOptions.map(
                  (item: { imageUrl: string; mode: string }) => (
                    <button
                      aria-pressed="false"
                      className="x-nt-appearance-option"
                      data-selected="false"
                      data-theme-mode={item.mode}
                      key={item.mode}
                      type="button"
                    >
                      <span className="x-nt-appearance-option-content">
                        <span className="x-nt-appearance-preview">
                          <img alt="" draggable={false} src={item.imageUrl} />
                          <span
                            className="x-nt-appearance-check"
                            dangerouslySetInnerHTML={{ __html: checkIcon }}
                          />
                        </span>
                        <span className="x-nt-appearance-label" />
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section x-nt-search-section">
            <div className="x-nt-wallpaper-panel-header">
              <SectionTrigger
                arrowIcon={arrowIcon}
                bodyId="_x_extension_newtab_search_section_body_2026_unique_"
                expanded
                titleRef="searchSectionTitle"
                triggerRef="searchSectionTrigger"
              />
            </div>
            <div
              {...ref('searchSectionBody')}
              className="x-nt-panel-section-body x-nt-panel-collapsible"
              data-visible="true"
              id="_x_extension_newtab_search_section_body_2026_unique_"
            >
              <div
                {...ref('searchWidthControl')}
                aria-hidden="true"
                className="x-nt-overlay-control x-nt-search-width-control"
                data-visible="false"
              >
                <RangeSliderField
                  label={<span {...ref('searchWidthLabel')} className="x-nt-appearance-setting-title" />}
                  {...ref('searchWidthSlider')}
                  className="x-nt-overlay-slider-wrap x-nt-search-width-slider-wrap"
                  data-value-suffix=" px"
                  inputClass="x-nt-overlay-slider x-nt-search-width-slider"
                  max={String(model.searchWidth.max)}
                  min={String(model.searchWidth.min)}
                  rowClassName="x-nt-range-slider-row"
                  step="1"
                  valueInputProps={{
                    ...ref('searchWidthSliderValueInput'),
                    'aria-label': 'Search box width value',
                    defaultValue: String(model.searchWidth.min),
                    inputMode: 'numeric'
                  }}
                  marks={tickMarks(model.searchWidth.ticks)}
                />
              </div>
              <div className="x-nt-appearance-setting-row">
                <span className="x-nt-appearance-setting-title-group">
                  <span
                    {...ref('inputAutoFocusTitle')}
                    className="x-nt-appearance-setting-title"
                  />
                  <button
                    {...ref('inputAutoFocusInfoButton')}
                    className="x-nt-appearance-info-button"
                    dangerouslySetInnerHTML={{
                      __html: String(model.icons?.info || '')
                    }}
                    type="button"
                  />
                </span>
                <Switch
                  ariaLabel="Automatically focus the search input"
                  name="inputAutoFocusToggle"
                />
              </div>
              <div className="x-nt-appearance-setting-row x-nt-top-content-header">
                <div
                  {...ref('topContentTitle')}
                  className="x-nt-appearance-setting-title"
                />
                <SegmentedTabs
                  ariaLabel="Content above the search bar"
                  className="x-nt-wallpaper-tabs x-nt-top-content-tabs"
                  indicatorClassName="x-nt-wallpaper-tabs-indicator"
                  indicatorRef="topContentTabsIndicator"
                  name="topContentTabs"
                  role="group"
                >
                  {topContentOptions.map((item) => (
                    <button
                      {...ref(
                        item.value === 'brand'
                          ? 'topContentBrandTab'
                          : item.value === 'time'
                            ? 'topContentTimeTab'
                            : 'topContentOffTab'
                      )}
                      aria-pressed={item.value === 'brand'}
                      className="x-nt-segmented-tab x-nt-wallpaper-tab x-nt-top-content-tab"
                      data-active={item.value === 'brand' ? 'true' : 'false'}
                      data-newtab-top-content={item.value}
                      key={item.value}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </SegmentedTabs>
              </div>
              <div
                {...ref('topContentWeightControl')}
                aria-hidden="true"
                className="x-nt-time-weight-control x-nt-panel-collapsible"
                data-visible="false"
                hidden
              >
                <RangeSliderField
                  label={<span {...ref('topContentWeightTitle')} className="x-nt-appearance-setting-title">Time font weight</span>}
                  {...ref('topContentWeightSlider')}
                  className="x-nt-overlay-slider-wrap x-nt-time-weight-slider-wrap"
                  inputClass="x-nt-overlay-slider x-nt-time-weight-slider"
                  max={String(timeFontWeightMax)}
                  min={String(timeFontWeightMin)}
                  rowClassName="x-nt-range-slider-row"
                  step="1"
                  defaultValue={String(timeFontWeightDefault)}
                  valueInputProps={{
                    ...ref('topContentWeightSliderValueInput'),
                    'aria-label': 'Time font weight value',
                    defaultValue: String(timeFontWeightDefault),
                    inputMode: 'numeric'
                  }}
                  marks={tickMarks(timeFontWeightTicks)}
                />
              </div>
              <div
                {...ref('topContentSecondsRow')}
                aria-hidden="true"
                className="x-nt-top-content-seconds-row x-nt-panel-collapsible"
                data-visible="false"
                hidden
              >
                <span
                  {...ref('topContentSecondsTitle')}
                  className="x-nt-top-content-seconds-title"
                >
                  Show seconds
                </span>
                <Switch
                  ariaLabel="Show seconds"
                  name="topContentSecondsToggle"
                />
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section">
            <div
              {...ref('shortcutsAccordion')}
              className="x-nt-shortcuts-accordion"
              data-expanded="false"
              data-enabled="true"
            >
              <div className="x-nt-wallpaper-panel-header x-nt-shortcuts-accordion-row">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_shortcuts_settings_2026_unique_"
                  expanded={false}
                  id="_x_extension_newtab_shortcuts_accordion_trigger_2026_unique_"
                  titleRef="shortcutsTitle"
                  triggerRef="shortcutsAccordionTrigger"
                />
                <Switch
                  ariaLabel="Shortcuts"
                  name="shortcutsToggle"
                />
              </div>
              <div
                {...ref('shortcutsDetails')}
                aria-hidden="true"
                aria-labelledby="_x_extension_newtab_shortcuts_accordion_trigger_2026_unique_"
                className="x-nt-shortcuts-accordion-details x-nt-panel-collapsible"
                data-visible="false"
                hidden
                id="_x_extension_newtab_shortcuts_settings_2026_unique_"
                role="region"
              >
                <div className="x-nt-shortcuts-accordion-details-inner">
                  <div className="x-nt-appearance-setting-row">
                    <span
                      {...ref('shortcutAddTitle')}
                      className="x-nt-appearance-setting-title"
                    />
                    <Switch
                      ariaLabel="Show “+”"
                      name="shortcutAddToggle"
                    />
                  </div>
                  <div className="x-nt-appearance-setting-row">
                    <span
                      {...ref('shortcutDockMagnificationTitle')}
                      className="x-nt-appearance-setting-title"
                    />
                    <Switch
                      ariaLabel="macOS Dock-style magnification"
                      name="shortcutDockMagnificationToggle"
                    />
                  </div>
                  <div
                    {...ref('shortcutColumnsControl')}
                    aria-hidden="true"
                    className="x-nt-overlay-control x-nt-shortcut-columns-control"
                    data-visible="false"
                  >
                    <RangeSliderField
                      label={<span {...ref('shortcutColumnsLabel')} className="x-nt-appearance-setting-title" />}
                      {...ref('shortcutColumnsSlider')}
                      className="x-nt-overlay-slider-wrap x-nt-shortcut-columns-slider-wrap"
                      defaultValue={String(shortcutColumnsDefault)}
                      inputClass="x-nt-overlay-slider x-nt-shortcut-columns-slider"
                      max={String(shortcutColumnsMax)}
                      min={String(shortcutColumnsMin)}
                      rowClassName="x-nt-range-slider-row"
                      step="1"
                      valueInputProps={{
                        ...ref('shortcutColumnsSliderValueInput'),
                        'aria-label': 'Shortcuts per row value',
                        defaultValue: String(shortcutColumnsDefault),
                        inputMode: 'numeric'
                      }}
                      marks={tickMarks(shortcutColumnTicks)}
                    />
                  </div>
                  <div
                    {...ref('shortcutSizeControl')}
                    aria-hidden="true"
                    className="x-nt-overlay-control x-nt-shortcut-size-control"
                    data-visible="false"
                  >
                    <RangeSliderField
                      label={<span {...ref('shortcutSizeLabel')} className="x-nt-appearance-setting-title" />}
                      {...ref('shortcutSizeSlider')}
                      className="x-nt-overlay-slider-wrap x-nt-shortcut-size-slider-wrap"
                      data-value-suffix=" px"
                      defaultValue={String(shortcutSizeDefault)}
                      inputClass="x-nt-overlay-slider x-nt-shortcut-size-slider"
                      max={String(shortcutSizeMax)}
                      min={String(shortcutSizeMin)}
                      resetButtonProps={{
                        ...ref('shortcutSizeResetButton'),
                        'aria-label': 'Reset shortcut size',
                        disabled: true,
                        title: 'Reset shortcut size'
                      }}
                      rowClassName="x-nt-range-slider-row"
                      step="1"
                      valueInputProps={{
                        ...ref('shortcutSizeSliderValueInput'),
                        'aria-label': 'Shortcut size value',
                        defaultValue: String(shortcutSizeDefault),
                        inputMode: 'numeric'
                      }}
                      marks={tickMarks(shortcutSizeTicks)}
                    />
                  </div>
                  <div
                    {...ref('shortcutGapControl')}
                    aria-hidden="true"
                    className="x-nt-overlay-control x-nt-shortcut-gap-control"
                    data-visible="false"
                  >
                    <RangeSliderField
                      label={<span {...ref('shortcutGapLabel')} className="x-nt-appearance-setting-title" />}
                      {...ref('shortcutGapSlider')}
                      className="x-nt-overlay-slider-wrap x-nt-shortcut-gap-slider-wrap"
                      data-value-suffix=" px"
                      defaultValue={String(shortcutGapDefault)}
                      inputClass="x-nt-overlay-slider x-nt-shortcut-gap-slider"
                      max={String(shortcutGapMax)}
                      min={String(shortcutGapMin)}
                      resetButtonProps={{
                        ...ref('shortcutGapResetButton'),
                        'aria-label': 'Reset shortcut spacing',
                        disabled: true,
                        title: 'Reset shortcut spacing'
                      }}
                      rowClassName="x-nt-range-slider-row"
                      step="1"
                      valueInputProps={{
                        ...ref('shortcutGapSliderValueInput'),
                        'aria-label': 'Shortcut spacing value',
                        defaultValue: String(shortcutGapDefault),
                        inputMode: 'numeric'
                      }}
                      marks={tickMarks(shortcutGapTicks)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <ToggleSection arrowIcon={arrowIcon} name="bookmarkSettings">
            <SettingRow titleRef="bookmarkViewModeLabel">
              <RowSelect hostRef="bookmarkViewModeSelectHost" />
            </SettingRow>
            {/* Rows and columns shape the bookmark grid; the top bar has its own shape and background. */}
            <div {...ref('bookmarkGridSettings')} className="x-nt-panel-field-group x-nt-panel-collapsible">
              <CountSlider defaultValue="2" marks={[0, 300 / 7, 100]} max="8" min="1" name="bookmarkRows" />
              <CountSlider defaultValue="6" marks={[0, 50, 100]} max="8" min="4" name="bookmarkColumns" />
              <SettingRow titleRef="bookmarkFolderIconsTitle">
                <Switch name="bookmarkFolderIconsToggle" />
              </SettingRow>
            </div>
            <div {...ref('bookmarkTopbarSettings')} className="x-nt-panel-field-group x-nt-panel-collapsible" hidden>
              <SettingRow titleRef="bookmarkTopbarLayoutLabel">
                <RowTabs attribute="data-bookmark-topbar-layout" name="bookmarkTopbarLayout" values={['docked', 'floating']} />
              </SettingRow>
              <SettingRow titleRef="bookmarkTopbarSurfaceLabel">
                <RowSelect hostRef="bookmarkTopbarSurfaceSelectHost" />
              </SettingRow>
            </div>
          </ToggleSection>
          <div className="x-nt-panel-divider" />
          <ToggleSection arrowIcon={arrowIcon} name="recentSettings">
            <SettingRow titleRef="recentModeLabel">
              <RowTabs attribute="data-recent-mode" name="recentMode" values={['latest', 'most', 'custom']} />
            </SettingRow>
            <SettingRow titleRef="recentRowsLabel">
              <RowTabs attribute="data-recent-rows" labeled name="recentRows" values={['1', '2']} />
            </SettingRow>
          </ToggleSection>
          <div {...ref('quoteDivider')} className="x-nt-panel-divider" />
          <div {...ref('quoteSection')} className="x-nt-wallpaper-section x-nt-quote-settings">
            <div className="x-nt-wallpaper-panel-header">
              <span className="x-nt-appearance-title-group">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_quote_section_body_2026_unique_"
                  expanded={false}
                  titleRef="quoteTitle"
                  triggerRef="quoteAccordionTrigger"
                />
                <button
                  {...ref('quoteInfoButton')}
                  className="x-nt-appearance-info-button"
                  dangerouslySetInnerHTML={{
                    __html: String(model.icons?.info || '')
                  }}
                  type="button"
                />
              </span>
              <Switch name="quoteEnabledToggle" />
            </div>
            <div
              {...ref('quoteBody')}
              className="x-nt-quote-body x-nt-panel-collapsible"
              hidden
              id="_x_extension_newtab_quote_section_body_2026_unique_"
            >
              <SettingRow titleRef="quoteSourceLabel">
                <div {...ref('quoteSource')} className="x-nt-wallpaper-tabs x-nt-quote-source-tabs" role="group">
                  {['hitokoto', 'custom'].map(provider => <button type="button" className="x-nt-wallpaper-tab"
                    data-quote-provider={provider} key={provider} aria-pressed="false" />)}
                </div>
              </SettingRow>
              <div {...ref('quoteCustomBody')} className="x-nt-quote-custom-body" hidden>
                <button {...ref('quoteImportButton')} type="button" className="x-lumno-action-button x-lumno-action-button--secondary" />
                <input {...ref('quoteFileInput')} type="file" accept=".txt,.md,.markdown,text/markdown,text/plain" hidden />
                <p {...ref('quoteImportHint')} className="x-nt-quote-import-hint" />
                <p {...ref('quoteImportStatus')} className="x-nt-quote-import-status" role="status" />
              </div>
              <div className="x-nt-appearance-setting-row">
                <span {...ref('quoteCategoryLabel')} className="x-nt-appearance-setting-title" />
                <SegmentedTabs
                  className="x-nt-wallpaper-tabs x-nt-quote-tabs x-nt-row-tabs"
                  indicatorClassName="x-nt-wallpaper-tabs-indicator"
                  indicatorRef="quoteCategoryIndicator"
                  name="quoteCategory"
                  role="group"
                >
                  {['literature', 'poetry'].map((category) => (
                    <button
                      aria-pressed="false"
                      className="x-nt-segmented-tab x-nt-wallpaper-tab"
                      data-quote-category={category}
                      key={category}
                      type="button"
                    />
                  ))}
                </SegmentedTabs>
              </div>
              <SettingRow titleRef="quotePositionLabel">
                <RowSelect hostRef="quotePositionSelectHost" />
              </SettingRow>
              <div {...ref('quoteFontSizeRow')} className="x-nt-overlay-control x-nt-quote-font-size">
                <RangeSliderField
                  label={<span {...ref('quoteFontSizeTitle')} className="x-nt-appearance-setting-title" />}
                  {...ref('quoteFontSizeSlider')}
                  className="x-nt-overlay-slider-wrap"
                  inputClass="x-nt-overlay-slider"
                  min={String(model.quoteFontSize?.min ?? 12)}
                  max={String(model.quoteFontSize?.max ?? 24)}
                  defaultValue={String(model.quoteFontSize?.defaultValue ?? 15)}
                  step="1"
                  rowClassName="x-nt-range-slider-row"
                  valueInputProps={{
                    ...ref('quoteFontSizeSliderValueInput'),
                    defaultValue: String(model.quoteFontSize?.defaultValue ?? 15),
                    inputMode: 'numeric'
                  }}
                />
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section">
            <div
              {...ref('panelHeader')}
              className="x-nt-wallpaper-panel-header"
            >
              <SectionTrigger
                arrowIcon={arrowIcon}
                bodyId="_x_extension_newtab_wallpaper_body_2026_unique_"
                expanded
                titleRef="panelTitle"
                triggerRef="wallpaperAccordionTrigger"
              />
              <Switch name="enabledToggle" />
            </div>
            <input
              {...ref('customInput')}
              accept="image/*"
              className="x-nt-wallpaper-file-input"
              tabIndex={-1}
              type="file"
            />
            <div
              {...ref('body')}
              aria-hidden="false"
              className="x-nt-wallpaper-body x-nt-panel-collapsible"
              data-active-tab={model.activeTab || 'built-in'}
              id="_x_extension_newtab_wallpaper_body_2026_unique_"
              data-visible="true"
            >
              <div className="x-nt-wallpaper-mode-sync">
                <span
                  {...ref('modeSyncTitle')}
                  className="x-nt-wallpaper-mode-sync-title"
                />
                <Switch name="modeSyncToggle" />
              </div>
              <div className="x-nt-wallpaper-tab-group">
                <div
                  {...ref('modeRow')}
                  aria-hidden="true"
                  className="x-nt-appearance-setting-row x-nt-wallpaper-mode-row"
                  data-visible="false"
                >
                  <span {...ref('modeLabel')} className="x-nt-appearance-setting-title" />
                  <SegmentedTabs
                    className="x-nt-wallpaper-tabs x-nt-wallpaper-mode-tabs x-nt-row-tabs"
                    indicatorClassName="x-nt-wallpaper-tabs-indicator x-nt-wallpaper-mode-tabs-indicator"
                    indicatorRef="modeTabsIndicator"
                    name="modeTabs"
                    role="tablist"
                  >
                    {['light', 'dark'].map((mode) => (
                      <button
                        {...ref(mode === 'light' ? 'lightModeTab' : 'darkModeTab')}
                        aria-selected="false"
                        className="x-nt-segmented-tab x-nt-wallpaper-tab x-nt-wallpaper-mode-tab"
                        data-active="false"
                        data-wallpaper-mode={mode}
                        key={mode}
                        role="tab"
                        type="button"
                      >
                        {mode === 'light' ? 'Light' : 'Dark'}
                      </button>
                    ))}
                  </SegmentedTabs>
                </div>
                <div className="x-nt-appearance-setting-row">
                  <span {...ref('sourceLabel')} className="x-nt-appearance-setting-title" />
                  <SegmentedTabs
                    className="x-nt-wallpaper-tabs x-nt-row-tabs"
                    indicatorClassName="x-nt-wallpaper-tabs-indicator"
                    indicatorRef="tabsIndicator"
                    name="tabs"
                    role="tablist"
                  >
                    {WALLPAPER_SOURCE_TABS.map((item) => (
                      <button
                        {...ref(item.name)}
                        aria-selected="false"
                        className="x-nt-segmented-tab x-nt-wallpaper-tab"
                        data-active="false"
                        data-wallpaper-tab={item.tab}
                        key={item.tab}
                        role="tab"
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </SegmentedTabs>
                </div>
              </div>
              <div
                {...ref('builtInGrid')}
                className="x-nt-wallpaper-grid x-nt-wallpaper-grid--built-in"
                data-wallpaper-panel="built-in"
                role="tabpanel"
              >
                {model.wallpapers.map((item: WallpaperItem) => (
                  <WallpaperTile
                    checkIcon={checkIcon}
                    item={item}
                    key={item.id}
                  />
                ))}
              </div>
              <div
                {...ref('localGrid')}
                className="x-nt-wallpaper-grid x-nt-wallpaper-grid--local"
                data-wallpaper-panel="local"
                role="tabpanel"
              >
                <div
                  {...ref('uploadTile')}
                  aria-pressed="false"
                  className="x-nt-wallpaper-tile x-nt-wallpaper-upload-tile"
                  data-loading="false"
                  data-selected="false"
                  data-upload="true"
                  role="button"
                  tabIndex={0}
                >
                  <span className="x-nt-wallpaper-thumb x-nt-wallpaper-upload-thumb">
                    <span
                      className="x-nt-wallpaper-upload-placeholder"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.add || '')
                      }}
                    />
                  </span>
                </div>
                <div
                  {...ref('urlTile')}
                  aria-controls="_x_extension_newtab_wallpaper_url_form_2026_unique_"
                  aria-expanded="false"
                  className="x-nt-wallpaper-tile x-nt-wallpaper-upload-tile x-nt-wallpaper-url-tile"
                  data-selected="false"
                  role="button"
                  tabIndex={0}
                >
                  <span className="x-nt-wallpaper-thumb x-nt-wallpaper-upload-thumb">
                    <span
                      className="x-nt-wallpaper-upload-placeholder"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.link || '')
                      }}
                    />
                  </span>
                </div>
                <span
                  {...ref('customItemsHost')}
                  data-wallpaper-custom-items=""
                  style={{ display: 'contents' }}
                />
              </div>
              <form
                {...ref('urlForm')}
                className="x-nt-wallpaper-url-form"
                hidden
                id="_x_extension_newtab_wallpaper_url_form_2026_unique_"
                noValidate
              >
                <input
                  {...ref('urlInput')}
                  autoComplete="off"
                  className="_x_extension_shortcut_input_2024_unique_ x-nt-wallpaper-url-input"
                  inputMode="url"
                  spellCheck={false}
                  type="url"
                />
                <button
                  {...ref('urlSubmit')}
                  className="x-lumno-action-button x-lumno-action-button--secondary x-nt-wallpaper-url-submit"
                  type="submit"
                />
              </form>
              <div {...ref('bingPanel')} className="x-nt-bing-panel" data-wallpaper-panel="bing" role="tabpanel" aria-hidden="true">
                <div className="x-nt-wallpaper-mode-sync">
                  <span className="x-nt-appearance-setting-title-group">
                    <span {...ref('bingDailyLabel')} className="x-nt-wallpaper-mode-sync-title" />
                    <button
                      {...ref('bingDailyInfoButton')}
                      className="x-nt-appearance-info-button"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.info || '')
                      }}
                      type="button"
                    />
                  </span>
                  <span className="x-nt-daily-actions">
                    <button
                      {...ref('bingDailyRestore')}
                      className="x-nt-panel-icon-button x-nt-daily-restore"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.restore || '')
                      }}
                      hidden
                      type="button"
                    />
                    <Switch name="bingDailyToggle" />
                  </span>
                </div>
                <div className="x-nt-bing-recent">
                  <div className="x-nt-overlay-control-header">
                    <span {...ref('bingRecentLabel')} className="x-nt-appearance-setting-title" />
                    <button
                      {...ref('bingRefresh')}
                      aria-busy="false"
                      className="x-nt-panel-icon-button x-nt-bing-refresh"
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="x-nt-bing-refresh-glyph x-lumno-busy-spin"
                        dangerouslySetInnerHTML={{
                          __html: String(model.icons?.refresh || '')
                        }}
                      />
                    </button>
                  </div>
                  <div {...ref('bingItemsHost')} className="x-nt-wallpaper-grid x-nt-wallpaper-grid--bing" />
                  <div {...ref('bingStatus')} className="x-nt-bing-status" role="status" aria-live="polite" />
                  <div {...ref('bingSelectedSource')} className="x-nt-bing-source" hidden>
                    <LinkButton
                      {...ref('bingSelectedLink')}
                      className="x-nt-bing-source-link"
                      external
                      labelProps={ref('bingSelectedTitle')}
                    />
                    <p {...ref('bingSelectedMeta')} className="x-nt-bing-source-meta" />
                  </div>
                </div>
              </div>
              <div {...ref('curatedPanel')} className="x-nt-curated-panel" data-wallpaper-panel="curated" role="tabpanel" aria-hidden="true">
                <div className="x-nt-wallpaper-mode-sync">
                  <span className="x-nt-appearance-setting-title-group">
                    <span {...ref('curatedDailyLabel')} className="x-nt-wallpaper-mode-sync-title" />
                    <button
                      {...ref('curatedDailyInfoButton')}
                      className="x-nt-appearance-info-button"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.info || '')
                      }}
                      type="button"
                    />
                  </span>
                  <span className="x-nt-daily-actions">
                    <button
                      {...ref('curatedDailyRestore')}
                      className="x-nt-panel-icon-button x-nt-daily-restore"
                      dangerouslySetInnerHTML={{
                        __html: String(model.icons?.restore || '')
                      }}
                      hidden
                      type="button"
                    />
                    <Switch name="curatedDailyToggle" />
                  </span>
                </div>
                <div className="x-nt-appearance-setting-row">
                  <span {...ref('curatedCategoryLabel')} className="x-nt-appearance-setting-title" />
                  <SegmentedTabs
                    className="x-nt-wallpaper-tabs x-nt-row-tabs"
                    indicatorClassName="x-nt-wallpaper-tabs-indicator"
                    indicatorRef="curatedCategoryIndicator"
                    name="curatedCategoryTabs"
                    role="group"
                  >
                    {curatedCategories.map((item) => (
                      <button
                        aria-pressed="false"
                        className="x-nt-segmented-tab x-nt-wallpaper-tab"
                        data-active="false"
                        data-curated-category={item.value}
                        key={item.value}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </SegmentedTabs>
                </div>
                <div className="x-nt-bing-recent">
                  <div className="x-nt-overlay-control-header">
                    <span {...ref('curatedListLabel')} className="x-nt-appearance-setting-title" />
                    <button
                      {...ref('curatedRefresh')}
                      className="x-nt-panel-icon-button x-nt-bing-refresh"
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="x-nt-bing-refresh-glyph"
                        dangerouslySetInnerHTML={{
                          __html: String(model.icons?.refresh || '')
                        }}
                      />
                    </button>
                  </div>
                  <div {...ref('curatedItemsHost')} className="x-nt-wallpaper-grid x-nt-wallpaper-grid--curated" />
                  <div {...ref('curatedSelectedSource')} className="x-nt-bing-source" hidden>
                    <LinkButton
                      {...ref('curatedSelectedLink')}
                      className="x-nt-bing-source-link"
                      external
                      labelProps={ref('curatedSelectedTitle')}
                    />
                    <p {...ref('curatedSelectedMeta')} className="x-nt-bing-source-meta" />
                  </div>
                </div>
              </div>
              <div className="x-nt-panel-divider x-nt-panel-divider--inset" />
              <div className="x-nt-effect-control">
                <SliderControl
                  controlClass="x-nt-overlay-control x-nt-overlay-control--effect"
                  controlRef="overlayControl"
                  labelRef="overlayLabel"
                  sliderClass="x-nt-overlay-slider"
                  sliderRef="overlaySlider"
                  ticks={[
                    {
                      align: 'start',
                      key: 'transparent',
                      label: 'Transparent'
                    },
                    { key: 'default', label: 'Default' },
                    { align: 'end', key: 'cover', label: 'Cover' }
                  ]}
                  wrapClass="x-nt-overlay-slider-wrap"
                />
                <div className="x-nt-appearance-setting-row x-nt-effect-control-header">
                  <span
                    {...ref('effectLabel')}
                    className="x-nt-appearance-setting-title x-nt-effect-label"
                  />
                  <div
                    {...ref('effectSelectHost')}
                    className="_x_extension_select_wrap_2024_unique_ _x_extension_custom_select_2024_unique_ x-nt-row-select"
                  />
                </div>
                <div
                  {...ref('effectInkToneControl')}
                  aria-hidden="true"
                  className="x-nt-effect-slider-control x-nt-effect-ink-tone-control"
                  data-visible="false"
                >
                  <div className="x-nt-appearance-setting-row">
                    <span {...ref('effectInkToneLabel')} className="x-nt-appearance-setting-title" />
                    <SegmentedTabs
                      className="x-nt-effect-options x-nt-effect-ink-tone-options x-nt-row-tabs"
                      indicatorClassName="x-nt-effect-indicator"
                      indicatorRef="effectInkToneIndicator"
                      name="effectInkToneOptions"
                      role="group"
                    >
                      {effectInkTones.map(
                        (item) => (
                          <button
                            aria-pressed="false"
                            className="x-nt-segmented-tab x-nt-effect-option x-nt-effect-ink-tone-option"
                            data-active="false"
                            data-wallpaper-effect-ink-tone={item.tone}
                            key={item.tone}
                            type="button"
                          >
                            {item.fallback}
                          </button>
                        )
                      )}
                    </SegmentedTabs>
                  </div>
                </div>
                <SliderControl
                  controlRef="effectStrengthControl"
                  labelRef="effectStrengthLabel"
                  sliderRef="effectStrengthSlider"
                  ticks={defaultTicks}
                />
                <SliderControl
                  controlRef="effectSizeControl"
                  labelRef="effectSizeLabel"
                  sliderRef="effectSizeSlider"
                  ticks={defaultTicks}
                />
                <SliderControl
                  controlRef="effectSpacingControl"
                  labelRef="effectSpacingLabel"
                  sliderRef="effectSpacingSlider"
                  ticks={defaultTicks}
                />
                <SliderControl
                  controlRef="effectTextureControl"
                  labelRef="effectTextureLabel"
                  sliderRef="effectTextureSlider"
                  ticks={defaultTicks}
                />
                <SliderControl
                  controlRef="effectCrtBloomControl"
                  labelRef="effectCrtBloomLabel"
                  sliderRef="effectCrtBloomSlider"
                  ticks={defaultTicks}
                />
                <SliderControl
                  controlRef="effectCrtRgbOffsetControl"
                  labelRef="effectCrtRgbOffsetLabel"
                  sliderRef="effectCrtRgbOffsetSlider"
                  ticks={defaultTicks}
                />
                <SliderControl
                  controlRef="effectCrtCurvatureControl"
                  labelRef="effectCrtCurvatureLabel"
                  sliderRef="effectCrtCurvatureSlider"
                  ticks={defaultTicks}
                />
              </div>
            </div>
          </div>
          <div className="x-nt-panel-divider" />
          <div className="x-nt-wallpaper-section">
            <div className="x-nt-favicon-group">
              <div className="x-nt-wallpaper-panel-header">
                <SectionTrigger
                  arrowIcon={arrowIcon}
                  bodyId="_x_extension_newtab_favicon_section_body_2026_unique_"
                  expanded
                  titleClassName="x-nt-favicon-title"
                  titleRef="faviconTitle"
                  triggerRef="faviconSectionTrigger"
                />
              </div>
              <div
                {...ref('faviconSectionBody')}
                className="x-nt-panel-section-body x-nt-panel-collapsible"
                data-visible="true"
                id="_x_extension_newtab_favicon_section_body_2026_unique_"
              >
                <div
                  {...ref('faviconOptions')}
                  className="x-nt-favicon-options"
                  role="group"
                >
                  {model.favicons.map((item: FaviconItem) => (
                    <FaviconTile
                      checkIcon={checkIcon}
                      item={item}
                      key={item.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="x-nt-appearance-help-footer">
          <span
            {...ref('helpFooterPrompt')}
            className="x-nt-appearance-help-footer-prompt"
          />
          <LinkButton
            {...ref('helpFooterLink')}
            className="x-nt-appearance-help-footer-link"
            external
            href={model.helpCenterUrl}
            labelProps={ref('helpFooterText')}
          />
        </p>
      </div>
      <button
        {...ref('button')}
        aria-expanded="false"
        aria-haspopup="dialog"
        className="x-nt-wallpaper-button"
        data-active="false"
        data-open="false"
        dangerouslySetInnerHTML={{
          __html: String(model.icons?.wallpaper || '')
        }}
        type="button"
      />
    </>
  );
}

function CustomWallpapers({
  checkIcon,
  deleteIcon,
  items
}: {
  checkIcon: string;
  deleteIcon: string;
  items: WallpaperItem[];
}) {
  return (
    <>
      {items.map((item) => (
        <div
          aria-pressed="false"
          className="x-nt-wallpaper-tile x-nt-wallpaper-custom-tile"
          data-custom-wallpaper="true"
          data-selected="false"
          data-wallpaper-id={item.id}
          key={item.id}
          role="button"
          tabIndex={0}
        >
          <span className="x-nt-wallpaper-thumb">
            <img
              alt=""
              className="x-nt-wallpaper-custom-image"
              decoding="async"
              draggable={false}
              loading="lazy"
              src={item.thumbnailUrl}
            />
          </span>
          <span
            className="x-nt-wallpaper-check"
            dangerouslySetInnerHTML={{ __html: checkIcon }}
          />
          <button
            className="x-nt-wallpaper-delete-button"
            dangerouslySetInnerHTML={{ __html: deleteIcon }}
            type="button"
          />
        </div>
      ))}
    </>
  );
}

export interface PanelSelectModel {
  ariaLabel: string;
  onChange(value: string): void;
  options: SelectMenuOption[];
  value: string;
}

const EFFECT_SELECT_ID = 'x-nt-wallpaper-effect';
const QUOTE_POSITION_SELECT_ID = 'x-nt-quote-position';
const BOOKMARK_VIEW_MODE_SELECT_ID = 'x-nt-bookmark-view-mode';
const BOOKMARK_TOPBAR_SURFACE_SELECT_ID = 'x-nt-bookmark-topbar-surface';

export interface WallpaperViewController {
  button: HTMLButtonElement;
  closeOpenSelect(options?: { restoreFocus?: boolean }): boolean;
  containsSelectMenuTarget(target: Node | null): boolean;
  control: HTMLDivElement;
  destroy(): void;
  getRefs(): Record<string, HTMLElement>;
  panel: HTMLDivElement;
  renderCustomWallpapers(items: WallpaperItem[]): HTMLElement[];
  renderBookmarkTopbarSurfaceSelect(select: PanelSelectModel): void;
  renderBookmarkViewModeSelect(select: PanelSelectModel): void;
  renderEffectSelect(select: PanelSelectModel): void;
  renderQuotePositionSelect(select: PanelSelectModel): void;
  renderCuratedWallpapers(items: WallpaperItem[]): HTMLElement[];
  renderOnlineWallpapers(items: WallpaperItem[]): HTMLElement[];
}

export function createWallpaperViewController(
  config: Record<string, any>
): WallpaperViewController {
  const documentObj: Document = config.documentObj || document;
  const model = config.model || {};
  const control = documentObj.createElement('div');
  control.className = 'x-nt-wallpaper-control';
  control.dataset.panelOpen = 'false';
  control.dataset.reactIsland = 'newtab-wallpaper';
  const root: Root = createRoot(control);
  flushSync(() => root.render(<WallpaperPanel model={model} />));
  const panel = control.querySelector<HTMLDivElement>(
    '[data-wallpaper-ref="panel"]'
  );
  const button = control.querySelector<HTMLButtonElement>(
    '[data-wallpaper-ref="button"]'
  );
  const customItemsHost = control.querySelector<HTMLElement>(
    '[data-wallpaper-ref="customItemsHost"]'
  );
  if (!panel || !button || !customItemsHost) {
    flushSync(() => root.unmount());
    throw new Error('Lumno React wallpaper view did not mount.');
  }
  const customRoot: Root = createRoot(customItemsHost);
  const onlineItemsHost = control.querySelector<HTMLElement>('[data-wallpaper-ref="bingItemsHost"]')!;
  const onlineRoot: Root = createRoot(onlineItemsHost);
  const curatedItemsHost = control.querySelector<HTMLElement>('[data-wallpaper-ref="curatedItemsHost"]')!;
  const curatedRoot: Root = createRoot(curatedItemsHost);
  const renderTiles = (tileRoot: Root, host: HTMLElement, items: WallpaperItem[]) => {
    flushSync(() => tileRoot.render(<>{items.map((item) => (
      <WallpaperTile checkIcon={String(model.icons?.check || '')} item={item} key={item.id} />
    ))}</>));
    return Array.from(host.querySelectorAll<HTMLElement>('.x-nt-wallpaper-tile'));
  };
  // Panel selects render as their own roots; their menus portal to the body.
  const selects = [
    { id: EFFECT_SELECT_ID, ref: 'effectSelectHost' },
    { id: QUOTE_POSITION_SELECT_ID, ref: 'quotePositionSelectHost' },
    { id: BOOKMARK_VIEW_MODE_SELECT_ID, ref: 'bookmarkViewModeSelectHost' },
    { id: BOOKMARK_TOPBAR_SURFACE_SELECT_ID, ref: 'bookmarkTopbarSurfaceSelectHost' }
  ].map(({ id, ref: hostRef }) => {
    const host = control.querySelector<HTMLElement>(`[data-wallpaper-ref="${hostRef}"]`)!;
    return {
      controls: null as { isOpen(): boolean; setOpen(open: boolean): void } | null,
      host,
      id,
      root: createRoot(host) as Root
    };
  });
  const [effectSelect, quotePositionSelect, bookmarkViewModeSelect, bookmarkTopbarSurfaceSelect] = selects;
  const renderSelect = (select: (typeof selects)[number], model: PanelSelectModel) => {
    flushSync(() => select.root.render(
      <SelectMenu
        config={{
          id: select.id,
          selectId: `${select.id}-select`,
          ariaLabel: model.ariaLabel,
          options: model.options,
          value: model.value,
          menuAlign: 'left',
          menuPortal: true,
          menuPortalZIndex: 10020,
          menuWidth: 'trigger',
          onValueChange: model.onChange
        }}
        documentObj={documentObj}
        host={select.host}
        registerControls={(controls) => { select.controls = controls; }}
        windowObj={documentObj.defaultView || window}
      />
    ));
  };
  let destroyed = false;
  const getRefs = () => {
    const refs: Record<string, HTMLElement> = {};
    control
      .querySelectorAll<HTMLElement>('[data-wallpaper-ref]')
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
      flushSync(() => customRoot.unmount());
      flushSync(() => onlineRoot.unmount());
      flushSync(() => curatedRoot.unmount());
      selects.forEach((select) => flushSync(() => select.root.unmount()));
      flushSync(() => root.unmount());
    },
    getRefs,
    panel,
    closeOpenSelect(options?: { restoreFocus?: boolean }) {
      const open = selects.find((select) => select.controls?.isOpen());
      if (!open) {
        return false;
      }
      flushSync(() => open.controls?.setOpen(false));
      if (options?.restoreFocus) {
        open.host.querySelector<HTMLButtonElement>('button')?.focus();
      }
      return true;
    },
    // The menus are portaled to the body but still belong to the panel.
    containsSelectMenuTarget(target: Node | null) {
      return Boolean(target && selects.some((select) => documentObj
        .querySelector(`[data-react-select-owner="${select.id}"]`)?.contains(target)));
    },
    renderEffectSelect(select: PanelSelectModel) {
      if (!destroyed) renderSelect(effectSelect, select);
    },
    renderQuotePositionSelect(select: PanelSelectModel) {
      if (!destroyed) renderSelect(quotePositionSelect, select);
    },
    renderBookmarkViewModeSelect(select: PanelSelectModel) {
      if (!destroyed) renderSelect(bookmarkViewModeSelect, select);
    },
    renderBookmarkTopbarSurfaceSelect(select: PanelSelectModel) {
      if (!destroyed) renderSelect(bookmarkTopbarSurfaceSelect, select);
    },
    renderOnlineWallpapers(items: WallpaperItem[]) {
      return destroyed ? [] : renderTiles(onlineRoot, onlineItemsHost, items);
    },
    renderCuratedWallpapers(items: WallpaperItem[]) {
      return destroyed ? [] : renderTiles(curatedRoot, curatedItemsHost, items);
    },
    renderCustomWallpapers(items: WallpaperItem[]) {
      if (destroyed) {
        return [];
      }
      flushSync(() =>
        customRoot.render(
          <CustomWallpapers
            checkIcon={String(model.icons?.check || '')}
            deleteIcon={String(model.icons?.delete || '')}
            items={Array.isArray(items) ? items : []}
          />
        )
      );
      return Array.from(
        customItemsHost.querySelectorAll<HTMLElement>(
          '.x-nt-wallpaper-custom-tile'
        )
      );
    }
  };
  return Object.freeze(controller);
}

export function createWallpaperViewApi() {
  return Object.freeze({
    implementation: 'react',
    createController: createWallpaperViewController
  });
}
