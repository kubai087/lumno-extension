import { describe, expect, it } from 'vitest';
import { diagnostic } from './errors';

describe('WebDAV diagnostics', () => {
  it('keep only the revision, a known phase and up to two statuses', () => {
    expect(diagnostic({ revision: 'dav-lock-5', phase: 'directory-race', statuses: [201, 'app-password', 405], password: 'app-password' }))
      .toEqual({ revision: 'dav-lock-5', phase: 'directory-race', statuses: [201, 405] });
    expect(diagnostic({ revision: 'dav-lock-5', phase: 'https://private-user:password@host/' })).toBeNull();
  });
});
