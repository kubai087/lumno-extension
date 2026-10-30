import { describe, expect, it } from 'vitest';
import { parseStylesheet } from '../../fakes/css';

describe('Options control styles', () => {
  it('shows the active segmented option before its indicator can be measured', () => {
    const styles = parseStylesheet('src/options/options.css');
    const active = styles.rule('._x_extension_theme_indicator_2024_unique_[data-ready="false"] ~ ._x_extension_theme_option_2024_unique_[data-active="true"]');
    expect(active?.get('background')).toBe('var(--inline-tab-active-bg)');
  });

  it('spaces the selected provider icon and label like the menu options', () => {
    const styles = parseStylesheet('src/shared/ui/custom-select.css');
    expect(styles.rule('._x_extension_select_trigger_2024_unique_')?.get('gap')).toBe('8px');
  });
});
