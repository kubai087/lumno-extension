import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTheme } from '../../shared/favicon/favicon-theme';
import { siteThemeEvents } from '../../shared/favicon/theme-caches';
import { pageColorScheme } from '../theme/page-color-scheme';
import { useCardTheme } from './card-theme';

type Theme = Parameters<Parameters<typeof useCardTheme>[1]['apply'] & object>[1];

interface Subject {
  url: string;
}

const known = buildTheme([10, 20, 30]);
const read = buildTheme([40, 50, 60]);
const changed = buildTheme([70, 80, 90]);
const subject: Subject = { url: 'https://www.example.com/' };
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  act(() => pageColorScheme.setState({ dark: false }));
});

function mountCard(input: { followSite?: (subject: Subject, siteTheme: Theme) => Promise<Theme>; readKey?: number }) {
  const apply = vi.fn<(card: HTMLDivElement, theme: Theme, host: string) => void>();
  const queue = vi.fn((_card: HTMLDivElement, _subject: Subject, onTheme: (theme: Theme) => void) => onTheme(read));
  function Card({ readKey }: { readKey?: number }) {
    const cardRef = useRef<HTMLDivElement>(null);
    useCardTheme(cardRef, {
      immediateTheme: known,
      host: 'www.example.com',
      subject,
      priority: 0,
      queue,
      apply,
      followSite: input.followSite,
      readKey
    });
    return <div ref={cardRef} />;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Card readKey={input.readKey} />));
  return { apply, queue, rerender: (readKey: number) => act(() => root?.render(<Card readKey={readKey} />)) };
}

describe('useCardTheme', () => {
  it('draws the known theme, then the read one, then the site theme when it changes', () => {
    const { apply } = mountCard({});

    expect(apply.mock.calls.map((call) => call[1])).toEqual([known, read]);
    expect(apply).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), read, 'www.example.com');

    act(() => siteThemeEvents.emit('changed', { host: 'other.example', theme: changed }));
    expect(apply).toHaveBeenCalledTimes(2);

    act(() => siteThemeEvents.emit('changed', { host: 'example.com', theme: changed }));
    expect(apply).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), changed, 'www.example.com');
  });

  it('draws again when the page turns dark', () => {
    const { apply } = mountCard({});
    apply.mockClear();

    act(() => pageColorScheme.setState({ dark: true }));

    expect(apply).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), read, 'www.example.com');
  });

  it('takes what followSite gives for a site change, and reads again for a new read key', async () => {
    const own = buildTheme([100, 110, 120]);
    const followSite = vi.fn(() => Promise.resolve<Theme>(own));
    const { apply, queue, rerender } = mountCard({ followSite, readKey: 0 });
    expect(queue).toHaveBeenCalledOnce();

    await act(async () => {
      siteThemeEvents.emit('changed', { host: 'example.com', theme: changed });
      await Promise.resolve();
    });
    expect(followSite).toHaveBeenCalledWith(subject, changed);
    expect(apply).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), own, 'www.example.com');

    rerender(1);
    expect(queue).toHaveBeenCalledTimes(2);
  });
});
