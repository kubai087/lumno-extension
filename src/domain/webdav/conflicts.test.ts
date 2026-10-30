import { describe, expect, it } from 'vitest';
import * as settings from '../settings';
import { describeConflict } from './conflicts';
import type { WebDavState } from './types';
import { validateState } from './validation';

const theme = settings.themeMode.key;
const language = settings.language.key;

function state(input: Record<string, unknown> = {}): WebDavState {
  return validateState({ version: 1, data: {}, groups: [], shortcuts: [], icons: {}, wallpapers: [], assets: {}, ...input });
}

const empty = (data: Record<string, unknown> = {}) => state({ data });

describe('describing a conflict', () => {
  it('shows the value each side holds for a setting', () => {
    const base = empty({ [theme]: 'light', [language]: 'en' });

    expect(describeConflict(base, empty({ ...base.data, [theme]: 'dark' }), empty({ ...base.data, [theme]: 'system' }), [theme]))
      .toEqual([{ key: theme, domain: 'preference', local: { kind: 'text', value: 'dark' }, remote: { kind: 'text', value: 'system' } }]);
  });

  it('lists only the fields of a record both sides changed apart', () => {
    const quote = settings.newtabQuotePrefs.key;
    const quoteBase = empty({ [quote]: { enabled: true, position: 'search', category: 'literature', fontSize: 16 } });
    const quoteLocal = empty({ [quote]: { enabled: true, position: 'search', category: 'literature', fontSize: 20 } });
    const quoteBoth = empty({ [quote]: { enabled: true, position: 'bottom', category: 'poetry', fontSize: 18 } });

    expect(describeConflict(quoteBase, quoteLocal, quoteBoth, [quote])).toEqual([
      { key: quote, field: 'fontSize', domain: 'preference', local: { kind: 'number', value: 20 }, remote: { kind: 'number', value: 18 } }
    ]);
  });

  it('shows the colors of a folder color conflict, not the stored entry', () => {
    const folderColors = settings.bookmarkFolderColorRefs.key;
    const workRef = 'a'.repeat(16);
    const colorBase = empty({ [folderColors]: { [workRef]: { color: '#5393FF', dateAdded: 1 } } });
    const colorLocal = empty({ [folderColors]: { [workRef]: { color: '#22C55E', dateAdded: 1 } } });
    const colorBoth = empty({ [folderColors]: { [workRef]: { color: '#F59E0B', dateAdded: 1 } } });

    expect(describeConflict(colorBase, colorLocal, colorBoth, [folderColors])).toEqual([
      { key: folderColors, field: workRef, domain: 'preference', local: { kind: 'text', value: '#22C55E' }, remote: { kind: 'text', value: '#F59E0B' } }
    ]);
  });

  it('summarizes what each side did to the shortcuts, with a capped list of names', () => {
    const link = (id: string, title: string) => ({ id, type: 'link', title, url: `https://${id}.example/` });
    const base = state({ shortcuts: [link('a', 'A'), link('b', 'B'), link('c', 'C')] });
    const local = state({ shortcuts: [link('b', 'B'), link('a', 'A'), link('c', 'C2'), link('d', 'D')] });
    const remote = state({ shortcuts: [link('a', 'A'), link('c', 'C')] });
    const [summary] = describeConflict(base, local, remote, ['shortcuts']);

    expect(summary.local).toEqual({ total: 4, added: { names: ['D'], count: 1 }, removed: { names: [], count: 0 },
      changed: { names: ['C2'], count: 1 }, reordered: true });
    expect(summary.remote).toEqual({ total: 2, added: { names: [], count: 0 }, removed: { names: ['B'], count: 1 },
      changed: { names: [], count: 0 }, reordered: false });
    const many = Array.from({ length: 9 }, (_, index) => link(`n${index}`, `N${index}`));
    const [capped] = describeConflict(empty(), state({ shortcuts: many }), empty(), ['shortcuts']);
    expect(capped.local).toMatchObject({ added: { count: 9, names: ['N0', 'N1', 'N2', 'N3', 'N4', 'N5'] } });
  });
});
