import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRepoFile } from '../../tests/fakes/css';
import { required } from '../../tests/fakes/dom';
import * as Settings from '../domain/settings';
import { formatTemplate } from './format-template';
import {
  buildTranslationHelpModel,
  buildTranslationIssueUrl,
  buildTranslationSheetCsv,
  downloadTranslationSheet,
  getTranslationReferenceLocale,
  type TranslationHelpModelInput
} from './options-translation-help';

const ISSUE_URL = 'https://github.com/example/repo/issues/new';
const getMessage = (_key: string, fallback: string) => fallback;

function model(locale: string, input: Partial<TranslationHelpModelInput> = {}) {
  return buildTranslationHelpModel({
    formatTemplate, getMessage, issueUrl: ISSUE_URL, locale, uiLocales: Settings.UI_LOCALES, version: '1.2.3', ...input
  });
}

// The field ids of the issue form the report link opens.
function issueFormFields(): string[] {
  return Array.from(readRepoFile('.github/ISSUE_TEMPLATE/translation.yml').matchAll(/^\s*id:\s*(\S+)\s*$/gm), (match) => match[1]);
}

// JSDOM has no object URLs; the download test gives URL its own.
const urlMethods: Array<[string, PropertyDescriptor | undefined]> = ['createObjectURL', 'revokeObjectURL']
  .map((name) => [name, Object.getOwnPropertyDescriptor(URL, name)]);

afterEach(() => {
  vi.useRealTimers();
  urlMethods.forEach(([name, descriptor]) => {
    if (descriptor) Object.defineProperty(URL, name, descriptor);
    else Reflect.deleteProperty(URL, name);
  });
});

describe('Options translation help', () => {
  it('offers nothing for Simplified Chinese, the language Lumno is written in', () => {
    expect(model('zh_CN')).toEqual({ visible: false });
  });

  it('links every other language to the prefilled translation issue form', () => {
    const ja = model('ja');
    if (!ja.visible) throw new Error('Expected help for Japanese.');
    expect(ja.title).toBe('帮助改进日本語翻译');
    const url = new URL(required(ja.reportHref, 'the report link'));
    expect(url.origin + url.pathname).toBe(ISSUE_URL);
    expect(url.searchParams.get('template')).toBe('translation.yml');
    expect(url.searchParams.get('language')).toBe('日本語 (ja)');
    expect(url.searchParams.get('version')).toBe('1.2.3');
    expect(url.searchParams.get('title')).toMatch(/^\[Translation\] 日本語/);
    // The form has the fields the link prefills, and the one for the problem.
    expect(issueFormFields()).toEqual(expect.arrayContaining(['language', 'problem', 'version']));
  });

  it('builds no report link from a broken issue address', () => {
    expect(buildTranslationIssueUrl({ issueUrl: 'not a url', locale: 'de', languageName: 'Deutsch', version: '' })).toBe('');
  });

  it('shows English beside every language, and Simplified Chinese beside English and Traditional Chinese', () => {
    expect(getTranslationReferenceLocale('de')).toBe('en');
    expect(getTranslationReferenceLocale('en')).toBe('zh_CN');
    expect(getTranslationReferenceLocale('zh_TW')).toBe('zh_CN');
  });

  it('writes a sheet Excel opens as UTF-8, keeping commas, quotes and line breaks in one cell', () => {
    const csv = buildTranslationSheetCsv({
      headers: { reference: 'English', current: 'Deutsch', suggestion: 'Vorschlag', note: 'Anmerkung' },
      referenceMessages: {
        plain: { message: 'Open' },
        tricky: { message: 'Say "hi", then\nwave' },
        missing: { message: 'Only English' }
      },
      currentMessages: {
        plain: { message: 'Öffnen' },
        tricky: { message: 'Sag „hi“, dann\nwinken' }
      }
    });
    expect(csv.startsWith('﻿ID,English,Deutsch,Vorschlag,Anmerkung\r\n')).toBe(true);
    expect(csv).toContain('\r\nplain,Open,Öffnen,,\r\n');
    expect(csv).toContain('\r\ntricky,"Say ""hi"", then\nwave","Sag „hi“, dann\nwinken",,\r\n');
    expect(csv.endsWith('\r\nmissing,Only English,,,\r\n')).toBe(true);
  });

  it('downloads the sheet built from the reference and the current copy', async () => {
    vi.useFakeTimers();
    const blobs: Blob[] = [];
    const saved: string[] = [];
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      if (blob instanceof Blob) blobs.push(blob);
      return 'blob:x';
    };
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    const loaded: string[] = [];
    const help = model('fr', {
      onDownload: () => downloadTranslationSheet({
        documentObj: document,
        getMessage,
        locale: 'fr',
        loadLocaleMessages: (locale) => {
          loaded.push(locale);
          return Promise.resolve({ greeting: { message: locale === 'en' ? 'Hello' : 'Bonjour' } });
        },
        uiLocales: Settings.UI_LOCALES
      })
    });
    if (!help.visible || !help.onDownload) throw new Error('Expected a download for French.');
    await help.onDownload();
    vi.runAllTimers();
    expect(loaded).toEqual(['en', 'fr']);
    expect(await blobs[0].text()).toContain('greeting,Hello,Bonjour,,');
    expect(saved).toEqual(['lumno-translation-fr.csv']);
  });
});
