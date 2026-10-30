import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION,
  shouldSuppressRestrictedCommandFallback,
  shouldTriggerOnboardingOverlayFromCommand
} from './command-target-policy';

const onboardingUrl = 'chrome-extension://abc/src/onboarding/onboarding.html?entry=ext';
const newtabUrl = 'chrome-extension://abc/newtab.html?focus=1';
const pageUrl = 'https://example.com/';
const options = {
  isOwnExtensionUrl: (candidate: unknown) => String(candidate || '').startsWith('chrome-extension://abc/'),
  isOnboardingUrl: (candidate: unknown) => String(candidate || '').startsWith('chrome-extension://abc/src/onboarding/onboarding.html')
};

describe('command target policy', () => {
  it('shares one action name with onboarding for the command-opened overlay', () => {
    expect(ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION).toBe('triggerOnboardingSearchOverlayFromCommand');
  });

  it('hands search commands on the onboarding page back to the onboarding page', () => {
    expect(shouldSuppressRestrictedCommandFallback('commands', onboardingUrl, options)).toBe(true);
    expect(shouldTriggerOnboardingOverlayFromCommand('commands', onboardingUrl, options)).toBe(true);
    expect(shouldSuppressRestrictedCommandFallback('commands-prefill', onboardingUrl, options)).toBe(true);
  });

  it('keeps the restricted-page handling for page hotkeys, New Tab and web pages', () => {
    expect(shouldSuppressRestrictedCommandFallback('page-hotkey', onboardingUrl, options)).toBe(false);
    expect(shouldSuppressRestrictedCommandFallback('commands', newtabUrl, options)).toBe(false);
    expect(shouldSuppressRestrictedCommandFallback('commands', pageUrl, options)).toBe(false);
  });
});
