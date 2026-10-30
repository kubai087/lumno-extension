import { describe, expect, it } from 'vitest';
import { resolveSelectionQuickActionProvider } from './selection-quick-action-provider';

interface Provider {
  key: string;
  action: string;
  submitStrategy: string;
}

const isInteractive = (provider: Provider) => provider.action === 'openAndSubmit' && Boolean(provider.submitStrategy);
const chatGpt: Provider = { key: 'gpt', action: 'openAndSubmit', submitStrategy: 'chatgptPrompt' };
const gemini: Provider = { key: 'gm', action: 'openAndSubmit', submitStrategy: 'geminiPrompt' };

describe('selection quick action provider', () => {
  it('keeps the chosen provider when it is hidden from the search sources', () => {
    expect(resolveSelectionQuickActionProvider([gemini], [chatGpt, gemini], 'gpt', isInteractive)).toBe(chatGpt);
  });

  it('falls back to the bundled providers when every AI search source is off', () => {
    expect(resolveSelectionQuickActionProvider([], [chatGpt, gemini], 'gm', isInteractive)).toBe(gemini);
  });

  it('falls back to the bundled ChatGPT for a provider that no longer exists', () => {
    expect(resolveSelectionQuickActionProvider([], [chatGpt], 'missing-provider', isInteractive)).toBe(chatGpt);
  });
});
