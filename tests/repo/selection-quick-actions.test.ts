import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUN_AT, SCRIPT_FILES } from '../../src/background/selection-script-registration';
import { EXTENSION_DIR, builtModules, isRecord, isStringArray, readLocaleMessages, readRepoJson } from './repository';

// The selection toolbar is off by default: the worker registers its built
// script while it is on, so nothing loads it into every page.
const LOCALES = ['en', 'ja', 'zh_CN', 'zh_TW'];
const INTENTS = ['ask', 'translate', 'explain', 'summarize', 'search', 'calculate'];

describe('selection toolbar wiring', () => {
  it('is registered at document idle from its built script, never from the manifest', () => {
    expect(SCRIPT_FILES).toEqual(['build/selection-quick-actions.js']);
    expect(RUN_AT).toBe('document_idle');
    SCRIPT_FILES.forEach((file) => {
      expect(existsSync(join(EXTENSION_DIR, file)), `${file} should be built; run npm run build first`).toBe(true);
    });
    const contentScripts = readRepoJson('manifest.json').content_scripts;
    const manifestFiles = Array.isArray(contentScripts)
      ? contentScripts.flatMap((entry) => (isRecord(entry) && isStringArray(entry.js) ? entry.js : []))
      : [];
    expect(manifestFiles.length).toBeGreaterThan(0);
    SCRIPT_FILES.forEach((file) => expect(manifestFiles).not.toContain(file));
  });

  it('carries provider-aware settings, the selection classifier and the shared Toast, and nothing else', () => {
    const modules = builtModules('selection-quick-actions.js')
      .filter((file) => !file.startsWith('src/content/selection-quick-actions/'))
      .sort();
    expect(modules).toEqual([
      'src/content/selection-quick-actions.ts',
      'src/domain/selection-action-icons.ts',
      'src/domain/selection-intent.ts',
      'src/domain/selection-text-features.ts',
      'src/domain/settings/appearance.ts',
      'src/domain/settings/define.ts',
      'src/domain/settings/features.ts',
      'src/domain/settings/locale.ts',
      'src/domain/settings/newtab-page.ts',
      'src/domain/settings/newtab-shortcuts.ts',
      'src/domain/settings/page-cache.ts',
      'src/domain/settings/schema.ts',
      'src/domain/settings/sync-state.ts',
      'src/platform/content-registry.ts',
      'src/platform/messaging.ts',
      'src/platform/provider-storage.ts',
      'src/platform/setting-values.ts',
      'src/platform/settings-areas.ts',
      'src/platform/settings-storage.ts',
      'src/platform/settings-store.ts',
      'src/platform/storage-call.ts',
      'src/shared/state/store.ts',
      'src/shared/ui/toast-screen.ts',
      'src/shared/ui/toast-style-gate.ts',
      'src/shared/ui/toast.ts'
    ]);
  });
});

describe('selection toolbar copy', () => {
  it.each(LOCALES)('localizes the toolbar and its settings in %s', (locale) => {
    const messages = readLocaleMessages(locale);
    [
      'settings_selection_quick_actions_title',
      'settings_selection_quick_actions_desc',
      'settings_selection_quick_actions_provider_title',
      'settings_selection_quick_actions_group_title',
      'settings_selection_quick_actions_group_desc',
      'selection_quick_actions_group_name',
      ...INTENTS.map((intent) => `selection_quick_action_${intent}`)
    ].forEach((key) => {
      expect(String(messages[key] || '').trim(), `${locale} ${key}`).not.toBe('');
    });
  });

  it('names the background setting plainly in Simplified Chinese', () => {
    expect(readLocaleMessages('zh_CN').settings_selection_quick_actions_group_title).toBe('在后台查询');
  });

  it.each<[string, string[], string[]]>([
    ['en', ['AI Search', 'Collect all AI pages in the “AI Search” tab group'], ['Answer', 'Translate', 'Explain', 'Summarize', 'Research', 'Calculate']],
    ['ja', ['AI 検索', 'すべての AI ページを「AI 検索」タブグループにまとめます'], ['回答', '翻訳', '説明', '要約', '調査', '計算']],
    ['zh_CN', ['AI 查询', '所有 AI 网页皆归入「AI 查询」标签组'], ['解答', '翻译', '解释', '总结', '调研', '计算']],
    ['zh_TW', ['AI 查詢', '所有 AI 網頁皆歸入「AI 查詢」分頁群組'], ['解答', '翻譯', '解釋', '總結', '研究', '計算']]
  ])('uses one group name and task labels in %s', (locale, groupCopy, taskLabels) => {
    const messages = readLocaleMessages(locale);
    expect([messages.selection_quick_actions_group_name, messages.settings_selection_quick_actions_group_desc]).toEqual(groupCopy);
    expect(INTENTS.map((intent) => messages[`selection_quick_action_${intent}`])).toEqual(taskLabels);
  });
});
