import { describe, expect, it } from 'vitest';
import { getFeatureHint, normalizeDismissStorage } from './feature-hint-catalog';
import { required } from '../../../tests/fakes/dom';

describe('feature hint catalog', () => {
  it('remembers dismissals on this device or across synced devices', () => {
    expect(normalizeDismissStorage('local')).toBe('local');
    expect(normalizeDismissStorage('sync')).toBe('sync');
  });

  it('points the tab switcher hint at the New Tab settings icon with the platform shortcut', () => {
    const hint = required(getFeatureHint('newtab-tab-switcher'), 'tab switcher hint');
    expect(hint.introducedIn).toBe('0.9.13');
    expect(hint.placement).toBe('newtab settings icon');
    expect(hint.className).toBe('x-lumno-feature-hint--newtab-tab-switcher');
    expect(hint.textFallback).toMatch(/\{shortcut\}[\s\S]*tab switcher/i);
  });

  it('marks WebDAV sync as a beta above the settings button until it is acknowledged', () => {
    const hint = required(getFeatureHint('newtab-webdav-sync'), 'WebDAV hint');
    expect(hint).toMatchObject({
      introducedIn: '0.9.58',
      placement: 'above newtab settings button',
      arrowAlign: 'end',
      widthMode: 'content',
      badgeFallback: 'Beta',
      className: 'x-lumno-feature-hint--newtab-webdav-sync',
      rememberOnFirstShow: false,
      linkKey: 'newtab_webdav_feature_hint_link'
    });
  });

  it('points the Help Center ask hint down at where typing starts, synced until closed or used', () => {
    const hint = required(getFeatureHint('newtab-help-center-ask'), 'Help Center ask hint');
    expect(hint).toMatchObject({
      introducedIn: '1.0.0',
      placement: 'above search input',
      arrowSide: 'bottom',
      arrowAlign: 'start',
      dismissStorage: 'sync',
      rememberOnFirstShow: false,
      linkKey: 'newtab_help_center_ask_feature_hint_link'
    });
  });

  it('points the new wallpapers hint at the appearance button', () => {
    const hint = required(getFeatureHint('newtab-wallpaper-sources'), 'wallpaper sources hint');
    expect(hint).toMatchObject({
      introducedIn: '0.9.58',
      placement: 'bottom-right wallpaper control',
      arrowSide: 'right'
    });
  });
});
