// The theme a card or tile showing a site takes: the one known at once, then
// the one read from the site's icon, and the site's own when it changes
// later. The card draws it again when the page turns dark or light.
import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { normalizeHost } from '../../domain/favicon/brand-accents';
import type { ThemeVariant } from '../../shared/favicon/favicon-theme';
import { siteThemeEvents } from '../../shared/favicon/theme-caches';
import { pageColorScheme } from '../theme/page-color-scheme';

type CardThemeValue = Partial<ThemeVariant> | null;

interface CardThemeInput<Card extends HTMLElement, Subject> {
  immediateTheme: CardThemeValue;
  host: string;
  // What the theme is read from; null keeps the known theme.
  subject: Subject | null;
  priority: number;
  queue(target: Card, subject: Subject, onTheme: (theme: CardThemeValue) => void, options: { priority: number }): void;
  // Draws the theme on the card; null leaves the card untinted.
  apply: ((card: Card, theme: CardThemeValue, host: string) => void) | null;
  // The theme to take when the site's theme changes; the site's own when
  // not given (a tile tinted by its own icon reads that icon instead).
  followSite?(subject: Subject, siteTheme: ThemeVariant): Promise<CardThemeValue>;
  // Changes when the card's theme should be read again.
  readKey?: number;
}

// A theme the card followed after it drew, and the known theme it replaced.
interface FollowedTheme {
  from: CardThemeValue;
  theme: CardThemeValue;
}

function useCardTheme<Card extends HTMLElement, Subject>(cardRef: RefObject<Card | null>,
  input: CardThemeInput<Card, Subject>): void {
  const { immediateTheme, host, subject, priority, queue, apply, followSite, readKey = 0 } = input;
  const [followed, setFollowed] = useState<FollowedTheme | null>(null);
  const theme = followed && followed.from === immediateTheme ? followed.theme : immediateTheme;
  const dark = useSyncExternalStore(pageColorScheme.subscribe, () => pageColorScheme.getSnapshot().dark);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !subject) {
      return undefined;
    }
    let active = true;
    const take = (next: CardThemeValue) => {
      if (active && next && card.isConnected) {
        setFollowed({ from: immediateTheme, theme: next });
      }
    };
    queue(card, subject, take, { priority });
    const siteHost = normalizeHost(host);
    const stopFollowing = siteHost
      ? siteThemeEvents.on('changed', (change) => {
        if (change.host !== siteHost) {
          return;
        }
        if (followSite) {
          void followSite(subject, change.theme).then(take);
        } else {
          take(change.theme);
        }
      })
      : undefined;
    return () => {
      active = false;
      if (stopFollowing) {
        stopFollowing();
      }
    };
  }, [cardRef, followSite, host, immediateTheme, priority, queue, readKey, subject]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card && apply) {
      apply(card, theme, host);
    }
  }, [apply, cardRef, dark, host, theme]);
}

export { useCardTheme };
