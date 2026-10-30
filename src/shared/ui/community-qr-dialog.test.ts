import { afterEach, describe, expect, it } from 'vitest';
import { HOST_ID, close, isOpen, open } from './community-qr-dialog';
import { expectElement, getElement, getTag } from '../../../tests/fakes/dom';

function showTrigger(): HTMLButtonElement {
  document.documentElement.style.overflowY = 'scroll';
  const trigger = document.createElement('button');
  trigger.textContent = 'Join';
  document.body.appendChild(trigger);
  trigger.focus();
  return trigger;
}

function openedShadow(): ShadowRoot {
  const host = expectElement(document.getElementById(HOST_ID), 'the dialog host');
  if (!host.shadowRoot) {
    throw new Error('Expected the dialog to draw in its own shadow root.');
  }
  return host.shadowRoot;
}

afterEach(() => {
  close();
  document.getElementById(HOST_ID)?.remove();
  document.documentElement.removeAttribute('style');
});

describe('community QR dialog', () => {
  it('shows the QR over the page in the surface theme with focus inside', () => {
    showTrigger();
    const dialog = open({
      imageUrl: 'https://lumno.kubai.design/qrcode.webp',
      title: 'Bug 反馈 & 新功能提需',
      alt: 'Lumno 微信群二维码',
      closeLabel: '关闭',
      theme: 'dark'
    });

    expect(dialog).not.toBeNull();
    expect(document.getElementById(HOST_ID)?.getAttribute('data-theme')).toBe('dark');
    const shadow = openedShadow();
    expect(getTag(shadow, 'img', 'img').getAttribute('src')).toBe('https://lumno.kubai.design/qrcode.webp');
    expect(getElement(shadow, '[role="dialog"]').getAttribute('aria-modal')).toBe('true');
    expect(shadow.activeElement).toBe(getElement(shadow, '.close'));
  });

  it('leaves the page scrollbar and body alone but swallows scrolling behind it', () => {
    showTrigger();
    open({ imageUrl: 'https://lumno.kubai.design/qrcode.webp' });

    expect(document.documentElement.style.overflowY).toBe('scroll');
    expect(document.body.getAttribute('style')).toBeNull();
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    getElement(openedShadow(), '.backdrop').dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('closes on Escape without the page seeing it and returns focus', () => {
    const trigger = showTrigger();
    open({ imageUrl: 'https://lumno.kubai.design/qrcode.webp', returnFocus: trigger });
    let pageSawEscape = false;
    const listener = () => {
      pageSawEscape = true;
    };
    document.addEventListener('keydown', listener);

    getElement(openedShadow(), '.close').dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, composed: true, cancelable: true
    }));
    document.removeEventListener('keydown', listener);

    expect(isOpen()).toBe(false);
    expect(pageSawEscape).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('replaces an open dialog and opens nothing without an image', () => {
    open({ imageUrl: 'https://lumno.kubai.design/a.webp' });
    open({ imageUrl: 'https://lumno.kubai.design/b.webp' });
    expect(isOpen()).toBe(true);
    close();
    expect(isOpen()).toBe(false);
    expect(open({ imageUrl: '' })).toBeNull();
  });
});
