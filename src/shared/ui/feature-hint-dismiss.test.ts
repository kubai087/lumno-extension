import { describe, expect, it } from 'vitest';
import { getFeatureHint } from './feature-hint-catalog';
import { required } from '../../../tests/fakes/dom';
import {
  getFeatureHintLocalDismissKey,
  getFeatureHintSessionDismissKey,
  getFeatureHintSyncDismissKey
} from './feature-hint-dismiss';

describe('feature hint dismissal keys', () => {
  it('keeps the session, device and synced dismissals apart', () => {
    const local = getFeatureHintLocalDismissKey('newtab-ai-quick-jump');
    const session = getFeatureHintSessionDismissKey('newtab-ai-quick-jump');
    const sync = getFeatureHintSyncDismissKey('newtab-ai-quick-jump');
    expect(new Set([local, session, sync]).size).toBe(3);
  });

  it('gives a hint introduced again in a later release a new dismissal', () => {
    const hint = required(getFeatureHint('newtab-webdav-sync'), 'WebDAV hint');
    expect(getFeatureHintSyncDismissKey({ ...hint, introducedIn: '0.9.57' }))
      .not.toBe(getFeatureHintSyncDismissKey('newtab-webdav-sync'));
  });
});
