import { describe, expect, it } from 'vitest';
import { REVISION, error } from '../webdav-client/errors';
import { failureReply, isTrustedSender, readWebDavRequest } from './records';
import { DAV_CONFIG } from '../../../tests/fakes/webdav';

describe('WebDAV messages', () => {
  const caller = { runtime: { id: 'our-extension', getURL: (path: string) => `chrome-extension://our-extension/${path}` } };

  it("trusts only this extension's Settings page", () => {
    expect(isTrustedSender(caller, { id: 'our-extension', url: `${caller.runtime.getURL('src/options/options.html')}#account` })).toBe(true);
    expect(isTrustedSender(caller, { id: 'other-extension', url: caller.runtime.getURL('src/options/options.html') })).toBe(false);
    expect(isTrustedSender(caller, { id: 'our-extension', url: 'https://webpage.test/' })).toBe(false);
    expect(isTrustedSender(caller, { id: 'our-extension', url: caller.runtime.getURL('newtab.html') })).toBe(false);
  });

  it('reads a request only with a known operation and well-typed fields', () => {
    expect(readWebDavRequest({ action: 'webdav', operation: 'save', id: 'a', config: DAV_CONFIG, resume: true }))
      .toEqual({ operation: 'save', id: 'a', config: DAV_CONFIG, resume: true });
    expect(readWebDavRequest({ action: 'webdav', operation: 'status' })).toEqual({ operation: 'status' });
    expect(readWebDavRequest({ action: 'webdav', operation: 'toString' })).toBeNull();
    expect(readWebDavRequest({ action: 'webdav', operation: 'save', id: 7 })).toBeNull();
    expect(readWebDavRequest({ action: 'webdav', operation: 'save', config: 'endpoint' })).toBeNull();
    expect(readWebDavRequest({ action: 'webdav', operation: 'add', enable: 'yes' })).toBeNull();
  });

  it('replies to a failure with its code and redacted diagnostic, and to one without a code as a failed sync', () => {
    const unsupported = Object.assign(error('conditional-write-unsupported'),
      { diagnostic: { revision: REVISION, phase: 'state-etag', statuses: [412, 'x'], password: 'secret' } });

    expect(failureReply(unsupported)).toEqual({ ok: false, error: 'conditional-write-unsupported',
      diagnostic: { revision: REVISION, phase: 'state-etag', statuses: [412] } });
    expect(failureReply(new DOMException('The operation timed out.', 'TimeoutError'))).toEqual({ ok: false, error: 'sync-failed', diagnostic: null });
  });
});
