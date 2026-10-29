import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createViewHost } from '../dom/view-hosts';
import { HexColorPicker } from 'react-colorful';
import { SelectMenu } from '../../shared/react/select-menu';
import { DEFAULT_CLOSE_DELAY_MS, getEnterOffset } from './shortcut-dialog-helpers';
import { DEFAULT_FOLDER_COLOR, MAX_SAVED_FOLDER_COLORS, normalizeSavedFolderColors, parseFolderColor, folderColorToChannels, withFolderColorChannel } from './folder-color';
import { FolderIcon } from './folder-icon';
import { RemixIcon } from '../../shared/react/remix-icon';
import { getPagePortals } from '../app/portals';
import { getCurrentColorControl, getFolderColorBackdrop, getFolderColorDialog, getSavedColorSwatches } from '../dom/folder-color-picker';
import { getFocusableControls, hasDisabledFieldset } from '../dom/dialog-focus';

interface OpenOptions {
  folderId: string;
  title: string;
  color?: string;
  sourceElement?: HTMLElement | null;
  // Other callers (a shortcut icon's plate) bring their own presets, whose
  // first entry is the default that removes the customization, and an image
  // shown on the chosen color instead of the folder.
  presets?: string[];
  previewImageUrl?: string;
  labels?: { dialog?: string; picker?: string; defaultColor?: string };
}
export interface PickerOptions {
  documentObj?: Document;
  t?: (key: string, fallback: string) => string;
  initFolderIcon?: (element: HTMLElement) => void;
  animateFolderIcon?: (element: HTMLElement, active: boolean) => void;
  applyFolderColor?: (element: HTMLElement, color: string) => void;
  bindTooltip?: (target: HTMLElement, getText: () => string, options: { placement: string; maxWidth: number }) => unknown;
  hideTooltip?: () => void;
  readSavedColors?: () => Promise<unknown>;
  saveSavedColors?: (colors: string[]) => Promise<void>;
  onPreview?: (folderId: string, color: string) => void;
  onSubmit?: (folderId: string, color: string | null) => Promise<void>;
  onClose?: () => void;
}

type ColorFormat = 'hex' | 'rgb';
type ColorSource = 'preset' | 'saved' | 'custom';
const CHANNEL_LABELS = ['R', 'G', 'B'];
const FORMAT_OPTIONS = [{ value: 'hex', label: 'HEX' }, { value: 'rgb', label: 'RGB' }];
const ignoreSelectControls = () => {};
// Without a translator the copy falls back to its English text. One shared
// function, so `t` stays the same across renders.
const untranslated = (_key: string, fallback: string) => fallback;

const PRESETS = [DEFAULT_FOLDER_COLOR, '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#14B8A6', '#64748B'];

function FolderColorForm({ initial, options, initialSavedColors, updateSavedColors, close }: {
  initial: OpenOptions; options: PickerOptions; initialSavedColors: string[];
  updateSavedColors: (colors: string[]) => void; close: () => void;
}) {
  const t = options.t || untranslated;
  const presets = initial.presets?.length ? initial.presets : PRESETS;
  const defaultColor = presets[0];
  const previewImageUrl = initial.previewImageUrl || '';
  const [color, setColor] = useState(parseFolderColor(initial.color) || defaultColor);
  const [colorSource, setColorSource] = useState<ColorSource | null>(null);
  const [hexText, setHexText] = useState(color);
  const [rgbTexts, setRgbTexts] = useState(folderColorToChannels(color));
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [formatHost, setFormatHost] = useState<HTMLDivElement | null>(null);
  // Opened without a color of its own, the picker starts on the default, so
  // saving it untouched keeps following the default instead of pinning it.
  const [reset, setReset] = useState(!parseFolderColor(initial.color));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedColors, setSavedColors] = useState(initialSavedColors);
  // Prefer a saved swatch on reopen; explicit edits keep their own source.
  const selectedSource = colorSource ?? (savedColors.includes(color) ? 'saved' : 'preset');
  const [savedColorsReady, setSavedColorsReady] = useState(!options.readSavedColors);
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLSpanElement>(null);
  const defaultSwatchRef = useRef<HTMLButtonElement>(null);
  const addColorRef = useRef<HTMLButtonElement>(null);
  const savedColorsRef = useRef<HTMLDivElement>(null);
  const focusSavedColorRef = useRef<number | null>(null);
  const invalidHex = parseFolderColor(hexText) === null;
  const invalidChannels = rgbTexts.map((channel) => !/^\d{1,3}$/.test(channel) || Number(channel) > 255);
  const invalid = format === 'hex' ? invalidHex : invalidChannels.some(Boolean);
  // Presets are always one click away, so only new colors can be saved.
  const isKnownColor = presets.includes(color) || savedColors.includes(color);
  const invalidMessage = t('folder_color_invalid', 'Enter a valid HEX color or RGB values from 0 to 255.');

  // Rest on the selected swatch, or the saturation area for a custom color, so the dialog opens in a browsing state.
  function focusCurrentColor() {
    (editorRef.current ? getCurrentColorControl(editorRef.current) : null)?.focus();
  }
  useLayoutEffect(focusCurrentColor, []);
  useLayoutEffect(() => {
    for (const target of [defaultSwatchRef.current, addColorRef.current]) {
      if (target) options.bindTooltip?.(target, () => target.getAttribute('data-tooltip') || '', { placement: 'top', maxWidth: 260 });
    }
    if (focusSavedColorRef.current !== null) {
      const target = (savedColorsRef.current ? getSavedColorSwatches(savedColorsRef.current) : [])[focusSavedColorRef.current] || addColorRef.current;
      focusSavedColorRef.current = null;
      if (target && !target.disabled) target.focus();
      else focusCurrentColor();
    }
  }, [options, savedColors]);
  useEffect(() => {
    let active = true;
    const readSavedColors = options.readSavedColors;
    if (readSavedColors) {
      void Promise.resolve().then(() => readSavedColors()).then((value) => {
        if (!active) return;
        const colors = normalizeSavedFolderColors(value);
        setSavedColors(colors);
        updateSavedColors(colors);
        setSavedColorsReady(true);
      }).catch(() => {
        if (active) setError(t('folder_color_saved_load_failed', 'Could not load saved colors. Reopen the color picker to try again.'));
      });
    }
    return () => { active = false; options.hideTooltip?.(); };
  }, [options, t, updateSavedColors]);
  useLayoutEffect(() => {
    if (previewRef.current && !previewImageUrl) {
      options.initFolderIcon?.(previewRef.current);
      options.applyFolderColor?.(previewRef.current, color);
    }
    options.onPreview?.(initial.folderId, color);
  }, [color, initial.folderId, options, previewImageUrl]);

  function selectColor(value: string, source: ColorSource = 'custom', isReset = false) {
    const nextColor = parseFolderColor(value);
    if (!nextColor) return;
    setColor(nextColor);
    setColorSource(source);
    setHexText(nextColor);
    setRgbTexts(folderColorToChannels(nextColor));
    setReset(isReset);
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || invalid) return;
    setBusy(true);
    try {
      await options.onSubmit?.(initial.folderId, reset ? null : color);
      close();
    } catch {
      setError(t('folder_color_save_failed', 'Could not save the folder color. Try again.'));
      setBusy(false);
    }
  }

  function changeFormat(value: string): boolean {
    if (invalid) { setError(invalidMessage); return false; }
    setFormat(value === 'rgb' ? 'rgb' : 'hex');
    setHexText(color);
    setRgbTexts(folderColorToChannels(color));
    setError('');
    return true;
  }

  async function persistSavedColors(next: string[], focusIndex: number, failureMessage: string) {
    setBusy(true);
    setError('');
    options.hideTooltip?.();
    try {
      await options.saveSavedColors?.(next);
      updateSavedColors(next);
      focusSavedColorRef.current = focusIndex;
      setSavedColors(next);
      return true;
    } catch {
      setError(failureMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrentColor() {
    if (busy || invalid || !savedColorsReady || savedColors.length >= MAX_SAVED_FOLDER_COLORS || isKnownColor) return;
    if (await persistSavedColors([...savedColors, color], savedColors.length,
      t('folder_color_saved_save_failed', 'Could not save this color. Try again.'))) {
      setColorSource('saved');
      setReset(false);
    }
  }

  async function removeSavedColor(saved: string) {
    const index = savedColors.indexOf(saved);
    if (busy || !savedColorsReady || index < 0) return;
    const next = savedColors.filter((value) => value !== saved);
    if (await persistSavedColors(next, Math.min(index, next.length - 1),
      t('folder_color_saved_delete_failed', 'Could not delete this color. Try again.')) && selectedSource === 'saved' && color === saved) {
      setColorSource('custom');
    }
  }

  const presetSwatches = <>
    {presets.map((preset) => {
      // The default swatch removes the customization instead of pinning its value.
      const isDefault = preset === defaultColor;
      const label = isDefault ? initial.labels?.defaultColor || t('folder_color_default', 'Default color') : preset;
      return <button key={preset} type="button" className="x-nt-folder-color-swatch" data-color={preset}
        data-default={isDefault && initial.labels?.defaultColor ? 'true' : undefined}
        ref={isDefault ? defaultSwatchRef : undefined} title={isDefault ? label : undefined} data-tooltip={isDefault ? label : undefined}
        style={{ backgroundColor: preset }} aria-label={label} aria-pressed={selectedSource === 'preset' && color === preset}
        onClick={() => selectColor(preset, 'preset', isDefault)}>
        {isDefault && initial.labels?.defaultColor
          ? <RemixIcon name="ri-magic-line" /> : null}
      </button>;
    })}
  </>;
  const savedSwatches = <>
    {savedColors.map((saved) => <span key={saved} className="x-nt-folder-color-saved-item" data-color={saved}>
      <button type="button" className="x-nt-folder-color-swatch"
        style={{ backgroundColor: saved }} aria-label={saved} aria-pressed={selectedSource === 'saved' && color === saved}
        onClick={() => selectColor(saved, 'saved')} />
      <button type="button" className="x-nt-folder-color-remove" disabled={!savedColorsReady}
        aria-label={`${t('folder_color_remove_saved', 'Delete saved color')} ${saved}`}
        onClick={(event) => { event.stopPropagation(); void removeSavedColor(saved); }}>
        <RemixIcon name="ri-close-line" size={12} />
      </button>
    </span>)}
    {savedColors.length < MAX_SAVED_FOLDER_COLORS ? <button type="button" ref={addColorRef}
      className="x-nt-folder-color-swatch x-nt-folder-color-add"
      aria-label={t('folder_color_save_current', 'Save current color')}
      title={t('folder_color_save_current', 'Save current color')}
      data-tooltip={t('folder_color_save_current', 'Save current color')}
      disabled={!savedColorsReady || invalid || isKnownColor} onClick={() => { void saveCurrentColor(); }}>
      <RemixIcon name="ri-add-line" size={16} />
    </button> : null}
  </>;
  const presetsLabel = t('folder_color_presets', 'Preset colors');
  // A caller's short preset row (a shortcut plate's) leaves room, so the
  // saved colors and "+" carry on in it instead of starting a row of their own.
  const mergePalettes = presets.length < PRESETS.length;

  return <div className="x-nt-shortcut-dialog-backdrop x-nt-folder-color-backdrop"
    onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div className="x-nt-shortcut-dialog x-nt-folder-color-dialog" role="dialog" aria-modal="true"
      aria-label={initial.labels?.dialog || t('folder_color_change', 'Change color')}>
      <form className="x-nt-shortcut-form x-nt-folder-color-form" onSubmit={submit}>
        <div className="x-nt-folder-color-layout">
          <figure className="x-nt-folder-color-stage">
            {previewImageUrl ? <span className="x-nt-folder-color-preview x-nt-folder-color-plate-preview" aria-hidden="true"
              style={{ backgroundColor: color }}><img src={previewImageUrl} alt="" draggable={false} /></span>
            : <span className="x-nt-folder-color-preview" ref={previewRef} aria-hidden="true"
              onPointerEnter={() => { if (previewRef.current) options.animateFolderIcon?.(previewRef.current, true); }}
              onPointerLeave={() => { if (previewRef.current) options.animateFolderIcon?.(previewRef.current, false); }}>
              <FolderIcon idSuffix="color-picker-preview" />
            </span>}
            <figcaption className="x-nt-folder-color-name" title={initial.title}>{initial.title}</figcaption>
          </figure>
          <div className="x-nt-folder-color-editor" ref={editorRef}>
            <fieldset className="x-nt-folder-color-controls" disabled={busy}>
              <div inert={busy}>
                <HexColorPicker color={color} onChange={selectColor} aria-label={initial.labels?.picker || t('folder_color_title', 'Folder color')} />
              </div>
              <div className="x-nt-folder-color-palettes">
                {mergePalettes ? <div className="x-nt-folder-color-presets" role="group" ref={savedColorsRef}
                  aria-label={presetsLabel} data-merged="true">
                  {presetSwatches}
                  {savedSwatches}
                </div> : <>
                  <div className="x-nt-folder-color-presets" role="group" aria-label={presetsLabel}>
                    {presetSwatches}
                  </div>
                  <div className="x-nt-folder-color-saved" role="group" ref={savedColorsRef}
                    aria-label={t('folder_color_saved', 'Saved colors')}>
                    {savedSwatches}
                  </div>
                </>}
              </div>
              <div className="x-nt-folder-color-value-row">
                <div ref={setFormatHost} className="_x_extension_select_wrap_2024_unique_ _x_extension_custom_select_2024_unique_ x-nt-folder-color-format">
                  {formatHost ? <SelectMenu config={{
                    id: 'x-nt-folder-color-format',
                    selectId: 'x-nt-folder-color-format-select',
                    ariaLabel: t('folder_color_format', 'Color format'),
                    disabled: busy,
                    options: FORMAT_OPTIONS,
                    value: format,
                    menuPortal: true,
                    menuPortalZIndex: 10070,
                    menuWidth: 'content',
                    menuAlign: 'left',
                    menuMinWidth: 92,
                    menuMaxWidth: 120,
                    menuClassName: 'x-nt-folder-color-format-menu',
                    onValueChange: changeFormat
                  }} documentObj={formatHost.ownerDocument} windowObj={formatHost.ownerDocument.defaultView || window}
                    host={formatHost} registerControls={ignoreSelectControls} /> : null}
                </div>
                {format === 'hex' ? <input className="_x_extension_shortcut_input_2024_unique_ x-nt-folder-color-hex"
                  value={hexText} spellCheck={false} aria-label="HEX"
                  aria-invalid={invalidHex} aria-describedby={invalidHex ? 'x-nt-folder-color-error' : undefined}
                  placeholder="#5393FF" onChange={(event) => {
                    const text = event.currentTarget.value;
                    setHexText(text); setColorSource('custom'); setReset(false); setError('');
                    const parsed = parseFolderColor(text);
                    if (parsed) { setColor(parsed); setRgbTexts(folderColorToChannels(parsed)); }
                  }} onBlur={() => { const parsed = parseFolderColor(hexText); if (parsed) setHexText(parsed); }} />
                : <div className="x-nt-folder-color-rgb">
                  {CHANNEL_LABELS.map((label, index) => <label className="x-nt-folder-color-channel" key={label}
                    data-invalid={invalidChannels[index] ? 'true' : undefined}>
                    <span aria-hidden="true">{label}</span>
                    <input aria-label={label} className="x-nt-folder-color-channel-input" inputMode="numeric" spellCheck={false}
                      value={rgbTexts[index]} aria-invalid={invalidChannels[index]}
                      aria-describedby={invalidChannels[index] ? 'x-nt-folder-color-error' : undefined}
                      onChange={(event) => {
                        const next = withFolderColorChannel(rgbTexts, index, event.currentTarget.value);
                        setRgbTexts(next); setColorSource('custom'); setReset(false); setError('');
                        const parsed = next.every((channel) => /^\d{1,3}$/.test(channel) && Number(channel) <= 255)
                          ? parseFolderColor(next.join(', ')) : null;
                        if (parsed) { setColor(parsed); setHexText(parsed); }
                      }} onBlur={() => {
                        if (!invalidChannels[index]) setRgbTexts((current) => withFolderColorChannel(current, index, String(Number(current[index]))));
                      }} />
                  </label>)}
                </div>}
              </div>
            </fieldset>
          </div>
        </div>
        <div className="x-nt-shortcut-error" id="x-nt-folder-color-error" data-visible={invalid || error ? 'true' : 'false'} role="alert">{error || (invalid ? invalidMessage : '')}</div>
        <div className="x-nt-shortcut-dialog-actions x-nt-folder-color-actions">
          <button type="button" className="x-lumno-action-button x-lumno-action-button--secondary x-nt-shortcut-dialog-button" disabled={busy} onClick={close}>{t('newtab_shortcuts_cancel', 'Cancel')}</button>
          <button type="submit" className="x-lumno-action-button x-lumno-action-button--primary x-nt-shortcut-dialog-button" disabled={busy || invalid}>{t('newtab_shortcuts_save', 'Save')}</button>
        </div>
      </form>
    </div>
  </div>;

}

export function createFolderColorPicker(options: PickerOptions = {}) {
  const doc = options.documentObj || document;
  const host = createViewHost(doc, 'div');
  let initial: OpenOptions | null = null;
  let savedColors: string[] = [];
  const updateSavedColors = (colors: string[]) => { savedColors = colors; };
  let revision = 0;
  let openFrame = 0;
  let closeTimer = 0;
  const view = doc.defaultView || window;
  const getBackdrop = () => getFolderColorBackdrop(host);
  function cancelMotion() {
    if (openFrame) { view.cancelAnimationFrame(openFrame); openFrame = 0; }
    if (closeTimer) { view.clearTimeout(closeTimer); closeTimer = 0; }
  }
  function unmount() {
    cancelMotion();
    host.inert = false;
    getPagePortals().show(host, null);
    host.remove();
  }
  // Drift in from the source tile the same way the shortcut dialog does.
  function setEnterDirection(sourceElement: HTMLElement | null | undefined) {
    const dialog = getFolderColorDialog(host);
    if (!dialog) return;
    let enterX = 0;
    if (sourceElement?.isConnected) {
      const sourceRect = sourceElement.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();
      const targetX = dialogRect.width ? dialogRect.left + dialogRect.width / 2 : view.innerWidth / 2;
      enterX = getEnterOffset(sourceRect.left + sourceRect.width / 2, targetX);
    }
    dialog.style.setProperty('--x-nt-shortcut-dialog-enter-x', `${Math.round(enterX)}px`);
    dialog.style.transformOrigin = `${enterX < -2 ? 'left' : enterX > 2 ? 'right' : 'center'} center`;
  }
  function close() {
    if (!initial) return;
    const source = initial.sourceElement;
    initial = null;
    cancelMotion();
    // Keep the form mounted while it fades out, but out of reach of focus and pointer input.
    host.inert = true;
    getBackdrop()?.setAttribute('data-open', 'false');
    closeTimer = view.setTimeout(unmount, DEFAULT_CLOSE_DELAY_MS);
    doc.body.removeAttribute('data-folder-color-open');
    options.onClose?.();
    if (source?.isConnected) source.focus({ preventScroll: true });
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!initial) return;
    // Keep modal keys from reaching new-tab search and shortcut navigation.
    event.stopImmediatePropagation();
    if (event.defaultPrevented) return;
    const controls = getFocusableControls(host);
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!hasDisabledFieldset(host)) close();
    } else if (event.key === 'Tab' && controls.length) {
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  // Capture only after the event reaches this host so React's form keys still work.
  host.addEventListener('keydown', onKeyDown);
  return {
    open(next: OpenOptions) {
      close(); cancelMotion(); initial = next; revision += 1;
      host.inert = false;
      doc.body.append(host);
      doc.body.setAttribute('data-folder-color-open', 'true');
      getPagePortals().show(host, (
        <FolderColorForm key={revision} initial={next} options={options}
          initialSavedColors={savedColors} updateSavedColors={updateSavedColors} close={close} />
      ));
      const backdrop = getBackdrop();
      if (!backdrop) return;
      backdrop.setAttribute('data-open', 'false');
      setEnterDirection(next.sourceElement);
      // Commit the closed styles first so the next frame transitions into the open state.
      void backdrop.offsetWidth;
      openFrame = view.requestAnimationFrame(() => {
        openFrame = 0;
        if (initial === next) backdrop.setAttribute('data-open', 'true');
      });
    },
    close,
    isOpen: () => Boolean(initial),
    destroy() { close(); unmount(); getPagePortals().remove(host); host.removeEventListener('keydown', onKeyDown); }
  };
}
