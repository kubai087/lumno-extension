import { describe, expect, it } from 'vitest';
import { parseHtmlIconCandidates, parseHtmlManifestUrls, parseManifestIconCandidates } from './candidates';

const HTML = `
  <html><head>
    <base href="https://cdn.example.com/assets/">
    <link rel="icon" type="image/png" sizes="32x32" href="small.png">
    <link rel="icon" type="image/svg+xml" href="brand.svg">
    <link rel="apple-touch-icon" sizes="180x180" href="touch.png">
    <link rel="manifest" href="/app.webmanifest">
  </head></html>
`;

describe('shortcut icon candidates', () => {
  it('ranks a page\'s vector icon first and large touch icons ahead of small favicons', () => {
    const candidates = parseHtmlIconCandidates(HTML, 'https://example.com/docs', 'light');
    expect(candidates[0]).toMatchObject({ url: 'https://cdn.example.com/assets/brand.svg', vector: true });
    const position = (suffix: string) => candidates.findIndex((item) => item.url.endsWith(suffix));
    expect(position('/touch.png')).toBeLessThan(position('/small.png'));
  });

  it('finds the page\'s manifest against its base URL', () => {
    expect(parseHtmlManifestUrls(HTML, 'https://example.com/docs')).toEqual(['https://cdn.example.com/app.webmanifest']);
  });

  it('ranks manifest icons vector first, then by size, and keeps their "any" purpose', () => {
    const candidates = parseManifestIconCandidates({
      icons: [
        { src: 'icon-64.png', sizes: '64x64', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
      ]
    }, 'https://example.com/app.webmanifest');
    expect(candidates[0].url).toBe('https://example.com/icon.svg');
    expect(candidates[1]).toMatchObject({ url: 'https://example.com/icon-512.png', purpose: 'any' });
  });
});
