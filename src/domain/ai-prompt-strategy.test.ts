import { describe, expect, it } from 'vitest';
import { getAllowedStrategyOrigins, getStrategyConfig, isAllowedStrategyOrigin } from './ai-prompt-strategy';

describe('AI prompt strategies', () => {
  it.each([
    ['geminiPrompt', 'https://gemini.google.com'],
    ['chatgptPrompt', 'https://chatgpt.com'],
    ['doubaoPrompt', 'https://www.doubao.com'],
    ['qianwenQuery', 'https://www.qianwen.com'],
    ['yuanbaoPrompt', 'https://yuanbao.tencent.com'],
    ['minimaxPrompt', 'https://chat.minimax.io'],
    ['deepseekPrompt', 'https://chat.deepseek.com'],
    ['kimiPrompt', 'https://www.kimi.com'],
    ['copilotPrompt', 'https://copilot.com'],
    ['grokPrompt', 'https://grok.com'],
    ['qwenChatPrompt', 'https://chat.qwen.ai'],
    ['aiStudioPrompt', 'https://aistudio.google.com']
  ])('submits %s only on its official HTTPS origin %s', (strategy, origin) => {
    expect(getAllowedStrategyOrigins(strategy)).toEqual([origin]);
    expect(isAllowedStrategyOrigin(strategy, origin)).toBe(true);
    expect(origin.startsWith('https://')).toBe(true);
  });

  it("falls back from Enter to Qwen Chat's own send button", () => {
    const config = getStrategyConfig('qwenChatPrompt');
    const selectors = config && 'sendButtonSelectors' in config ? config.sendButtonSelectors : [];

    expect(selectors[0]).toBe('button.send-button');
  });
});
