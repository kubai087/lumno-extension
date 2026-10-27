import { FeedbackSupportView, type FeedbackSupportRenderModel } from './feedback-support';
import { SettingSelect, type SelectControlRenderModel } from './select-control';
import { SettingDivider, SettingSwitch, SettingTitle } from './setting-rows';
import type { ToggleControlRenderModel } from './toggle-control';
import { TranslationHelpView, type TranslationHelpRenderModel } from './translation-help';
import { RemixIcon } from '../../shared/react/remix-icon';

// The top of the General tab: help and feedback with the onboarding guide
// after the channels, the page's language and the update notice.
export interface GeneralGlobalSectionModel {
  // Null until the community links are known.
  feedback: FeedbackSupportRenderModel | null;
  title: string;
  licenses: { label: string; href: string };
  onboardingLabel: string;
  language: {
    title: string;
    // Said under the title while the page shows an AI-translated language.
    machineNote: string;
    showMachineNote: boolean;
    translationHelp: TranslationHelpRenderModel | null;
    select: SelectControlRenderModel;
  };
  updateNotice: { title: string; info: string; toggle: ToggleControlRenderModel };
}

export interface GeneralGlobalSectionHandlers {
  onOpenOnboarding(): void;
  onLanguage(mode: string): void;
  onUpdateNotice(checked: boolean): void;
  getViewportTopInset(): number;
}

export function GeneralGlobalSection({
  model,
  handlers
}: {
  model: GeneralGlobalSectionModel;
  handlers: GeneralGlobalSectionHandlers;
}) {
  const { language, updateNotice } = model;
  return (
    <>
      <div id="_x_extension_feedback_support_2026_unique_">
        {model.feedback ? (
          <FeedbackSupportView
            {...model.feedback}
            actions={[{
              iconName: 'ri-compass-3-line',
              id: '_x_extension_open_onboarding_page_2026_unique_',
              label: model.onboardingLabel,
              onClick: handlers.onOpenOnboarding
            }]}
          />
        ) : null}
      </div>
      <SettingDivider />
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_section_header_2026_unique_">
        <p className="_x_extension_section_title_2024_unique_">{model.title}</p>
        <a
          className="_x_extension_shortcut_submit_2024_unique_ _x_extension_feedback_support_action_2026_unique_ _x_extension_licenses_link_2026_unique_"
          href={model.licenses.href}
          id="_x_extension_open_licenses_2026_unique_"
          rel="noreferrer noopener"
          target="_blank"
        >
          <span>{model.licenses.label}</span>
          <RemixIcon name="ri-external-link-line" />
        </a>
      </div>
      <div className="_x_extension_setting_row_2024_unique_">
        <div>
          <p className="_x_extension_setting_title_2024_unique_" id={language.select.labelledBy}>{language.title}</p>
          <p
            className="_x_extension_setting_desc_2024_unique_"
            hidden={!language.showMachineNote}
            id="_x_extension_language_machine_note_2026_unique_"
          >
            {language.machineNote}
          </p>
        </div>
        <div id="_x_extension_translation_help_2026_unique_">
          {language.translationHelp ? <TranslationHelpView {...language.translationHelp} /> : null}
        </div>
        <SettingSelect
          model={language.select}
          options={{
            getViewportTopInset: handlers.getViewportTopInset,
            onSelect: handlers.onLanguage,
            searchable: true
          }}
        />
      </div>
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_setting_row_compact_2024_unique_">
        <div>
          <SettingTitle info={updateNotice.info} title={updateNotice.title} />
        </div>
        <SettingSwitch model={updateNotice.toggle} onChange={handlers.onUpdateNotice} />
      </div>
    </>
  );
}
