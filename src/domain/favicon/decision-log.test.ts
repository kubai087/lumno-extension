import { describe, expect, it } from 'vitest';
import { createFaviconDecisionLogger } from './decision-log';

describe('favicon decision log', () => {
  it('logs one redacted entry per surface, host and reason', () => {
    const logs: unknown[][] = [];
    const log = createFaviconDecisionLogger({ surface: 'test', consoleObj: { debug: (...values) => logs.push(values) } });
    log('https://user:secret@foo.example.com/private/icon.png?token=secret', 'exclusion',
      { pageUrl: 'https://foo.example.com/private?credential=secret', candidateKind: 'direct' });
    log('https://foo.example.com/another-private-icon.png', 'exclusion',
      { pageUrl: 'https://foo.example.com/private/child', candidateKind: 'direct' });
    log('https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.example.com%2Fprivate', 'exclusion',
      { pageUrl: 'https://foo.example.com/private', candidateKind: 'third-party-proxy' });

    expect(logs).toEqual([['[Lumno][favicon]', {
      surface: 'test',
      candidateKind: 'direct',
      hostname: 'foo.example.com',
      decision: 'blocked',
      reason: 'exclusion'
    }]]);
    expect(JSON.stringify(logs)).not.toContain('secret');
  });
});
