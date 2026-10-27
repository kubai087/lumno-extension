// "Improve translation" next to the language picker: lets native speakers
// report a wrong string on a prefilled GitHub issue form, or download every
// UI string as a spreadsheet, fill in a "Suggestion" column and attach it.
// scripts/i18n/import-sheet.js merges a returned spreadsheet.
import type { LocaleMessage } from '../domain/messages';
import type { UiLocale } from '../domain/settings/locale';
import { downloadTextFile } from './options-download';
import type { FormatTemplate, GetMessage } from './options-types';
import type { TranslationHelpRenderModel } from './react/translation-help';

type LocaleMessages = Record<string, LocaleMessage>;

interface TranslationIssueInput {
  // The repository's new-issue URL.
  issueUrl: string;
  locale: string;
  languageName: string;
  version: string;
}

interface TranslationSheetInput {
  headers: { reference: string; current: string; suggestion: string; note: string };
  referenceMessages: LocaleMessages;
  currentMessages: LocaleMessages;
}

interface TranslationHelpModelInput {
  getMessage: GetMessage;
  formatTemplate: FormatTemplate;
  locale: string;
  uiLocales: readonly Pick<UiLocale, 'id' | 'name'>[];
  issueUrl: string;
  version: string;
  onDownload?: () => Promise<void>;
}

interface TranslationSheetDownload {
  documentObj: Document;
  getMessage: GetMessage;
  locale: string;
  uiLocales: readonly Pick<UiLocale, 'id' | 'name'>[];
  loadLocaleMessages(locale: string): Promise<LocaleMessages>;
}

// Lumno is written in Simplified Chinese, so there is nothing to improve there.
const SOURCE_LOCALE = 'zh_CN';
const ISSUE_TEMPLATE = 'translation.yml';

// English is the column translators read beside their own language; English
// and Traditional Chinese read the Simplified Chinese it was written in.
function getTranslationReferenceLocale(locale: string): string {
  return locale === 'en' || locale === 'zh_TW' ? SOURCE_LOCALE : 'en';
}

function getLocaleName(uiLocales: readonly Pick<UiLocale, 'id' | 'name'>[], locale: string): string {
  const entry = uiLocales.find((item) => item.id === locale);
  return entry ? entry.name : locale;
}

function buildTranslationIssueUrl(input: TranslationIssueInput): string {
  let url: URL;
  try {
    url = new URL(input.issueUrl);
  } catch (error) {
    return '';
  }
  const language = `${input.languageName} (${input.locale})`;
  url.searchParams.set('template', ISSUE_TEMPLATE);
  url.searchParams.set('title', `[Translation] ${input.languageName}: `);
  url.searchParams.set('language', language);
  if (input.version) {
    url.searchParams.set('version', input.version);
  }
  return url.toString();
}

function escapeCsvField(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getMessageText(messages: LocaleMessages, key: string): string {
  const entry = Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : undefined;
  return entry && typeof entry.message === 'string' ? entry.message : '';
}

// One row per string, in the reference file's order. The BOM makes Excel
// read the file as UTF-8.
function buildTranslationSheetCsv(input: TranslationSheetInput): string {
  const { headers, referenceMessages, currentMessages } = input;
  const rows = [['ID', headers.reference, headers.current, headers.suggestion, headers.note]];
  Object.keys(referenceMessages).forEach((key) => {
    rows.push([key, getMessageText(referenceMessages, key), getMessageText(currentMessages, key), '', '']);
  });
  return `\uFEFF${rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n')}\r\n`;
}

function buildTranslationHelpModel(input: TranslationHelpModelInput): TranslationHelpRenderModel {
  const { getMessage, locale } = input;
  if (!locale || locale === SOURCE_LOCALE) {
    return { visible: false };
  }
  const languageName = getLocaleName(input.uiLocales, locale);
  return {
    visible: true,
    actionLabel: getMessage('settings_translation_help_action', '改进翻译'),
    actionLabelKey: 'settings_translation_help_action',
    closeLabel: getMessage('newtab_feedback_wechat_close_tooltip', '关闭'),
    description: getMessage('settings_translation_help_desc', '看到不准确或不自然的译文？告诉我们是哪一句，或者下载全部文案，直接在表格里改。'),
    downloadHint: getMessage('settings_translation_help_download_hint', '用 Excel 或 Google 表格打开，在「建议译文」一列写下修改，再把文件拖进「报告问题」页面提交。'),
    downloadLabel: getMessage('settings_translation_help_download_action', '下载翻译表格'),
    onDownload: input.onDownload,
    reportHref: buildTranslationIssueUrl({
      issueUrl: input.issueUrl,
      languageName,
      locale,
      version: input.version
    }),
    reportLabel: getMessage('settings_translation_help_report_action', '报告问题'),
    title: input.formatTemplate(
      getMessage('settings_translation_help_title', '帮助改进{language}翻译'),
      { language: languageName }
    )
  };
}

// Saves every UI string of the page's language beside its reference
// language as a spreadsheet.
async function downloadTranslationSheet(options: TranslationSheetDownload): Promise<void> {
  const { locale } = options;
  const referenceLocale = getTranslationReferenceLocale(locale);
  const [referenceMessages, currentMessages] = await Promise.all([
    options.loadLocaleMessages(referenceLocale),
    options.loadLocaleMessages(locale)
  ]);
  const csv = buildTranslationSheetCsv({
    currentMessages,
    headers: {
      current: getLocaleName(options.uiLocales, locale),
      note: options.getMessage('settings_translation_help_sheet_note', '备注'),
      reference: getLocaleName(options.uiLocales, referenceLocale),
      suggestion: options.getMessage('settings_translation_help_sheet_suggestion', '建议译文')
    },
    referenceMessages
  });
  downloadTextFile(options.documentObj, `lumno-translation-${locale}.csv`, csv, 'text/csv;charset=utf-8');
}

export {
  buildTranslationHelpModel,
  buildTranslationIssueUrl,
  buildTranslationSheetCsv,
  downloadTranslationSheet,
  getTranslationReferenceLocale
};
export type {
  LocaleMessages,
  TranslationHelpModelInput,
  TranslationSheetDownload,
  TranslationIssueInput,
  TranslationSheetInput
};
