import { describe, expect, it } from 'vitest';
import { buildFrameHeaderRules, buildWorkerHeaderRule, isPreviewableUrl, readUrlDomain } from './frame-rules';

const headersOf = (rule: chrome.declarativeNetRequest.Rule) => (rule.action.responseHeaders || []).map((entry) => entry.header);

describe('the header rules of a link preview', () => {
  it("removes framing headers only from the previewed site's subframes in the previewing tab, settled on the response", () => {
    const [frameOptionsRule, cspRule] = buildFrameHeaderRules(7, [2, 3], ['example.com']);

    expect(frameOptionsRule.id).toBe(2);
    expect(frameOptionsRule.condition).toEqual({
      tabIds: [7], requestDomains: ['example.com'], resourceTypes: ['sub_frame'], responseHeaders: [{ header: 'x-frame-options' }]
    });
    expect(headersOf(frameOptionsRule)).toEqual(['x-frame-options']);
    expect(cspRule.id).toBe(3);
    expect(headersOf(cspRule)).toEqual(['content-security-policy']);
    // A CSP goes only when it refuses framing; its limits on script stay.
    expect(cspRule.condition.responseHeaders).toEqual([{ header: 'content-security-policy', values: ['*frame-ancestors*'] }]);
  });

  it('removes the whole CSP where the browser cannot match on headers', () => {
    const legacy = buildFrameHeaderRules(7, [2, 3], ['example.com'], false);

    expect(legacy).toHaveLength(1);
    expect(headersOf(legacy[0])).toEqual(['x-frame-options', 'content-security-policy']);
  });

  it("reaches only service workers' requests to the previewed sites, and keeps their CSP", () => {
    const workerRule = buildWorkerHeaderRule(['example.com']);

    expect(workerRule.condition.tabIds).toEqual([-1]);
    expect(workerRule.condition.requestDomains).toEqual(['example.com']);
    expect(workerRule.action.responseHeaders).toEqual([{ header: 'x-frame-options', operation: 'remove' }]);
  });

  it('previews web pages only and keys them by their domain', () => {
    expect(isPreviewableUrl('https://example.com/a')).toBe(true);
    expect(isPreviewableUrl('javascript:alert(1)')).toBe(false);
    expect(isPreviewableUrl('chrome://settings')).toBe(false);
    expect(readUrlDomain('https://www.Example.com./a')).toBe('example.com');
    expect(readUrlDomain('https://docs.example.com/a')).toBe('docs.example.com');
    expect(readUrlDomain('chrome://settings')).toBe('');
  });
});
