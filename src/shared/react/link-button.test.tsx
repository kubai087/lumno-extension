import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { LinkButton } from './link-button';
import { getTag } from '../../../tests/fakes/dom';

let roots: Root[] = [];

function render(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(node));
  return host;
}

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.replaceChildren();
});

describe('LinkButton', () => {
  it('renders an in-page link with the trailing ↗ icon', () => {
    const host = render(
      <LinkButton className="extra" href="/options#appearance">More settings</LinkButton>
    );
    const link = getTag(host, 'a', 'a');
    expect(link.className).toBe('x-lumno-link-button extra');
    expect(link.hasAttribute('target')).toBe(false);
    expect(link.querySelector('.x-lumno-link-button__label')?.textContent).toBe('More settings');
    expect(link.lastElementChild?.className).toBe(
      'ri-icon x-lumno-link-button__icon ri-external-link-line'
    );
  });

  it('opens external links in a new tab with a leading icon and label props', () => {
    const host = render(
      <LinkButton
        external
        href="https://example.com"
        labelProps={{ 'data-i18n': 'label_key' }}
        leadingIcon="ri-github-line"
      >
        GitHub
      </LinkButton>
    );
    const link = getTag(host, 'a', 'a');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.firstElementChild?.classList.contains('ri-github-line')).toBe(true);
    expect(link.querySelector('.x-lumno-link-button__label')?.getAttribute('data-i18n')).toBe('label_key');
    expect(link.querySelector('.ri-external-link-line')).not.toBeNull();
  });
});
