import { describe, expect, it } from 'vitest';
import { createBrowserIconIndex } from './browser-icon-index';

// Firefox's cached icons (open tabs, top sites) stand in for _favicon.
describe('browser icon index', () => {
  function createIndex() {
    const index = createBrowserIconIndex();
    index.add('https://kubai087.feishu.cn/wiki/abc#section', 'data:image/x-icon;base64,RkVJ');
    index.add('https://example.org/', 'https://example.org/favicon.ico');
    index.add('https://code.0http.com/', 'data:image/png;base64,QUJD');
    index.add('https://code.0http.com/custom', 'chrome://global/skin/icons/defaultFavicon.svg');
    index.add('moz-extension://uuid/newtab.html', 'data:image/png;base64,QUJD');
    return index;
  }

  it('matches an exact page whatever its fragment, and another page by its host', () => {
    const index = createIndex();
    expect(index.get('https://kubai087.feishu.cn/wiki/abc')).toBe('data:image/x-icon;base64,RkVJ');
    expect(index.get('https://kubai087.feishu.cn/docx/other')).toBe('data:image/x-icon;base64,RkVJ');
    expect(index.get('https://unknown.example/')).toBe('');
  });

  it('ignores privileged browser icons, remote icon URLs and pages that are not web pages', () => {
    const index = createIndex();
    expect(index.get('https://code.0http.com/custom')).toBe('data:image/png;base64,QUJD');
    expect(index.get('https://example.org/')).toBe('');
    expect(index.get('moz-extension://uuid/newtab.html')).toBe('');
  });

  it('keeps the latest icon for a host, so open tabs override top sites', () => {
    const index = createIndex();
    index.add('https://www.code.0http.com/', 'data:image/png;base64,TkVX');
    expect(index.get('https://code.0http.com/elsewhere')).toBe('data:image/png;base64,TkVX');
  });
});
