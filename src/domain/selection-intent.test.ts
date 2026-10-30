import { describe, expect, it } from 'vitest';
import { buildPrompt, classifySelection } from './selection-intent';
import type { SelectionContext } from './selection-text-features';

const zh: SelectionContext = { uiLanguage: 'zh-CN' };
const en: SelectionContext = { uiLanguage: 'en' };

describe('selection intent', () => {
  it('offers a translation for a word in another language than the interface', () => {
    const result = classifySelection('serendipity', zh);
    expect(result.action).toBe('translate');
    expect(result.confidence).toBe('high');
    expect(result.features.languageMismatch).toBe(true);
  });

  it('offers an explanation for a technical term', () => {
    const result = classifySelection('React', zh);
    expect(result.action).toBe('explain');
    expect(result.confidence).toBe('medium');
    expect(result.features.languageMismatch).toBe(false);
    expect(result.triggerable).toBe(true);
    expect(classifySelection('React components', en).triggerable).toBe(true);
  });

  it('stays quiet for a bare number and for ordinary prose fragments', () => {
    const number = classifySelection('100', zh);
    expect(number.features.numericLike).toBe(false);
    expect(number.triggerable).toBe(false);

    const chinese = classifySelection('这是你需要的资料', zh);
    expect(chinese.confidence).toBe('low');
    expect(chinese.triggerable).toBe(false);

    const sentence = classifySelection('The request failed because the server was unavailable.', en);
    expect(sentence.features.errorLike).toBe(false);
    expect(sentence.triggerable).toBe(false);
  });

  it('explains an error message inside code', () => {
    const result = classifySelection('TypeError: Cannot read properties of undefined', { insideCode: true, uiLanguage: 'zh-CN' });
    expect(result.action).toBe('explain');
    expect(result.confidence).toBe('high');
    expect(result.features.errorLike).toBe(true);
  });

  it('asks a question as it is', () => {
    const result = classifySelection('为什么这个请求会失败？', zh);
    expect(result.action).toBe('ask');
    expect(result.confidence).toBe('high');
    expect(classifySelection('Why is the sky blue?', zh).action).toBe('ask');
  });

  it.each(['the', 'and', 'click here', 'learn more', 'next page', 'Welcome to our website'])(
    'stays quiet for generic English text: %s', (text) => {
      expect(classifySelection(text, en).triggerable).toBe(false);
    });

  it('does not turn foreign-language boilerplate into a translation', () => {
    expect(classifySelection('click here', zh).triggerable).toBe(false);
    expect(classifySelection('了解更多', en).triggerable).toBe(false);
  });

  it.each(['点击这里', '了解更多', '下一步', '欢迎访问我们的网站', '这里', '更多'])(
    'stays quiet for generic Chinese text: %s', (text) => {
      expect(classifySelection(text, zh).triggerable).toBe(false);
    });

  it.each<[string, SelectionContext]>([
    ['React', en],
    ['React components', en],
    ['AI', en],
    ['量子纠缠', zh],
    ['算法', zh],
    ['提示词', zh]
  ])('shows the toolbar for a meaningful term: %s', (text, context) => {
    expect(classifySelection(text, context).triggerable).toBe(true);
  });

  it('searches for news and calculates conversions', () => {
    const news = classifySelection('OpenAI GPT-5 latest news', en);
    expect(news.triggerable).toBe(true);
    expect(news.action).toBe('search');
    expect(classifySelection('OpenAI GPT-5 latest news', zh).action).toBe('search');
    expect(classifySelection('How much is 100 USD in CNY?', en).action).toBe('calculate');
    const conversion = classifySelection('100 USD to CNY', zh);
    expect(conversion.action).toBe('calculate');
    expect(conversion.confidence).toBe('high');
  });

  it.each<[string, string, SelectionContext]>([
    [
      'a complete Chinese article paragraph',
      '今年初，一款名为 Bookology 的读书管理应用进入我的视野，它集合了我需要的原本分散在各个读书应用中的功能。总结来说，Bookology 将书籍管理、阅读进度、阅读笔记和数据统计整合在一个简洁的数字书架中，在这一个 App 中就可以建立专属于我自己的阅读档案。',
      { uiLanguage: 'zh-CN', pageLanguage: 'zh-CN' }
    ],
    [
      'a complete English article paragraph',
      'The product combines reading notes and progress in one place. It keeps a personal archive that remains easy to review later.',
      { uiLanguage: 'en', pageLanguage: 'en' }
    ],
    [
      'a complete Japanese article paragraph',
      'このアプリは読書記録と進捗管理を一つの場所にまとめ、日々の読書体験を整理しやすくします。さらに、保存したメモや統計を後から振り返ることで、自分だけの読書履歴を継続的に育てられます。',
      { uiLanguage: 'ja', pageLanguage: 'ja' }
    ],
    [
      'a substantial single-sentence paragraph',
      'This paragraph contains a sustained explanation of a product workflow and includes enough context to be useful when asking an assistant for interpretation even though the author chose to write it as one long sentence without terminal punctuation',
      { uiLanguage: 'en', pageLanguage: 'en' }
    ]
  ])('ranks Summarize first for %s', (_name, text, context) => {
    const result = classifySelection(text, context);
    expect(result.features.substantialProseLike).toBe(true);
    expect(result.action).toBe('summarize');
    expect(result.confidence).toBe('high');
    expect(result.triggerable).toBe(true);
  });

  it.each<[string, string, SelectionContext]>([
    ['short UI-like sentences', '产品支持同步。稍后再试。', { uiLanguage: 'zh-CN', pageLanguage: 'zh-CN' }],
    ['repeated UI actions', 'Save changes. Cancel operation. '.repeat(4), { uiLanguage: 'en', pageLanguage: 'en' }],
    ['symbol-only sentences', `${'😀'.repeat(40)}。${'😀'.repeat(40)}。`, { uiLanguage: 'zh-CN', pageLanguage: 'zh-CN' }],
    [
      'hard-wrapped repeated fragments',
      `${'configuration value '.repeat(4)}\n${'configuration value '.repeat(4)}\n${'configuration value '.repeat(4)}`,
      { uiLanguage: 'en', pageLanguage: 'en' }
    ]
  ])('does not take %s for prose', (_name, text, context) => {
    const result = classifySelection(text, context);
    expect(result.features.substantialProseLike).toBe(false);
    expect(result.action).not.toBe('summarize');
    expect(result.triggerable).toBe(false);
  });

  it('keeps code with full sentences outside the prose rule', () => {
    const result = classifySelection(
      'const result = records.map((record) => normalize(record)).filter(Boolean); This function normalizes every record before filtering it. It returns a clean array for the next processing stage.',
      { insideCode: true, uiLanguage: 'en', pageLanguage: 'en' }
    );
    expect(result.features.substantialProseLike).toBe(false);
    expect(result.action).toBe('explain');
    expect(result.confidence).toBe('high');
    expect(result.triggerable).toBe(true);
  });

  it('suppresses addresses and sensitive text but not editable text', () => {
    expect(classifySelection('https://example.com/', zh).suppressed).toBe(true);
    expect(classifySelection('person@example.com', zh).suppressed).toBe(true);
    expect(classifySelection('secret token', { sensitive: true, uiLanguage: 'en' }).suppressed).toBe(true);
    const editable = { editable: true, uiLanguage: 'en' };
    const result = classifySelection('selected text', editable);
    expect(result.suppressed).toBe(false);
    expect(result.triggerable).toBe(true);
  });

  it('names the reply language in a translation prompt and sends a question as it is', () => {
    expect(buildPrompt('translate', 'hello', 'zh-CN')).toMatch(/简体中文/);
    expect(buildPrompt('translate', 'hello', 'zh-TW')).toMatch(/繁體中文/);
    expect(buildPrompt('ask', 'Why?', 'en')).toBe('Why?');
  });
});
