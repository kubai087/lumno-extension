// The daily quote on the Options page: the same settings as the quote
// section of New Tab's appearance panel. Both edit one synced preference
// record; the custom collection lives on this device and travels with
// WebDAV, not browser sync.
import { useMemo, useState } from 'react';
import * as CustomQuotes from '../../../domain/custom-quotes';
import { newtabQuotePrefs } from '../../../domain/settings';
import type { NewtabQuotePrefs } from '../../../domain/settings/newtab-quote';
import * as NewtabQuoteSettings from '../../../domain/settings/newtab-quote';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { DailyQuoteSection as DailyQuoteView, type DailyQuoteSectionHandlers } from '../../react/daily-quote-section';
import { POSITIONS, getDailyQuoteRows, getLibraryRow } from './daily-quote-rows';

export function DailyQuoteSection() {
  const { settingsStore, showToast, getViewportTopInset } = useOptionsPage();
  const t = useMessages();
  const prefs = useSetting(settingsStore, newtabQuotePrefs);
  const storedLibrary = useSetting(settingsStore, NewtabQuoteSettings.customQuotes);
  const library = useMemo(() => CustomQuotes.normalizeLibrary(storedLibrary), [storedLibrary]);
  const [importing, setImporting] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [importError, setImportError] = useState('');

  const handlers = useMemo<DailyQuoteSectionHandlers>(() => {
    function persist(patch: Partial<NewtabQuotePrefs>): Promise<void> {
      const next = newtabQuotePrefs.parse({ ...prefs, ...patch });
      return settingsStore.set(newtabQuotePrefs, next).catch(() => {});
    }

    async function importFile(file: File): Promise<void> {
      if (importing) return;
      setImporting(true);
      setImportError('');
      let saving = false;
      try {
        const next = await CustomQuotes.readLibraryFile(file);
        saving = true;
        await settingsStore.setMany([
          [NewtabQuoteSettings.customQuotes, next],
          [NewtabQuoteSettings.customQuotePick, null]
        ]);
        await persist({ provider: 'custom' });
      } catch (_error) {
        setImportError(saving
          ? t('newtab_quote_collection_save_error', 'Couldn’t save on this device. Your previous collection is kept.')
          : t('newtab_quote_import_error', 'Import failed: the file doesn’t meet the format or size limits. Your previous collection is kept.'));
      } finally {
        setImporting(false);
      }
    }

    // Moves today's pick on, the way Shuffle on New Tab does; an open New
    // Tab follows the stored pick.
    async function shuffle(): Promise<void> {
      if (shuffling || !library) return;
      setShuffling(true);
      try {
        const quoteSettings = [NewtabQuoteSettings.customQuotes, NewtabQuoteSettings.customQuotePick];
        await settingsStore.include(quoteSettings);
        const current = CustomQuotes.normalizeLibrary(settingsStore.getStored(NewtabQuoteSettings.customQuotes));
        if (!current) return;
        const storedPick = CustomQuotes.readQuotePick(settingsStore.getStored(NewtabQuoteSettings.customQuotePick));
        const selected = CustomQuotes.select(current, new Date(), storedPick, true);
        await settingsStore.set(NewtabQuoteSettings.customQuotePick, selected.pick);
        showToast(selected.quote.text);
      } catch (_error) {
        showToast(t('newtab_quote_shuffle_error', 'Could not load another quote'), true);
      } finally {
        setShuffling(false);
      }
    }

    return {
      rows: {
        onToggle(key, checked) {
          if (key === 'enabled') {
            void persist({ enabled: checked });
          }
        },
        onSelect(key, value) {
          switch (key) {
            case 'provider':
              void persist({ provider: value === 'custom' ? 'custom' : 'hitokoto' });
              break;
            case 'category':
              void persist({ category: value === 'poetry' ? 'poetry' : 'literature' });
              break;
            case 'position':
              void persist({ position: POSITIONS.find((position) => position === value) || 'search' });
              break;
            case 'font':
              void persist({ font: value });
              break;
          }
        },
        onSlide(key, value) {
          if (key === 'fontSize') {
            void persist({ fontSize: value });
          }
        },
        getViewportTopInset
      },
      onImport: (file) => { void importFile(file); },
      onShuffle: () => { void shuffle(); }
    };
  }, [settingsStore, showToast, t, getViewportTopInset, prefs, library, importing, shuffling]);

  const state = { prefs, library, importing, shuffling, importError };
  return <DailyQuoteView handlers={handlers} model={{ rows: getDailyQuoteRows(t, state), library: getLibraryRow(t, state) }} />;
}
