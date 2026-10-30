import { describe, expect, it } from 'vitest';
import { ROUTE_PATHS, buildExtensionUrl, buildLumnoNewtabUrl, buildNewtabUrl, buildOptionsUrl, classifyExtensionUrl } from './extension-routes';

const chromeApi = {
  runtime: {
    getURL: (value: string) => `chrome-extension://abc/${value}`
  }
};

describe('extension routes', () => {
  it('builds the New Tab URL with its focus and notice parameters', () => {
    expect(buildNewtabUrl(chromeApi, { focus: true })).toBe('chrome-extension://abc/newtab.html?focus=1');
    expect(buildNewtabUrl(chromeApi, { focus: true, notice: 'file-access' })).toBe('chrome-extension://abc/newtab.html?focus=1&notice=file-access');
  });

  it('builds the standalone Lumno New Tab URL', () => {
    expect(buildLumnoNewtabUrl(chromeApi, { focus: true })).toBe('chrome-extension://abc/src/newtab/lumno-newtab.html?focus=1');
  });

  it('builds the options and onboarding URLs', () => {
    expect(buildOptionsUrl(chromeApi, 'appearance')).toBe('chrome-extension://abc/src/options/options.html#appearance');
    expect(buildExtensionUrl(chromeApi, ROUTE_PATHS.onboarding)).toBe('chrome-extension://abc/src/onboarding/onboarding.html');
  });

  it('classifies the current, previous and standalone New Tab URLs as New Tab', () => {
    expect(classifyExtensionUrl('chrome-extension://abc/newtab.html?focus=1')).toBe('newtab');
    expect(classifyExtensionUrl('chrome-extension://abc/src/newtab/newtab.html?focus=1')).toBe('newtab');
    expect(classifyExtensionUrl('chrome-extension://abc/src/newtab/lumno-newtab.html?focus=1')).toBe('newtab');
  });

  it('classifies the options, onboarding and other extension URLs', () => {
    expect(classifyExtensionUrl('chrome-extension://abc/src/options/options.html#appearance')).toBe('options');
    expect(classifyExtensionUrl('chrome-extension://abc/src/onboarding/onboarding.html?entry=ext')).toBe('onboarding');
    expect(classifyExtensionUrl('chrome-extension://abc/src/other/page.html')).toBe('other');
  });
});
