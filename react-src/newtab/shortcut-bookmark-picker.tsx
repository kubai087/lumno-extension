import { useEffect, useId, useRef, useState } from 'react';

export interface ShortcutBookmarkChoice {
  id: string;
  title: string;
  url: string;
  path: string;
  added?: boolean;
}

interface Props {
  t(key: string, fallback: string): string;
  disabled: boolean;
  load(): Promise<ShortcutBookmarkChoice[]>;
  onSelect(bookmark: ShortcutBookmarkChoice): void;
}

const PAGE_SIZE = 30;

export function ShortcutBookmarkPicker({ t, disabled, load, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [choices, setChoices] = useState<ShortcutBookmarkChoice[]>([]);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const request = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => { if (open) search.current?.focus(); }, [open]);

  async function refresh() {
    const current = ++request.current;
    setLoading(true); setFailed(false);
    try {
      const items = await load();
      if (request.current === current) setChoices(items);
    } catch {
      if (request.current === current) setFailed(true);
    } finally {
      if (request.current === current) setLoading(false);
    }
  }

  function close(restoreFocus = true) {
    request.current += 1;
    setOpen(false); setLoading(false);
    if (restoreFocus) trigger.current?.focus();
  }

  const terms = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = choices.filter((item) => {
    const text = `${item.title} ${item.url} ${item.path}`.normalize('NFKC').toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });

  return <div className="x-nt-shortcut-bookmark-picker">
    <button type="button" ref={trigger}
      className="x-lumno-action-button x-lumno-action-button--secondary x-nt-shortcut-bookmark-trigger"
      disabled={disabled} aria-expanded={open} aria-controls={panelId}
      onClick={() => {
        if (open) { close(); return; }
        setOpen(true); setQuery(''); setVisibleCount(PAGE_SIZE); void refresh();
      }}>
      <i className="ri-icon ri-bookmark-line" aria-hidden="true" />
      {t('shortcut_bookmarks_choose', 'Choose from bookmarks')}
    </button>
    {open ? <section ref={panel} id={panelId} className="x-nt-shortcut-bookmark-panel"
      aria-label={t('shortcut_bookmarks_choose', 'Choose from bookmarks')}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        if (event.nativeEvent.isComposing) { event.stopPropagation(); return; }
        event.preventDefault(); event.stopPropagation(); close();
      }}>
      <label className="x-nt-shortcut-field">
        <span>{t('shortcut_bookmarks_search', 'Search bookmarks')}</span>
        <div className="_x_extension_shortcut_input_affix_2026_unique_" data-has-prefix="false">
          <input ref={search} className="_x_extension_shortcut_input_2024_unique_"
            type="search" value={query} disabled={disabled} autoComplete="off"
            placeholder={t('shortcut_bookmarks_search_hint', 'Title, URL or folder')}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || disabled) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                const first = !loading && !failed && matches.find((item) => !item.added);
                if (first) { onSelect(first); close(false); }
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                panel.current?.querySelector<HTMLButtonElement>('.x-nt-shortcut-bookmark-result:not(:disabled)')?.focus();
              }
            }}
            onChange={(event) => { setQuery(event.currentTarget.value); setVisibleCount(PAGE_SIZE); }} />
        </div>
      </label>
      <p className="x-nt-shortcut-bookmark-status" role={failed ? 'alert' : 'status'}>
        {loading ? t('shortcut_bookmarks_loading', 'Loading bookmarks…')
          : failed ? t('shortcut_bookmarks_error', 'Could not read bookmarks. Try again.')
          : !choices.length ? t('shortcut_bookmarks_empty', 'No available bookmarks. You can enter a URL below.')
          : !matches.length ? t('shortcut_bookmarks_no_results', 'No matching bookmarks. Try another keyword.')
          : `${t('shortcut_bookmarks_results', 'Results')}: ${matches.length}`}
      </p>
      {failed ? <button type="button" disabled={disabled}
        className="x-lumno-action-button x-lumno-action-button--secondary"
        onClick={() => void refresh()}>{t('shortcut_bookmarks_retry', 'Retry')}</button> : null}
      {!loading && !failed ? <ul className="x-nt-shortcut-bookmark-results">
        {matches.slice(0, visibleCount).map((item) => <li key={item.id}>
          <button type="button" className="x-nt-shortcut-bookmark-result" disabled={disabled || item.added}
            onClick={() => { onSelect(item); close(false); }}>
            <span className="x-nt-shortcut-bookmark-copy">
              <strong>{item.title}</strong>
              {item.path ? <span className="x-nt-shortcut-bookmark-path">{item.path}</span> : null}
              <span className="x-nt-shortcut-bookmark-url">{item.url}</span>
            </span>
            {item.added ? <span className="x-nt-shortcut-bookmark-added">{t('shortcut_bookmarks_added', 'Already added')}</span> : null}
          </button>
        </li>)}
      </ul> : null}
      {!loading && !failed && matches.length > visibleCount ? <button type="button"
        className="x-lumno-action-button x-lumno-action-button--secondary" disabled={disabled}
        onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>{t('shortcut_bookmarks_more', 'Show more')}</button> : null}
    </section> : null}
  </div>;
}
