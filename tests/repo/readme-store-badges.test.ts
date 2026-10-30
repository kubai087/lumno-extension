import { describe, expect, it } from 'vitest';
import { readRepoText } from './repository';

const BADGES = [
  'chrome-web-store-large-bordered.png',
  'microsoft-edge-addons-badge.png',
  'firefox-get-the-addon-badge.png'
];

describe('README store badges', () => {
  const readme = readRepoText('README.md');

  it('draws every store badge at the same width', () => {
    const widths = BADGES.map((name) => {
      const match = readme.match(new RegExp(`<img[^>]+src="\\./assets/images/readme/${name}"[^>]+width="(\\d+)"`));
      expect(match, `missing store badge markup for ${name}`).not.toBeNull();
      return match ? Number(match[1]) : NaN;
    });

    expect(new Set(widths).size).toBe(1);
  });

  it('stacks the badges vertically: Chrome, Edge, then Firefox', () => {
    expect(readme).toMatch(
      /chrome-web-store-large-bordered\.png[\s\S]*?<\/a><br \/>[\s\S]*?microsoft-edge-addons-badge\.png[\s\S]*?<\/a><br \/>[\s\S]*?firefox-get-the-addon-badge\.png/
    );
  });

  // A release badge rather than a version number written into the README, so
  // the README never falls behind a release.
  it('centers the latest release badge below the store badges', () => {
    expect(readme).toMatch(
      /firefox-get-the-addon-badge\.png[\s\S]*?<p align="center">\s*<a href="https:\/\/github\.com\/kubai087\/lumno-extension\/releases\/latest"><img src="https:\/\/img\.shields\.io\/github\/v\/release\/kubai087\/lumno-extension\?/
    );
  });
});
