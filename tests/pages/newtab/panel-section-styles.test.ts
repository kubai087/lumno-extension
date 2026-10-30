import { describe, expect, it } from 'vitest';
import { parseCss, readStylesheetSource } from '../../fakes/css';

// Collapsible bodies of the appearance panel animate their height; their
// rows must not shrink with it, or they squeeze together and spread apart
// while a section opens.
describe('New Tab panel section styles', () => {
  it.each(['.x-nt-panel-section-body', '.x-nt-quote-body', '.x-nt-panel-field-group'])('keeps the rows of %s from shrinking while it animates open', (body) => {
    const css = parseCss(readStylesheetSource('src/newtab/newtab.css'));
    expect(css.rule(`${body} > *`)?.get('flex-shrink')).toBe('0');
  });
});
