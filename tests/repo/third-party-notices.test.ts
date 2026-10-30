import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTENSION_DIR, readRepoJson, readRepoText, recordField, repoPath } from './repository';

// THIRD_PARTY_NOTICES.md is the index of every third-party license the store
// package ships. A moved license file, a bundled dependency without its
// license text or a vendored upgrade the notices miss would ship a package
// that no longer carries the notices its licenses require.

// Build output from the development build, anything else from the repository.
function extensionFilePath(file: string): string {
  return file.startsWith('build/') ? join(EXTENSION_DIR, file) : repoPath(file);
}

describe('third-party notices', () => {
  const notices = readRepoText('THIRD_PARTY_NOTICES.md');

  it('links to license files that exist', () => {
    const targets = [...notices.matchAll(/\]\(([^)#]+)\)/g)]
      .map((match) => match[1])
      .filter((target) => !/^https?:/.test(target));

    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((target) => !existsSync(extensionFilePath(target)))).toEqual([]);
  });

  it('ships every bundled dependency with its license text and names it in the notices', () => {
    const sections = readFileSync(extensionFilePath('build/third-party-licenses.md'), 'utf8').split(/^## /m).slice(1);
    const bundled = new Set(sections.map((section) => section.split(' - ')[0]));

    sections.forEach((section) => {
      const [heading, ...body] = section.trim().split('\n');
      expect(body.join('\n').trim(), `${heading} should ship with its license text`).not.toBe('');
    });
    Object.keys(recordField(readRepoJson('package.json'), 'dependencies')).forEach((name) => {
      expect(bundled.has(name), `the bundles' license files should list ${name}`).toBe(true);
      expect(notices).toContain(name);
    });
  });

  it('names the bundled Remix Icon version', () => {
    const version = readRepoText('assets/remixicon/fonts/remixicon.css').match(/Remix Icon v(\d+\.\d+\.\d+)/);

    expect(version).not.toBeNull();
    expect(notices).toContain(`Remix Icon](https://github.com/Remix-Design/RemixIcon) ${version ? version[1] : ''}`);
  });
});
