import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTE_PATHS } from '../../src/domain/extension-routes';
import { readRepoJson, recordField, repoPath, stringField } from './repository';

const newtabOverride = stringField(recordField(readRepoJson('manifest.json'), 'chrome_url_overrides'), 'newtab');

describe('extension route pages', () => {
  it('ships the New Tab page the routes name', () => {
    expect(existsSync(repoPath(ROUTE_PATHS.newtab))).toBe(true);
    expect(existsSync(repoPath(ROUTE_PATHS.lumnoNewtab))).toBe(true);
  });

  it('overrides the browser New Tab with the maintained page, so turning off auto-focus stays on chrome://newtab', () => {
    expect(newtabOverride).toBe(ROUTE_PATHS.newtab);
  });

  it('keeps the focused fallback page apart from the browser override', () => {
    expect(ROUTE_PATHS.lumnoNewtab).not.toBe(newtabOverride);
  });
});
