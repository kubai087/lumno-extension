import { act, useLayoutEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PortalHost } from './portal-host';

let hosts: PortalHost[] = [];

function createHost(): PortalHost {
  const rootContainer = document.createElement('div');
  document.body.appendChild(rootContainer);
  const host = new PortalHost(rootContainer);
  hosts.push(host);
  return host;
}

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  act(() => hosts.forEach((host) => host.destroy()));
  hosts = [];
  document.body.replaceChildren();
});

describe('PortalHost', () => {
  it('draws a view into its container before show returns', () => {
    const host = createHost();
    const container = createContainer();
    host.show(container, <span>first</span>);
    expect(container.textContent).toBe('first');
    host.show(container, <span>second</span>);
    expect(container.textContent).toBe('second');
    host.remove(container);
    expect(container.textContent).toBe('');
  });

  it('keeps each view in its own container', () => {
    const host = createHost();
    const a = createContainer();
    const b = createContainer();
    host.show(a, <span>a</span>);
    host.show(b, <span>b</span>);
    host.remove(a);
    expect([a.textContent, b.textContent]).toEqual(['', 'b']);
  });

  it('keeps a view mounted while another view changes', () => {
    const host = createHost();
    const a = createContainer();
    const b = createContainer();
    host.show(a, <input defaultValue="kept" />);
    const input = a.querySelector('input');
    host.show(b, <span>b</span>);
    expect(a.querySelector('input')).toBe(input);
  });

  it('draws a view shown from inside another view\'s layout effect', () => {
    const host = createHost();
    const a = createContainer();
    const b = createContainer();
    function Opener() {
      useLayoutEffect(() => {
        host.show(b, <span>nested</span>);
      }, []);
      return <span>opener</span>;
    }
    act(() => host.show(a, <Opener />));
    expect(b.textContent).toBe('nested');
  });
});
