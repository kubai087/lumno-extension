import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteThemeEvents } from '../../../favicon/theme-caches';
import { createColorScheme } from '../../../ui/color-scheme';
import { buildTheme } from '../../../favicon/favicon-theme';
import type { SuggestionElement } from './types';
import { createView, destroyViews, render } from '../../../../../tests/fakes/suggestions';

afterEach(destroyViews);

describe('Suggestion row themes', () => {
  it('follows its site theme when it changes and redraws for the color scheme', async () => {
    const known = buildTheme([10, 20, 30]);
    const applyThemeVariables = vi.fn<(item: SuggestionElement, value: unknown) => void>();
    const colorScheme = createColorScheme();
    const { view, items } = createView({
      getImmediateThemeForSuggestion: () => known,
      getThemeForSuggestion: () => Promise.resolve(known),
      getThemeHostForSuggestion: () => 'example.com',
      applyThemeVariables,
      colorScheme
    });
    await act(async () => {
      render(view, [{ type: 'history', title: 'Example', url: 'https://example.com/' }]);
      await Promise.resolve();
    });
    const row = items[0];
    applyThemeVariables.mockClear();

    const other = buildTheme([40, 50, 60]);
    act(() => siteThemeEvents.emit('changed', { host: 'other.example', theme: other }));
    expect(applyThemeVariables).not.toHaveBeenCalled();

    const resolved = buildTheme([70, 80, 90]);
    act(() => siteThemeEvents.emit('changed', { host: 'example.com', theme: resolved }));
    expect(applyThemeVariables).toHaveBeenLastCalledWith(row, resolved);

    applyThemeVariables.mockClear();
    act(() => colorScheme.setState({ dark: true }));
    expect(applyThemeVariables).toHaveBeenCalledWith(row, resolved);
  });
});
