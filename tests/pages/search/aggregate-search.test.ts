import { describe, expect, it } from 'vitest';
import { getElement, getElements } from '../../fakes/dom';
import { readRepoFile } from '../../fakes/css';
import { serializeAggregateSearches } from '../../../src/domain/search/aggregate-search-store';
import { aggregateSearches, siteSearchDisabled } from '../../../src/domain/settings/search';
import { SURFACES, openSearchSurface, type SearchSurface, type SurfaceMessage, type SurfaceName } from './surfaces';

// Aggregate searches run one query on several sources at once. They are
// defined in Settings (src/options/features/search-sources) and offered as
// scopes on both search surfaces; the worker side is tested in
// src/background/aggregate-search/.

const DEFINITIONS = serializeAggregateSearches([
  { id: 'research', key: 'rs', name: 'Research', sourceRefs: ['builtin:gg', 'builtin:bi'] },
  { id: 'broken', key: 'br2', name: 'Broken', sourceRefs: ['builtin:gg', 'custom:missing'] }
]);

function stored(name: SurfaceName, values: Record<string, unknown>) {
  return name === 'overlay' ? { settings: values } : { settings: values, local: values };
}

async function open(name: SurfaceName, runAnswer: () => unknown = () => ({ ok: true })) {
  const surface = await openSearchSurface(name, {
    respond: (message: SurfaceMessage) => (message.action === 'runAggregateSearchQuery' ? runAnswer() : undefined),
    ...stored(name, { [aggregateSearches.key]: DEFINITIONS })
  });
  await surface.settle(80);
  return surface;
}

async function chooseResearch(surface: SearchSurface) {
  await surface.type('rs');
  surface.press('Tab');
  await surface.settle(80);
}

function menuIds(surface: SearchSurface): Array<string | null> {
  return getElements(surface.root(), '.x-lumno-search-input-mode__menu-item').map((item) => item.getAttribute('data-mode-id'));
}

const isNormalSearch = (message: SurfaceMessage) => message.action === 'createTab' || message.action === 'searchOrNavigate';

describe('Aggregate search packaging', () => {
  it('needs only the tabs and tabGroups permissions the extension has', () => {
    const manifest: unknown = JSON.parse(readRepoFile('manifest.json'));
    expect(manifest).toMatchObject({ permissions: expect.arrayContaining(['tabs', 'tabGroups']) });
  });

  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('is localized in %s', (locale) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    const filled = { message: expect.stringMatching(/\S/) };
    expect(messages).toMatchObject(Object.fromEntries([
      'aggregate_search_clear', 'confirm_clear_aggregate_search', 'aggregate_search_key_placeholder',
      'aggregate_search_source_summary_unavailable', 'aggregate_search_sources_unavailable_error',
      'aggregate_search_in_progress', 'aggregate_search_partial_failure', 'aggregate_search_degraded_success',
      'aggregate_search_storage_unavailable_error', 'aggregate_search_source_selection_unavailable_error'
    ].map((key) => [key, filled])));
  });
});

describe.each(SURFACES)('%s aggregate search', (name) => {
  it('offers the usable aggregates as scopes and hides one whose sources no longer resolve', async () => {
    const surface = await open(name);
    await surface.openScopeMenu();
    expect(menuIds(surface)).toContain('aggregate:research');
    expect(menuIds(surface)).not.toContain('aggregate:broken');
  });

  it('runs the aggregate from its trigger on Enter, without a normal search', async () => {
    const surface = await open(name);
    await surface.type('rs');
    expect(getElement(surface.root(), '.x-lumno-search-input-mode__tab-hint').textContent?.trim()).toBe('TabSearch Research');
    surface.press('Tab');
    await surface.settle(80);
    expect(surface.scopeLabel()).toBe('Research');
    expect(surface.root().querySelector('[data-search-input-mode-prefix] .ri-stack-line')).not.toBeNull();
    await surface.type('hello');
    const before = surface.messages.length;
    surface.press('Enter');
    await surface.settle(150);
    const sent = surface.messages.slice(before);
    const run = sent.find((message) => message.action === 'runAggregateSearchQuery');
    expect([run?.aggregateId, run?.query]).toEqual(['research', 'hello']);
    expect(sent.some(isNormalSearch)).toBe(false);
    expect(surface.navigation()).toBeNull();
  });

  it('does nothing more on a second Enter while a run is pending', async () => {
    const surface = await open(name, () => new Promise(() => {}));
    await chooseResearch(surface);
    await surface.type('hello');
    const before = surface.messages.length;
    surface.press('Enter');
    await surface.settle(60);
    surface.press('Enter');
    await surface.settle(100);
    const sent = surface.messages.slice(before);
    expect(sent.filter((message) => message.action === 'runAggregateSearchQuery')).toHaveLength(1);
    expect(sent.some(isNormalSearch)).toBe(false);
    expect(surface.navigation()).toBeNull();
  });

  it('clears the active aggregate when one of its sources is disabled', async () => {
    const surface = await open(name);
    await chooseResearch(surface);
    expect(surface.scopeLabel()).toBe('Research');
    surface.changeSetting(siteSearchDisabled.key, ['bi']);
    await surface.settle(150);
    expect(surface.scopeLabel()).toBe('');
  });

  it('offers an aggregate added in Settings without a reload', async () => {
    const surface = await open(name);
    surface.changeSetting(aggregateSearches.key, serializeAggregateSearches([
      { id: 'research', key: 'rs', name: 'Research', sourceRefs: ['builtin:gg', 'builtin:bi'] },
      { id: 'video', key: 'vd', name: 'Video', sourceRefs: ['builtin:yt', 'builtin:bb'] }
    ]));
    await surface.settle(120);
    await surface.openScopeMenu();
    expect(menuIds(surface)).toContain('aggregate:video');
  });
});
