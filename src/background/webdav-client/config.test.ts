import { describe, expect, it } from 'vitest';
import { normalizeConfig } from './config';
import { DAV_CONFIG } from '../../../tests/fakes/webdav';

describe('a WebDAV connection form', () => {
  it('refuses plain HTTP, credentials in the address and a directory outside the endpoint', () => {
    expect(() => normalizeConfig({ ...DAV_CONFIG, endpoint: 'http://dav.test/' })).toThrow(/invalid-endpoint/);
    expect(() => normalizeConfig({ ...DAV_CONFIG, endpoint: 'https://user:password@dav.test/' })).toThrow(/invalid-endpoint/);
    expect(() => normalizeConfig({ ...DAV_CONFIG, directory: '../outside' })).toThrow(/invalid-directory/);
  });
});
