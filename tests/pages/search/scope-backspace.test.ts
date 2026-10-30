import { describe, expect, it } from 'vitest';
import { readRepoFile } from '../../fakes/css';
import { SURFACES, openSearchSurface } from './surfaces';

// Backspace in an empty input removes the active search scope only when
// pressed twice: the first press explains itself in a Toast. The timing of
// the two presses is covered by src/shared/react/search-input-mode.*.test.ts.

describe.each(SURFACES)('%s scope Backspace', (name) => {
  it('removes the scope on the second press, after asking on the first', async () => {
    const surface = await openSearchSurface(name);
    await surface.chooseScope('provider:yt');
    expect(surface.scopeLabel()).toBe('YouTube');

    surface.press('Backspace');
    await surface.settle(50);
    expect(surface.scopeLabel()).toBe('YouTube');
    expect(surface.toast()).toEqual({ shown: true, text: 'Press Backspace again to remove the scope.' });

    surface.press('Backspace', { repeat: true });
    await surface.settle(50);
    expect(surface.scopeLabel()).toBe('YouTube');

    surface.press('Backspace');
    await surface.settle(50);
    expect(surface.scopeLabel()).toBe('');
    expect(surface.toast().shown).toBe(false);
  });

  it('deletes typed text first, without touching or asking about the scope', async () => {
    const surface = await openSearchSurface(name);
    await surface.chooseScope('provider:yt');
    await surface.type('c');
    surface.input().setSelectionRange(1, 1);
    surface.press('Backspace');
    await surface.settle(50);
    expect(surface.scopeLabel()).toBe('YouTube');
    expect(surface.toast().shown).toBe(false);
  });
});

describe('Scope Backspace copy', () => {
  it.each([
    ['en', 'Press Backspace again to remove the scope.'],
    ['ja', 'もう一度 Backspace を押すと検索範囲を解除します。'],
    ['zh_CN', '再按一次退格键，移除搜索范围。'],
    ['zh_TW', '再按一次退格鍵，移除搜尋範圍。']
  ])('asks for the second press in %s', (locale, message) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    expect(messages).toMatchObject({ search_scope_remove_confirmation: { message } });
  });
});
