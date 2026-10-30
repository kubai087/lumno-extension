import { describe, expect, it } from 'vitest';
import { getBrandAccentForHost, getBrandAccentForUrl } from './brand-accents';

describe('brand accents', () => {
  it('gives Dribbble and its subdomains its pink accent at once', () => {
    expect(getBrandAccentForHost('dribbble.com')).toEqual([234, 100, 217]);
    expect(getBrandAccentForHost('cdn.dribbble.com')).toEqual([234, 100, 217]);
    expect(getBrandAccentForUrl('https://dribbble.com/shots/popular')).toEqual([234, 100, 217]);
  });

  it('gives every Dodo Payments domain one accent', () => {
    const root = getBrandAccentForHost('dodopayments.com');
    expect(root).toBeTruthy();
    expect(getBrandAccentForHost('app.dodopayments.com')).toEqual(getBrandAccentForHost('checkout.dodopayments.com'));
    expect(getBrandAccentForHost('customer.dodopayments.com')).toEqual(root);
  });
});
