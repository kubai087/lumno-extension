// The top of the General tab: help and feedback with the onboarding guide,
// the licenses link, the page's language with its translation help, and the
// update notice. The community links show their bundled copy at once and
// the remote copy once it loads.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CommunityLinks } from '../../../domain/community-links';
import { UI_LOCALES, isMachineTranslatedLocale, updateNoticeEnabled } from '../../../domain/settings';
import * as COMMUNITY_LINKS from '../../../platform/community-links';
import * as LumnoMessaging from '../../../platform/messaging';
import { useSetting } from '../../../shared/react/use-setting';
import { useStore } from '../../../shared/react/use-store';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { formatTemplate } from '../../format-template';
import { buildFeedbackSupportModel, getFeedbackSupportWebLocale } from '../../options-feedback-support';
import { buildTranslationHelpModel, downloadTranslationSheet } from '../../options-translation-help';
import {
  GeneralGlobalSection as GeneralGlobalView,
  type GeneralGlobalSectionHandlers
} from '../../react/general-global-section';
import { loadExtensionLocaleMessages } from '../../../shared/i18n/locale-messages';
import { isHelpCenterSearchEnabled } from '../site-search/providers';

const LANGUAGE_SELECT_ID = '_x_extension_language_select_2024_unique_';
const DEFAULT_LICENSES_URL = 'https://github.com/kubai087/lumno-extension/blob/main/THIRD_PARTY_NOTICES.md';

function useCommunityLinks(): Readonly<CommunityLinks> {
  const [links, setLinks] = useState<Readonly<CommunityLinks>>(COMMUNITY_LINKS.FALLBACK_LINKS);
  useEffect(() => {
    let active = true;
    void COMMUNITY_LINKS.load().then((loaded) => {
      if (active) setLinks(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return links;
}

export function GeneralGlobalSection() {
  const { settingsStore, locale, siteSearchProviders, showToast, getViewportTopInset } = useOptionsPage();
  const t = useMessages();
  const { mode, locale: pageLocale } = useStore(locale.store);
  const updateNotice = useSetting(settingsStore, updateNoticeEnabled);
  const helpCenterSearch = isHelpCenterSearchEnabled(useStore(siteSearchProviders.store)) === true;
  const links = useCommunityLinks();

  const download = useCallback(() => downloadTranslationSheet({
    documentObj: document,
    getMessage: t,
    loadLocaleMessages: loadExtensionLocaleMessages,
    locale: pageLocale,
    uiLocales: UI_LOCALES
  }), [t, pageLocale]);

  const handlers = useMemo<GeneralGlobalSectionHandlers>(() => ({
    onOpenOnboarding() {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOnboardingPage' }, (response) => {
        if (chrome.runtime.lastError || !response || response.ok === false) {
          showToast(t('toast_error', '操作失败，请重试。'), true);
        }
      });
    },
    onLanguage(next) {
      locale.choose(next || 'system');
    },
    onUpdateNotice(checked) {
      saveSetting(settingsStore, updateNoticeEnabled, checked);
    },
    getViewportTopInset
  }), [settingsStore, locale, showToast, t, getViewportTopInset]);

  // Each language is listed in its own words, so the names are not translated.
  const locales = UI_LOCALES.map((entry) => ({ value: entry.htmlLang, label: entry.name, labelKey: '' }));
  const known = mode === 'system' || locales.some((item) => item.value === mode);
  return (
    <GeneralGlobalView
      handlers={handlers}
      model={{
        feedback: buildFeedbackSupportModel({
          communityLinks: COMMUNITY_LINKS,
          getMessage: t,
          helpCenterSearchEnabled: helpCenterSearch,
          helpIconUrl: chrome.runtime.getURL('assets/images/site-search/glyph-lm.png'),
          links,
          webLocale: getFeedbackSupportWebLocale(pageLocale)
        }),
        title: t('settings_global_section_title', '全局设置'),
        licenses: {
          label: t('settings_feedback_support_licenses_action', '开源许可'),
          href: links.licenses || DEFAULT_LICENSES_URL
        },
        onboardingLabel: t('settings_onboarding_tutorial_action', '新手引导'),
        language: {
          title: t('settings_language_title', '语言'),
          machineNote: t('settings_language_machine_note', '此语言由 AI 翻译，如有不准确之处，欢迎反馈。'),
          showMachineNote: Boolean(pageLocale) && isMachineTranslatedLocale(pageLocale),
          translationHelp: buildTranslationHelpModel({
            formatTemplate,
            getMessage: t,
            issueUrl: links.githubIssue,
            locale: pageLocale,
            onDownload: download,
            uiLocales: UI_LOCALES,
            version: chrome.runtime.getManifest().version || ''
          }),
          select: {
            id: LANGUAGE_SELECT_ID,
            labelledBy: `${LANGUAGE_SELECT_ID}_title`,
            value: known ? mode : 'system',
            searchPlaceholder: t('settings_language_search_placeholder', '搜索语言'),
            emptyLabel: t('settings_language_no_results', '没有匹配的语言'),
            items: [
              { value: 'system', labelKey: 'language_system', label: t('language_system', '跟随浏览器语言') },
              ...locales
            ]
          }
        },
        updateNotice: {
          title: t('settings_update_notice_title', '更新提示'),
          info: t('settings_update_notice_desc', '更新到新版本时显示新功能组件'),
          toggle: { id: '_x_extension_update_notice_toggle_2026_unique_', checked: updateNotice }
        }
      }}
    />
  );
}
