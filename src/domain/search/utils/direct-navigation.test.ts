import { describe, expect, it } from 'vitest';
import { getDirectNavigationUrl, getSearchSuggestionFamilyKey, isUrlLikeSearchQuery, normalizeHost, normalizeHostIdentity, sanitizeDisplayText } from './direct-navigation';

describe('direct navigation', () => {
  it("opens blob, file, mail and other scheme URLs directly but searches data and script URLs", () => {
    const blobUrl = 'blob:https://example.com/6b44b52f-04bb-4dc9-8df3-5d979bd66d5f';
    expect(getDirectNavigationUrl(blobUrl), 'blob protocol URLs should be preserved as direct navigation targets').toBe(blobUrl);
    [
      'file:///Users/kevinxu/Downloads/report.pdf',
      'view-source:https://example.com/',
      'mailto:hello@example.com',
      'magnet:?xt=urn:btih:0123456789abcdef',
      'vscode://file/Users/kevinxu/github/Lumno',
      'about:blank'
    ].forEach((directUrl) => {
      expect(getDirectNavigationUrl(directUrl), `${directUrl} should be preserved as a direct navigation target`).toBe(directUrl);
    });
    [
      'data:text/html,<script>alert(1)</script>',
      'data:text/plain,hello',
      'javascript:alert(1)',
      'JavaScript:alert(document.cookie)'
    ].forEach((input) => {
      expect(getDirectNavigationUrl(input), `${input} should be searched for instead of opened as a top-level page`).toBe('');
    });
  });

  it("tells URL-like queries from words", () => {
    [
      'https://wiki.corp.example/page?token=secret',
      'https://wiki.corp.example/page?token=secret more',
      'file:///Users/someone/contract.pdf',
      'C:\\Users\\someone\\contract.pdf',
      'example.com',
      'jira.internal/browse/SEC-1',
      '10.0.0.8:8080',
      'localhost:3000',
      'data:text/plain,hello',
      'mailto:someone@example.com'
    ].forEach((input) => {
      expect(isUrlLikeSearchQuery(input), `${input} should count as a URL-like query`).toBe(true);
    });
    ['weather tomorrow', 'vue.js tutorial', 'c++ templates', 'site:example.com', ''].forEach((input) => {
      expect(isUrlLikeSearchQuery(input), `${input} should count as words to search`).toBe(false);
    });
  });

  it("opens host-like input over https, with or without a port", () => {
    expect(getDirectNavigationUrl('example.com/docs'), 'shared direct navigation should keep existing host-like input behavior').toBe('https://example.com/docs');
    expect(getDirectNavigationUrl('localhost:3000'), 'host:port development inputs should keep direct navigation behavior').toBe('https://localhost:3000');
    expect(getDirectNavigationUrl('example.com:8080/docs'), 'host:port web inputs should keep direct navigation behavior').toBe('https://example.com:8080/docs');
  });

  it("reads full-width stops in a host as dots, but searches sentences that end in one", () => {
    [
      ['baidu。com', 'https://baidu.com'],
      ['www．example。co。uk/docs', 'https://www.example.co.uk/docs'],
      ['example｡com:8080/a。b', 'https://example.com:8080/a。b']
    ].forEach(([input, expected]) => {
      expect(getDirectNavigationUrl(input), `${input} should read full-width stops in the host as dots`).toBe(expected);
    });
    ['你好。世界', '今天天气不错。', '1。2', 'hello。', 'vue。js 教程'].forEach((input) => {
      expect(getDirectNavigationUrl(input), `${input} should still be searched, not opened`).toBe('');
    });
    expect(getDirectNavigationUrl('site:example.com'), 'search operators should not be treated as direct custom protocol navigation').toBe('');
  });

  it("groups sibling subdomains into one brand family, but keeps hosted tenants apart", () => {
    expect(getSearchSuggestionFamilyKey('https://mall.xiaohongshu.com/finance/cashier/web'), 'brand-family grouping should collapse sibling subdomains under one registrable domain').toBe('xiaohongshu.com');
    expect(getSearchSuggestionFamilyKey('https://lumno.github.io/docs'), 'brand-family grouping should keep separate tenants on common hosted suffixes').toBe('lumno.github.io');
  });

  it("normalizes hosts, sharing the Feishu portal identity, and cleans display text", () => {
    expect(normalizeHost('WWW.Example.COM')).toBe('example.com');
    expect(normalizeHostIdentity('my.feishu.cn'), 'the Feishu account portal should share feishu.cn host identity for icons and site search').toBe('feishu.cn');
    expect(normalizeHostIdentity('www.my.feishu.cn')).toBe('feishu.cn');
    expect(normalizeHostIdentity('docs.feishu.cn')).toBe('docs.feishu.cn');
    expect(normalizeHost('my.feishu.cn'), 'search ranking, dedup and saved selection stats keep the plain host').toBe('my.feishu.cn');
    expect(normalizeHost('')).toBe('');
    expect(normalizeHost(null)).toBe('');
    expect(sanitizeDisplayText('A\u0000B\u200BC\uFEFF\uE000D\uD800 \uD83D\uDE00'), 'display text should drop control, BOM, private-use and lone-surrogate code points').toBe('AB\u200BCD \uD83D\uDE00');
    expect(sanitizeDisplayText(undefined)).toBe('');
  });

});
