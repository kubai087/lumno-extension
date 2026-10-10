import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { SelectMenu } from './select-menu';
import {
  DEFAULT_CLOSE_DELAY_MS,
  DEFAULT_ID_PREFIX,
  MODE_ADD,
  MODE_EDIT,
  clampEnterOffset,
  getEnterOffset,
  normalizeMode,
  type ShortcutDialogMode,
  type ShortcutRecord
} from './shortcut-dialog-helpers';

type Translate = (key: string, fallback: string) => string;
type IconAction = 'keep' | 'replace' | 'remove';
export type OnlineIconSource = 'service' | 'favicon-is' | 'cache';
type IconMode = OnlineIconSource | 'custom' | 'builtin';
const ICON_MODES: IconMode[] = ['builtin', 'service', 'favicon-is', 'cache', 'custom'];
const ICON_REFRESH_SUCCESS_MS = 2000;
export type ShortcutDialogItemType = 'shortcut' | 'bookmark' | 'folder';

function isOnlineIconSource(value: unknown): value is OnlineIconSource {
  return value === 'service' || value === 'favicon-is' || value === 'cache';
}

export interface OnlineShortcutIcon {
  dataUrl: string;
  pageUrl: string;
  sourceUrl?: string;
}

export interface ShortcutDialogPayload {
  title: string;
  url: string;
  mode: ShortcutDialogMode;
  itemType: ShortcutDialogItemType;
  itemId: string;
  shortcutId: string;
  iconAction: IconAction;
  iconDataUrl: string;
  iconSource?: IconMode;
  onlineIcon?: OnlineShortcutIcon;
}

export interface ShortcutDialogOpenOptions {
  confirmLabel?: string;
  confirmationDescription?: string;
  confirmationTitle?: string;
  mode?: string;
  onConfirm?: () => boolean | Promise<boolean>;
  itemType?: string;
  // Bookmarks inside shortcut folders can also choose an icon. The preview
  // shows the icon they use now.
  iconEditable?: boolean;
  iconPreviewUrl?: string;
  shortcut?: ShortcutRecord | null;
  sourceElement?: HTMLElement | null;
}

export interface ShortcutDialogCloseOptions {
  force?: boolean;
  restoreFocus?: boolean;
}

export interface ShortcutDialogState {
  mode: ShortcutDialogMode;
  itemType: ShortcutDialogItemType;
  editingId: string;
  open: boolean;
  busy: boolean;
}

interface PreparedIcon {
  dataUrl?: string;
}

export interface ShortcutDialogOptions {
  documentObj?: Document;
  windowObj?: Window;
  t?: Translate;
  onSubmit?: (payload: Readonly<ShortcutDialogPayload>) => boolean | Promise<boolean>;
  prepareIconFile?: (file: File) => PreparedIcon | Promise<PreparedIcon>;
  getOnlineIconUrl?: (url: string) => string;
  getOnlineIconSource?: (url: string) => OnlineIconSource | 'builtin';
  getBuiltinIconUrl?: (url: string) => string;
  isIconSourceAvailable?: (source: OnlineIconSource, url: string) => boolean;
  refreshOnlineIcon?: (url: string, source?: OnlineIconSource) => Promise<OnlineShortcutIcon | null>;
  getRiSvg?: (id: string, sizeClass?: string) => string;
  bindTooltip?: (
    target: HTMLElement,
    getText: () => string,
    options: { placement: string; maxWidth: number }
  ) => unknown;
  hideTooltip?: () => void;
  closeDelayMs?: number;
  idPrefix?: string;
}

export interface ShortcutDialogController {
  readonly element: HTMLDivElement;
  open(options?: ShortcutDialogOpenOptions): boolean;
  close(options?: ShortcutDialogCloseOptions): boolean;
  mount(parentNode: Node, beforeNode?: Node | null): HTMLDivElement;
  submit(): Promise<boolean>;
  setError(message: unknown): void;
  setIconError(message: unknown): void;
  updateLanguage(): void;
  getState(): Readonly<ShortcutDialogState>;
  destroy(): void;
}

interface FormState {
  mode: ShortcutDialogMode;
  itemType: ShortcutDialogItemType;
  editingId: string;
  name: string;
  url: string;
  busy: boolean;
  iconBusy: boolean;
  iconRefreshSuccess: boolean;
  sourceNeedsIcon: boolean;
  iconEditable: boolean;
  iconMode: IconMode;
  iconAction: IconAction;
  iconDataUrl: string;
  onlineIconUrl: string;
  onlineIcon: OnlineShortcutIcon | null;
  error: string;
  iconError: string;
  confirmation: ShortcutDialogOpenOptions | null;
}

interface NormalizedOptions {
  documentObj: Document;
  windowObj: Window;
  t: Translate;
  onSubmit: (payload: Readonly<ShortcutDialogPayload>) => boolean | Promise<boolean>;
  prepareIconFile: (file: File) => PreparedIcon | Promise<PreparedIcon>;
  getOnlineIconUrl: NonNullable<ShortcutDialogOptions['getOnlineIconUrl']>;
  getOnlineIconSource: NonNullable<ShortcutDialogOptions['getOnlineIconSource']>;
  getBuiltinIconUrl: NonNullable<ShortcutDialogOptions['getBuiltinIconUrl']>;
  isIconSourceAvailable: NonNullable<ShortcutDialogOptions['isIconSourceAvailable']>;
  refreshOnlineIcon: NonNullable<ShortcutDialogOptions['refreshOnlineIcon']>;
  getRiSvg: (id: string, sizeClass?: string) => string;
  bindTooltip: NonNullable<ShortcutDialogOptions['bindTooltip']>;
  hideTooltip: () => void;
  closeDelayMs: number;
  idPrefix: string;
}

interface ShortcutDialogViewHandle {
  submit(): Promise<boolean>;
  setError(message: unknown): void;
  setIconError(message: unknown): void;
  updateLanguage(): void;
  cancelPendingIcon(): void;
  focusName(): void;
  getDialogElement(): HTMLDivElement | null;
  getFocusableElements(): HTMLElement[];
  getSnapshot(): Pick<FormState, 'mode' | 'itemType' | 'editingId' | 'busy'>;
}

interface InertSnapshot {
  element: HTMLElement;
  hadInert: boolean;
}

interface ShortcutDialogViewProps {
  options: NormalizedOptions;
  openOptions?: ShortcutDialogOpenOptions;
  onRequestClose: () => void;
}

const INITIAL_FORM_STATE: FormState = {
  mode: MODE_ADD,
  itemType: 'shortcut',
  editingId: '',
  name: '',
  url: '',
  busy: false,
  iconBusy: false,
  iconRefreshSuccess: false,
  sourceNeedsIcon: false,
  iconEditable: true,
  iconMode: 'cache',
  iconAction: 'keep',
  iconDataUrl: '',
  onlineIconUrl: '',
  onlineIcon: null,
  error: '',
  iconError: '',
  confirmation: null
};

function normalizeItemType(value: unknown): ShortcutDialogItemType {
  return value === 'bookmark' || value === 'folder' ? value : 'shortcut';
}

function createInitialFormState(
  options: NormalizedOptions,
  openOptions: ShortcutDialogOpenOptions = {}
): FormState {
  const mode = normalizeMode(openOptions.mode, openOptions.shortcut);
  const shortcut = mode === MODE_EDIT ? openOptions.shortcut : null;
  const itemType = normalizeItemType(openOptions.itemType);
  const iconEditable = itemType === 'shortcut' || (itemType === 'bookmark' && openOptions.iconEditable === true);
  const customIcon = iconEditable ? String(shortcut?.iconDataUrl || '') : '';
  const url = itemType !== 'folder' ? String(shortcut?.url || '') : '';
  let iconMode: IconMode = 'cache';
  if (shortcut && iconEditable) {
    iconMode = customIcon ? 'custom'
      : isOnlineIconSource(shortcut.iconSource) || shortcut.iconSource === 'builtin'
        ? shortcut.iconSource : options.getOnlineIconSource(url);
    if (iconMode === 'builtin' && !options.getBuiltinIconUrl(url)) iconMode = 'cache';
  }
  return {
    ...INITIAL_FORM_STATE,
    mode,
    itemType,
    editingId: String(shortcut?.id || ''),
    name: String(shortcut?.title || ''),
    url,
    iconEditable,
    iconMode,
    iconDataUrl: customIcon,
    onlineIconUrl: iconEditable && url
      ? iconMode === 'builtin' ? options.getBuiltinIconUrl(url)
        : String(openOptions.iconPreviewUrl || '') || options.getOnlineIconUrl(url) : '',
    confirmation: typeof openOptions.onConfirm === 'function' ? openOptions : null
  };
}

function focusElement(element: Element | null | undefined): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function normalizeError(message: unknown): string {
  return String(message || '').trim();
}

function getIconErrorMessage(errorValue: unknown, t: Translate): string {
  const code = String(
    errorValue && typeof errorValue === 'object' && 'code' in errorValue
      ? (errorValue as { code?: unknown }).code || ''
      : ''
  );
  if (code === 'unsupported-type' || code === 'empty-file') {
    return t(
      'newtab_shortcuts_icon_unsupported',
      'Choose a PNG, JPG, or WebP image.'
    );
  }
  if (code === 'dimensions-too-large') {
    return t(
      'newtab_shortcuts_icon_dimensions_too_large',
      'The image must be no larger than 4096 × 4096 px.'
    );
  }
  return t(
    'newtab_shortcuts_icon_invalid',
    'This image could not be used. Choose another image.'
  );
}

const ShortcutDialogView = forwardRef<ShortcutDialogViewHandle, ShortcutDialogViewProps>(
  function ShortcutDialogView({ options, openOptions, onRequestClose }, forwardedRef) {
    const [formState, setFormState] = useState<FormState>(() => createInitialFormState(options, openOptions));
    const [, setLanguageRevision] = useState(0);
    const stateRef = useRef<FormState>(formState);
    const iconRequestIdRef = useRef(0);
    const destroyedRef = useRef(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);
    const urlInfoButtonRef = useRef<HTMLButtonElement>(null);
    const urlInfoDescriptionRef = useRef<HTMLSpanElement>(null);
    const iconInfoButtonRef = useRef<HTMLButtonElement>(null);
    const [iconSelectHost, setIconSelectHost] = useState<HTMLDivElement | null>(null);
    const iconSelectControlsRef = useRef<{ setOpen(open: boolean): void } | null>(null);
    const originalIconRef = useRef({ source: formState.iconMode, url: formState.url, iconUrl: formState.onlineIconUrl });
    const iconSuccessTimerRef = useRef<number | null>(null);
    const iconRefreshButtonRef = useRef<HTMLButtonElement>(null);
    const iconRefreshGlyphRef = useRef<HTMLSpanElement>(null);
    const iconRefreshLabelRef = useRef<HTMLSpanElement>(null);
    const [iconRefreshWidth, setIconRefreshWidth] = useState<number>();
    const iconUploadTileRef = useRef<HTMLDivElement>(null);
    const iconRemoveButtonRef = useRef<HTMLButtonElement>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const doneButtonRef = useRef<HTMLButtonElement>(null);
    const iconInfoDescriptionRef = useRef<HTMLSpanElement>(null);

    function commitState(
      update: FormState | ((current: FormState) => FormState)
    ): void {
      const nextState = typeof update === 'function'
        ? update(stateRef.current)
        : update;
      stateRef.current = nextState;
      setFormState(nextState);
    }

    function setBusy(nextBusy: boolean): void {
      commitState((current) => ({
        ...current,
        busy: nextBusy
      }));
    }

    function setIconBusy(nextBusy: boolean): void {
      commitState((current) => ({
        ...current,
        iconBusy: nextBusy
      }));
    }

    function clearIconSuccessTimer(): void {
      if (iconSuccessTimerRef.current !== null) {
        options.windowObj.clearTimeout(iconSuccessTimerRef.current);
        iconSuccessTimerRef.current = null;
      }
    }

    function cancelPendingIcon(): void {
      iconRequestIdRef.current += 1;
      clearIconSuccessTimer();
      iconSelectControlsRef.current?.setOpen(false);
      commitState((current) => ({ ...current, iconBusy: false, iconRefreshSuccess: false }));
    }

    async function submit(): Promise<boolean> {
      const current = stateRef.current;
      if (current.busy || current.iconBusy || destroyedRef.current) {
        return false;
      }
      if (current.iconEditable && !current.confirmation &&
          current.iconMode !== 'custom' && current.sourceNeedsIcon) return false;
      if (current.iconEditable && !current.confirmation &&
          current.iconMode === 'custom' && !current.iconDataUrl) {
        commitState({
          ...current,
          iconError: options.t('newtab_shortcuts_icon_custom_required', 'Choose an image for the custom icon.')
        });
        focusElement(iconUploadTileRef.current);
        return false;
      }
      const iconAction = current.iconMode !== 'custom' && current.iconDataUrl
        ? 'remove'
        : current.iconAction;
      commitState({
        ...current,
        busy: true,
        error: ''
      });
      const payload = Object.freeze<ShortcutDialogPayload>({
        title: current.name,
        url: current.itemType === 'folder' ? '' : current.url,
        mode: current.mode,
        itemType: current.itemType,
        itemId: current.editingId,
        shortcutId: current.editingId,
        iconAction: current.iconEditable ? iconAction : 'keep',
        iconDataUrl:
          current.iconEditable && current.iconMode === 'custom' && iconAction === 'replace'
            ? current.iconDataUrl
            : '',
        ...(current.iconEditable ? { iconSource: current.iconMode } : {}),
        ...(current.iconEditable && current.iconMode !== 'custom' && current.iconMode !== 'builtin' && current.onlineIcon
          ? { onlineIcon: Object.freeze({ ...current.onlineIcon }) }
          : {})
      });
      try {
        const saved = current.confirmation
          ? Boolean(await current.confirmation.onConfirm?.())
          : Boolean(await options.onSubmit(payload));
        if (saved) {
          onRequestClose();
        }
        return saved;
      } catch {
        return false;
      } finally {
        if (!destroyedRef.current) {
          setBusy(false);
        }
      }
    }

    useImperativeHandle(forwardedRef, () => ({
      submit,
      setError(message) {
        const error = normalizeError(message);
        commitState((current) => ({
          ...current,
          error
        }));
      },
      setIconError(message) {
        const iconError = normalizeError(message);
        commitState((current) => ({
          ...current,
          iconError
        }));
      },
      updateLanguage() {
        setLanguageRevision((revision) => revision + 1);
      },
      cancelPendingIcon,
      focusName() {
        if (stateRef.current.confirmation) {
          focusElement(cancelButtonRef.current || dialogRef.current);
          return;
        }
        const nameInput = nameInputRef.current;
        if (nameInput && !nameInput.disabled) {
          focusElement(nameInput);
          return;
        }
        focusElement(dialogRef.current);
      },
      getDialogElement() {
        return dialogRef.current;
      },
      getFocusableElements() {
        const elements: Array<HTMLElement | null> = [
          nameInputRef.current,
          urlInfoButtonRef.current,
          urlInputRef.current,
          iconSelectHost?.querySelector<HTMLButtonElement>('button') || null,
          iconInfoButtonRef.current,
          iconRefreshButtonRef.current,
          iconUploadTileRef.current,
          iconRemoveButtonRef.current,
          cancelButtonRef.current,
          doneButtonRef.current
        ];
        return elements.filter(
          (element): element is HTMLElement => element instanceof HTMLElement
        );
      },
      getSnapshot() {
        const current = stateRef.current;
        return {
          mode: current.mode,
          itemType: current.itemType,
          editingId: current.editingId,
          busy: current.busy
        };
      }
    }));

    useLayoutEffect(() => {
      const urlInfoButton = urlInfoButtonRef.current;
      if (urlInfoButton) {
        options.bindTooltip(
          urlInfoButton,
          () => urlInfoDescriptionRef.current?.textContent || '',
          {
            placement: 'top',
            maxWidth: 320
          }
        );
      }
    }, [options, formState.itemType, Boolean(formState.confirmation)]);

    useLayoutEffect(() => {
      const iconInfoButton = iconInfoButtonRef.current;
      const iconUploadTile = iconUploadTileRef.current;
      if (iconInfoButton) {
        options.bindTooltip(
          iconInfoButton,
          () => iconInfoDescriptionRef.current?.textContent || '',
          {
            placement: 'top',
            maxWidth: 320
          }
        );
      }
      if (iconUploadTile) {
        options.bindTooltip(
          iconUploadTile,
          () => iconUploadTile.getAttribute('data-tooltip') || '',
          {
            placement: 'top',
            maxWidth: 260
          }
        );
      }
    }, [options, formState.iconMode, formState.itemType, Boolean(formState.confirmation)]);

    useLayoutEffect(() => () => {
      destroyedRef.current = true;
      iconRequestIdRef.current += 1;
      clearIconSuccessTimer();
    }, []);

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
      event.preventDefault();
      void submit();
    }

    function selectIconMode(mode: IconMode): void {
      const current = stateRef.current;
      if (current.busy || current.iconBusy || current.iconMode === mode ||
          (mode === 'builtin' && !options.getBuiltinIconUrl(current.url)) ||
          (isOnlineIconSource(mode) && !options.isIconSourceAvailable(mode, current.url))) return;
      options.hideTooltip();
      clearIconSuccessTimer();
      const original = originalIconRef.current;
      const restoreOriginal = mode === original.source && current.url === original.url;
      commitState({ ...current, iconMode: mode, iconError: '', iconRefreshSuccess: false,
        onlineIcon: null, sourceNeedsIcon: isOnlineIconSource(mode) && !restoreOriginal,
        onlineIconUrl: mode === 'builtin' ? options.getBuiltinIconUrl(current.url)
          : restoreOriginal ? original.iconUrl : current.onlineIconUrl });
      if (isOnlineIconSource(mode) && !restoreOriginal && current.url.trim()) void handleIconRefresh();
    }

    async function handleIconRefresh(): Promise<void> {
      const current = stateRef.current;
      if (current.busy || current.iconBusy || !isOnlineIconSource(current.iconMode) || !current.url.trim() ||
          !options.isIconSourceAvailable(current.iconMode, current.url)) return;
      const requestId = ++iconRequestIdRef.current;
      clearIconSuccessTimer();
      commitState({ ...current, iconBusy: true, iconRefreshSuccess: false, iconError: '' });
      try {
        const result = await options.refreshOnlineIcon(current.url, current.iconMode);
        if (destroyedRef.current || requestId !== iconRequestIdRef.current) return;
        if (!result?.dataUrl) throw new Error('Online icon unavailable.');
        commitState((state) => ({ ...state, onlineIconUrl: result.dataUrl, onlineIcon: result,
          sourceNeedsIcon: false, iconRefreshSuccess: true }));
        iconSuccessTimerRef.current = options.windowObj.setTimeout(() => {
          iconSuccessTimerRef.current = null;
          if (!destroyedRef.current && requestId === iconRequestIdRef.current) {
            commitState((state) => ({ ...state, iconRefreshSuccess: false }));
          }
        }, ICON_REFRESH_SUCCESS_MS);
      } catch {
        if (!destroyedRef.current && requestId === iconRequestIdRef.current) {
          commitState((state) => ({
            ...state,
            iconError: current.iconMode === 'cache'
              ? options.t('newtab_shortcuts_icon_cache_failed', 'No cached icon found. Visit this website, then refresh again.')
              : options.t('newtab_shortcuts_icon_refresh_failed', 'Could not refresh the icon. Try again later.')
          }));
        }
      } finally {
        if (!destroyedRef.current && requestId === iconRequestIdRef.current) setIconBusy(false);
      }
    }

    function handleIconChoose(): void {
      const current = stateRef.current;
      if (current.busy || current.iconBusy) {
        return;
      }
      commitState({
        ...current,
        iconError: ''
      });
      iconInputRef.current?.click();
    }

    function handleIconChooseKeydown(event: ReactKeyboardEvent<HTMLDivElement>): void {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      handleIconChoose();
    }

    function handleIconRemove(event: ReactMouseEvent<HTMLButtonElement>): void {
      event.preventDefault();
      event.stopPropagation();
      commitState((current) => ({
        ...current,
        iconAction: 'remove',
        iconMode: options.getBuiltinIconUrl(current.url) ? 'builtin' : 'cache',
        sourceNeedsIcon: false,
        iconRefreshSuccess: false,
        onlineIcon: null,
        onlineIconUrl: options.getBuiltinIconUrl(current.url) || options.getOnlineIconUrl(current.url),
        iconDataUrl: '',
        iconError: ''
      }));
      clearIconSuccessTimer();
      focusElement(iconSelectHost?.querySelector('button'));
    }

    async function handleIconChange(): Promise<void> {
      const input = iconInputRef.current;
      const file = input?.files?.[0];
      if (input) {
        input.value = '';
      }
      if (!file) {
        return;
      }
      commitState((current) => ({
        ...current,
        iconBusy: true,
        iconError: ''
      }));
      const requestId = iconRequestIdRef.current + 1;
      iconRequestIdRef.current = requestId;
      try {
        const result = await options.prepareIconFile(file);
        if (destroyedRef.current || requestId !== iconRequestIdRef.current) {
          return;
        }
        const dataUrl = String(result?.dataUrl || '');
        if (!dataUrl) {
          throw new Error('Shortcut icon result is empty.');
        }
        commitState((current) => ({
          ...current,
          iconMode: 'custom',
          iconAction: 'replace',
          iconDataUrl: dataUrl
        }));
      } catch (errorValue) {
        if (!destroyedRef.current && requestId === iconRequestIdRef.current) {
          commitState((current) => ({
            ...current,
            iconError: getIconErrorMessage(errorValue, options.t)
          }));
        }
      } finally {
        if (!destroyedRef.current && requestId === iconRequestIdRef.current) {
          setIconBusy(false);
        }
      }
    }

    const isEditMode = formState.mode === MODE_EDIT;
    const confirmation = formState.confirmation;
    const isConfirmVariant = Boolean(confirmation);
    const isShortcutItem = formState.itemType === 'shortcut';
    const isBookmarkItem = formState.itemType === 'bookmark';
    const isFolderItem = formState.itemType === 'folder';
    const hasIcon = Boolean(formState.iconDataUrl);
    const isOnlineIcon = formState.iconMode !== 'custom';
    const isBuiltinIcon = formState.iconMode === 'builtin';
    const showIconInfo = isBuiltinIcon || !isOnlineIcon;
    const sourceUnavailable = !isBuiltinIcon && isOnlineIcon && !options.isIconSourceAvailable(formState.iconMode as OnlineIconSource, formState.url);
    const builtinIconUrl = options.getBuiltinIconUrl(formState.url);
    const isMonochromeBuiltinIcon = isBuiltinIcon && /\/glyph-(?:gh|gpt|mdn|wk|zw)\.svg(?:[?#]|$)/.test(builtinIconUrl);
    const iconSourceLabel = options.t('newtab_shortcuts_icon_mode_label', 'Icon source');
    const iconSourceLabels = {
      builtin: options.t('newtab_shortcuts_icon_builtin', 'Built-in icon'),
      service: options.t('newtab_shortcuts_icon_service', 'Gstatic (third-party icons)'),
      'favicon-is': options.t('newtab_shortcuts_icon_favicon_is', 'Favicon.is (third-party icons)'),
      cache: options.t('newtab_shortcuts_icon_cache', 'Browser cache'),
      custom: options.t('newtab_shortcuts_icon_custom', 'Custom icon')
    };
    const disabled = formState.busy || formState.iconBusy;
    const iconSourceHint = isBuiltinIcon
      ? options.t('newtab_shortcuts_icon_builtin_hint', 'Use Lumno’s built-in high-quality icons.')
      : formState.iconMode === 'custom'
      ? options.t('newtab_shortcuts_icon_custom_hint', 'Saved on this device by default, outside browser sync.')
      : sourceUnavailable
      ? options.t('newtab_shortcuts_icon_source_unavailable', 'This source is unavailable. Choose browser cache or a custom icon.')
      : formState.iconMode === 'service'
      ? options.t('newtab_shortcuts_icon_service_hint', 'Send the site domain to Gstatic. Stable, high quality.')
      : formState.iconMode === 'favicon-is'
      ? options.t('newtab_shortcuts_icon_favicon_is_hint', 'Send the domain to Favicon.is for a larger icon.')
      : options.t('newtab_shortcuts_icon_cache_hint', 'Fast, accurate website icons from the browser cache.');
    const iconSourceDetail = isBuiltinIcon
      ? options.t('newtab_shortcuts_icon_builtin_network_hint', 'No network request needed.')
      : formState.iconMode === 'custom'
      ? isShortcutItem ? options.t('newtab_shortcuts_icon_custom_sync_hint', 'Sync across devices with WebDAV.') : ''
      : sourceUnavailable ? ''
      : formState.iconMode === 'service'
      ? options.t('newtab_shortcuts_icon_service_caution', 'Some websites may not be recognized.')
      : formState.iconMode === 'favicon-is'
      ? options.t('newtab_shortcuts_icon_favicon_is_caution', 'Domain icons may differ from the current page’s icon.')
      : options.t('newtab_shortcuts_icon_cache_caution', 'Site settings may add notification dots or reduce clarity.');
    const chooseText = hasIcon
      ? options.t('newtab_shortcuts_icon_replace', 'Replace image')
      : options.t('newtab_shortcuts_icon_choose', 'Choose image');
    const titleId = `${options.idPrefix}_title`;
    const urlInputId = `${options.idPrefix}_url`;
    const urlInfoId = `${options.idPrefix}_url_info`;
    const iconInfoId = `${options.idPrefix}_icon_info`;
    const iconErrorId = `${options.idPrefix}_icon_error`;
    const iconPanelId = `${options.idPrefix}_icon_panel`;
    const errorId = `${options.idPrefix}_error`;
    const refreshLabel = formState.iconRefreshSuccess
      ? options.t('newtab_shortcuts_icon_refresh_success', 'Icon acquired')
      : options.t('newtab_shortcuts_icon_refresh', 'Refresh');

    useLayoutEffect(() => {
      const button = iconRefreshButtonRef.current;
      const glyph = iconRefreshGlyphRef.current;
      const label = iconRefreshLabelRef.current;
      if (!button || !glyph || !label) return;
      const measure = () => {
        if (!glyph.offsetWidth || !label.offsetWidth) return;
        const style = options.windowObj.getComputedStyle(button);
        const spacing = [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth, style.columnGap]
          .reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
        setIconRefreshWidth(Math.ceil(glyph.offsetWidth + label.offsetWidth + spacing));
      };
      measure();
      const ResizeObserverCtor = (options.windowObj as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      const observer = ResizeObserverCtor ? new ResizeObserverCtor(measure) : null;
      observer?.observe(glyph);
      observer?.observe(label);
      return () => observer?.disconnect();
    }, [options.windowObj, refreshLabel, formState.iconEditable, isOnlineIcon, isBuiltinIcon, isConfirmVariant]);

    return (
      <div
        ref={dialogRef}
        className="x-nt-shortcut-dialog"
        tabIndex={-1}
      >
        <form
          className="x-nt-shortcut-form"
          data-item-type={formState.itemType}
          aria-busy={disabled ? 'true' : 'false'}
          onSubmit={handleSubmit}
        >
          <h2 id={titleId} className="x-nt-shortcut-dialog-title">
            {isConfirmVariant
              ? confirmation?.confirmationTitle
              : isFolderItem
              ? options.t('bookmarks_edit_folder_dialog_title', 'Rename folder')
              : isBookmarkItem
                ? options.t('bookmarks_edit_dialog_title', 'Edit bookmark')
                : isEditMode
                  ? options.t('newtab_shortcuts_edit_dialog_title', 'Edit shortcut')
                  : options.t('newtab_shortcuts_dialog_title', 'Add shortcut')}
          </h2>

          {isConfirmVariant ? (
            <p
              id={errorId}
              className="x-nt-shortcut-dialog-description"
            >
              {confirmation?.confirmationDescription}
            </p>
          ) : null}

          {!isConfirmVariant ? (
          <label className="x-nt-shortcut-field">
            <span>{options.t('newtab_shortcuts_name_label', 'Name')}</span>
            <div
              className="_x_extension_shortcut_input_affix_2026_unique_"
              data-has-prefix="false"
            >
              <input
                ref={nameInputRef}
                type="text"
                autoComplete="off"
                maxLength={isShortcutItem ? 64 : 255}
                className="_x_extension_shortcut_input_2024_unique_"
                placeholder={
                  isShortcutItem
                    ? options.t('newtab_shortcuts_name_placeholder', 'Lumno')
                    : options.t('bookmarks_name_placeholder', 'Name')
                }
                value={formState.name}
                disabled={formState.busy}
                onChange={(event) => {
                  const name = event.currentTarget.value;
                  commitState((current) => ({ ...current, name }));
                }}
              />
            </div>
          </label>
          ) : null}

          {!isConfirmVariant && !isFolderItem ? (
            <div className="x-nt-shortcut-field">
              <div className="x-nt-shortcut-url-label-row">
                <label htmlFor={urlInputId}>
                  {options.t('newtab_shortcuts_url_label', 'URL')}
                </label>
                <button
                  ref={urlInfoButtonRef}
                  type="button"
                  className="_x_extension_info_button_2026_unique_ x-nt-shortcut-url-info"
                  disabled={formState.busy}
                  aria-label={options.t(
                    'newtab_shortcuts_url_info_label',
                    'About supported URLs'
                  )}
                  aria-describedby={urlInfoId}
                  dangerouslySetInnerHTML={{
                    __html: options.getRiSvg('ri-information-line', 'ri-size-14')
                  }}
                />
              </div>
              <div
                className="_x_extension_shortcut_input_affix_2026_unique_"
                data-has-prefix="false"
              >
                <input
                  ref={urlInputRef}
                  id={urlInputId}
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  required
                  className="_x_extension_shortcut_input_2024_unique_"
                  placeholder={options.t(
                    'newtab_shortcuts_url_placeholder',
                    'https://example.com'
                  )}
                  value={formState.url}
                  disabled={formState.busy}
                  aria-describedby={`${urlInfoId} ${errorId}`}
                  aria-invalid={formState.error ? 'true' : 'false'}
                  onChange={(event) => {
                    const url = event.currentTarget.value;
                    cancelPendingIcon();
                    commitState((current) => {
                      const builtinUrl = options.getBuiltinIconUrl(url);
                      const iconMode = current.iconMode === 'builtin' && !builtinUrl ? 'cache' : current.iconMode;
                      return { ...current, url, iconMode, onlineIcon: null, sourceNeedsIcon: false,
                        onlineIconUrl: iconMode === 'builtin' ? builtinUrl : options.getOnlineIconUrl(url), iconError: '' };
                    });
                  }}
                />
              </div>
              <span
                ref={urlInfoDescriptionRef}
                id={urlInfoId}
                className="x-nt-shortcut-visually-hidden"
              >
                {options.t(
                  'newtab_shortcuts_url_info',
                  'Browser internal pages are also supported, for example:\nchrome://inspect/#devices'
                )}
              </span>
            </div>
          ) : null}

          {!isConfirmVariant && formState.iconEditable ? (
            <div className="x-nt-shortcut-field x-nt-shortcut-icon-field">
              <span>{iconSourceLabel}</span>
              <div
                ref={setIconSelectHost}
                className="_x_extension_select_wrap_2024_unique_ _x_extension_custom_select_2024_unique_ x-nt-shortcut-icon-source-select"
              >
                {iconSelectHost ? <SelectMenu
                  config={{
                    id: `${options.idPrefix}_icon_source`,
                    ariaLabel: iconSourceLabel,
                    disabled,
                    value: formState.iconMode,
                    options: ICON_MODES.filter((mode) => mode !== 'builtin' || builtinIconUrl).map((mode) => ({
                      value: mode, label: iconSourceLabels[mode],
                      disabled: disabled || (isOnlineIconSource(mode) && !options.isIconSourceAvailable(mode, formState.url))
                    })),
                    menuAlign: 'left',
                    menuClassName: 'x-nt-shortcut-icon-source-menu',
                    menuWidth: 'trigger',
                    menuMaxWidth: 'calc(100vw - 48px)',
                    menuPortal: true,
                    menuPortalContainer: dialogRef.current?.parentElement || undefined,
                    menuPortalZIndex: 10060,
                    onValueChange: (value) => {
                      if (!ICON_MODES.includes(value as IconMode) || stateRef.current.busy || stateRef.current.iconBusy) return false;
                      selectIconMode(value as IconMode);
                    }
                  }}
                  documentObj={options.documentObj}
                  windowObj={options.windowObj}
                  host={iconSelectHost}
                  onBeforeOpen={options.hideTooltip}
                  registerControls={(controls) => { iconSelectControlsRef.current = controls; }}
                /> : null}
              </div>
              <div className="x-nt-shortcut-icon-source-hint">
                <p>{iconSourceHint}</p>
                {iconSourceDetail ? <p>{iconSourceDetail}</p> : null}
              </div>
              <div
                id={iconPanelId}
                className="x-nt-shortcut-icon-panel"
                role="group"
                aria-label={iconSourceLabels[formState.iconMode]}
              >
              <div className="x-nt-shortcut-icon-label-row">
                <span>
                  {isOnlineIcon
                    ? options.t('newtab_shortcuts_icon_current', 'Current icon')
                    : options.t('newtab_shortcuts_icon_custom', 'Custom icon')}
                </span>
                {showIconInfo ? <button
                  ref={iconInfoButtonRef}
                  type="button"
                  className="_x_extension_info_button_2026_unique_ x-nt-shortcut-icon-info"
                  disabled={formState.busy}
                  aria-label={options.t(
                    isBuiltinIcon ? 'newtab_shortcuts_icon_builtin_info_label' : 'newtab_shortcuts_icon_info_label',
                    isBuiltinIcon ? 'About built-in icons' : 'About local shortcut icons'
                  )}
                  aria-describedby={iconInfoId}
                  dangerouslySetInnerHTML={{
                    __html: options.getRiSvg('ri-information-line', 'ri-size-14')
                  }}
                /> : null}
              </div>

              {isOnlineIcon ? (
                <div className="x-nt-shortcut-icon-control x-nt-shortcut-online-icon-control">
                  <span className="x-nt-shortcut-online-icon-preview" data-icon-source={formState.iconMode} data-builtin-monochrome={isMonochromeBuiltinIcon ? 'true' : undefined} aria-busy={formState.iconBusy}>
                    {formState.onlineIconUrl ? (
                      <img
                        className="x-nt-shortcut-icon-preview-image"
                        src={formState.onlineIconUrl}
                        alt=""
                        draggable={false}
                      />
                    ) : (
                      <span aria-hidden="true" dangerouslySetInnerHTML={{
                        __html: options.getRiSvg('ri-link', 'ri-size-24')
                      }} />
                    )}
                  </span>
                  {!isBuiltinIcon ? <button
                    ref={iconRefreshButtonRef}
                    type="button"
                    className="x-lumno-action-button x-lumno-action-button--secondary x-nt-shortcut-icon-refresh"
                    disabled={disabled || sourceUnavailable || !formState.url.trim()}
                    aria-busy={formState.iconBusy}
                    aria-label={formState.iconBusy
                      ? options.t('newtab_shortcuts_icon_refreshing', 'Refreshing…') : undefined}
                    aria-describedby={iconErrorId}
                    data-success={formState.iconRefreshSuccess}
                    style={{ width: iconRefreshWidth }}
                    onClick={() => { void handleIconRefresh(); }}
                  >
                    <span
                      ref={iconRefreshGlyphRef}
                      className="x-nt-shortcut-icon-refresh-glyph x-lumno-busy-spin"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: options.getRiSvg(formState.iconRefreshSuccess ? 'ri-check-line' : 'ri-refresh-line', 'ri-size-16') }}
                    />
                    <span ref={iconRefreshLabelRef} className="x-nt-shortcut-icon-refresh-label" aria-live="polite">{refreshLabel}</span>
                  </button> : null}
                </div>
              ) : (
              <div className="x-nt-shortcut-icon-control">
                <div
                  ref={iconUploadTileRef}
                  className={[
                    'x-nt-wallpaper-tile',
                    'x-nt-wallpaper-upload-tile',
                    'x-nt-wallpaper-custom-tile',
                    'x-nt-shortcut-icon-upload-tile'
                  ].join(' ')}
                  role="button"
                  tabIndex={0}
                  data-upload="true"
                  data-loading={disabled ? 'true' : 'false'}
                  data-has-icon={hasIcon ? 'true' : 'false'}
                  aria-disabled={disabled ? 'true' : 'false'}
                  aria-label={chooseText}
                  aria-describedby={`${iconInfoId} ${iconErrorId}`}
                  data-tooltip={chooseText}
                  onClick={handleIconChoose}
                  onKeyDown={handleIconChooseKeydown}
                >
                  <span className="x-nt-wallpaper-thumb x-nt-wallpaper-upload-thumb x-nt-shortcut-icon-preview">
                    <img
                      className="x-nt-shortcut-icon-preview-image"
                      src={hasIcon ? formState.iconDataUrl : undefined}
                      alt=""
                      draggable={false}
                      hidden={!hasIcon}
                    />
                    <span
                      className="x-nt-wallpaper-upload-placeholder x-nt-shortcut-icon-placeholder"
                      hidden={hasIcon}
                      dangerouslySetInnerHTML={{
                        __html: options.getRiSvg('ri-add-large-line', 'ri-size-18')
                      }}
                    />
                  </span>
                  <button
                    ref={iconRemoveButtonRef}
                    type="button"
                    className="x-nt-wallpaper-delete-button x-nt-shortcut-icon-remove"
                    hidden={!hasIcon}
                    disabled={disabled}
                    aria-label={options.t('newtab_shortcuts_icon_remove', 'Remove')}
                    onClick={handleIconRemove}
                    dangerouslySetInnerHTML={{
                      __html: options.getRiSvg('ri-subtract-line', 'ri-size-14')
                    }}
                  />
                </div>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="x-nt-shortcut-icon-input"
                  tabIndex={-1}
                  aria-describedby={`${iconInfoId} ${iconErrorId}`}
                  aria-invalid={formState.iconError ? 'true' : 'false'}
                  onChange={() => {
                    void handleIconChange();
                  }}
                />
              </div>
              )}

              {showIconInfo ? <span
                ref={iconInfoDescriptionRef}
                id={iconInfoId}
                className="x-nt-shortcut-visually-hidden"
              >
                {isBuiltinIcon ? options.t(
                  'newtab_shortcuts_icon_builtin_hint',
                  'Use Lumno’s built-in high-quality icons.'
                ) : isShortcutItem ? options.t(
                  'newtab_shortcuts_icon_info',
                  'PNG, JPG, and WebP supported. A transparent square icon at 128 × 128 px or larger is recommended. Saved on this device by default; WebDAV sync is available.'
                ) : options.t(
                  'newtab_shortcuts_folder_item_icon_info',
                  'PNG, JPG, and WebP supported. A transparent square icon at 128 × 128 px or larger is recommended. Saved on this device only.'
                )}
              </span> : null}
              <div
                id={iconErrorId}
                className="x-nt-shortcut-icon-error"
                data-visible={formState.iconError ? 'true' : 'false'}
                role="alert"
                aria-live="polite"
              >
                {formState.iconError}
              </div>
              </div>
            </div>
          ) : null}

          {!isConfirmVariant ? (
            <div
              id={errorId}
              className="x-nt-shortcut-error"
              data-visible={formState.error ? 'true' : 'false'}
              role="alert"
              aria-live="polite"
            >
              {formState.error}
            </div>
          ) : null}

          <div className="x-nt-shortcut-dialog-actions">
            <button
              ref={cancelButtonRef}
              type="button"
              className="x-lumno-action-button x-lumno-action-button--secondary x-nt-shortcut-dialog-button x-nt-shortcut-dialog-button--secondary"
              disabled={formState.busy}
              onClick={onRequestClose}
            >
              {options.t('newtab_shortcuts_cancel', 'Cancel')}
            </button>
            <button
              ref={doneButtonRef}
              type="submit"
              className="x-lumno-action-button x-lumno-action-button--primary x-nt-shortcut-dialog-button x-nt-shortcut-dialog-button--primary"
              disabled={disabled || (formState.iconEditable && !isConfirmVariant && isOnlineIcon && formState.sourceNeedsIcon)}
            >
              {isConfirmVariant
                ? confirmation?.confirmLabel
                : isEditMode
                ? options.t('newtab_shortcuts_save', 'Save')
                : options.t('newtab_shortcuts_done', 'Done')}
            </button>
          </div>
        </form>
      </div>
    );
  }
);

function normalizeOptions(options: ShortcutDialogOptions, root: typeof globalThis): NormalizedOptions | null {
  const documentObj = options.documentObj || root.document;
  const windowObj = options.windowObj || root.window;
  if (!documentObj || !windowObj || typeof documentObj.createElement !== 'function') {
    return null;
  }
  return {
    documentObj,
    windowObj,
    t: typeof options.t === 'function'
      ? options.t
      : (_key, fallback) => fallback || '',
    onSubmit: typeof options.onSubmit === 'function'
      ? options.onSubmit
      : () => Promise.resolve(false),
    prepareIconFile: typeof options.prepareIconFile === 'function'
      ? options.prepareIconFile
      : () => Promise.reject(new Error('Shortcut icon processing is unavailable.')),
    getOnlineIconUrl: typeof options.getOnlineIconUrl === 'function'
      ? options.getOnlineIconUrl : () => '',
    getOnlineIconSource: typeof options.getOnlineIconSource === 'function'
      ? options.getOnlineIconSource : () => 'cache',
    getBuiltinIconUrl: typeof options.getBuiltinIconUrl === 'function'
      ? options.getBuiltinIconUrl : () => '',
    isIconSourceAvailable: typeof options.isIconSourceAvailable === 'function'
      ? options.isIconSourceAvailable : () => true,
    refreshOnlineIcon: typeof options.refreshOnlineIcon === 'function'
      ? options.refreshOnlineIcon : () => Promise.resolve(null),
    getRiSvg: typeof options.getRiSvg === 'function'
      ? options.getRiSvg
      : (id, sizeClass = 'ri-size-16') =>
          `<i class="ri-icon ${sizeClass} ${id}" aria-hidden="true"></i>`,
    bindTooltip: typeof options.bindTooltip === 'function'
      ? options.bindTooltip
      : () => null,
    hideTooltip: typeof options.hideTooltip === 'function'
      ? options.hideTooltip
      : () => {},
    closeDelayMs: Number.isFinite(Number(options.closeDelayMs))
      ? Math.max(0, Number(options.closeDelayMs))
      : DEFAULT_CLOSE_DELAY_MS,
    idPrefix: String(options.idPrefix || DEFAULT_ID_PREFIX)
  };
}

function setEnterDirection(
  sourceElement: HTMLElement | null | undefined,
  dialog: HTMLDivElement | null,
  options: NormalizedOptions
): void {
  let enterX = 0;
  let originX = 'center';
  if (sourceElement && dialog) {
    const sourceRect = sourceElement.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const viewportWidth = Math.max(
      0,
      options.windowObj.innerWidth ||
        options.documentObj.documentElement?.clientWidth ||
        0
    );
    const targetX = dialogRect.width
      ? dialogRect.left + dialogRect.width / 2
      : viewportWidth / 2;
    const sourceX = sourceRect.left + sourceRect.width / 2;
    enterX = getEnterOffset(sourceX, targetX);
    if (Math.abs(enterX) < 2) {
      enterX = 0;
    }
    originX = enterX < -2 ? 'left' : enterX > 2 ? 'right' : 'center';
  }
  if (dialog) {
    dialog.style.setProperty(
      '--x-nt-shortcut-dialog-enter-x',
      `${Math.round(enterX)}px`
    );
    dialog.style.transformOrigin = `${originX} center`;
  }
}

export function createShortcutDialog(
  rawOptions: ShortcutDialogOptions = {}
): ShortcutDialogController | null {
  const normalizedOptions = normalizeOptions(rawOptions, globalThis);
  if (!normalizedOptions) {
    return null;
  }
  const options: NormalizedOptions = normalizedOptions;

  const host = options.documentObj.createElement('div');
  host.className = 'x-nt-shortcut-dialog-backdrop';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', `${options.idPrefix}_title`);
  host.hidden = true;
  host.setAttribute('data-open', 'false');
  host.setAttribute('data-react-island', 'shortcut-dialog');

  const viewRef: MutableRefObject<ShortcutDialogViewHandle | null> = {
    current: null
  };
  const reactRoot: Root = createRoot(host);
  let previousFocus: HTMLElement | null = null;
  let inertSnapshots: InertSnapshot[] = [];
  let modalActive = false;
  let openFrame = 0;
  let closeTimer = 0;
  let destroyed = false;
  let viewRevision = 0;

  const requestFrame = typeof options.windowObj.requestAnimationFrame === 'function'
    ? options.windowObj.requestAnimationFrame.bind(options.windowObj)
    : (callback: FrameRequestCallback) =>
        options.windowObj.setTimeout(() => callback(Date.now()), 0);
  const cancelFrame = typeof options.windowObj.cancelAnimationFrame === 'function'
    ? options.windowObj.cancelAnimationFrame.bind(options.windowObj)
    : options.windowObj.clearTimeout.bind(options.windowObj);
  const setTimer = options.windowObj.setTimeout.bind(options.windowObj);
  const clearTimer = options.windowObj.clearTimeout.bind(options.windowObj);

  function getView(): ShortcutDialogViewHandle | null {
    return viewRef.current;
  }

  function getState(): Readonly<ShortcutDialogState> {
    const snapshot = getView()?.getSnapshot() || {
      mode: MODE_ADD,
      itemType: 'shortcut',
      editingId: '',
      busy: false
    };
    return Object.freeze({
      ...snapshot,
      open: !host.hidden && host.getAttribute('data-open') === 'true'
    });
  }

  function releaseBackgroundIsolation(): void {
    inertSnapshots.forEach(({ element, hadInert }) => {
      if (!hadInert) {
        element.removeAttribute('inert');
      }
    });
    inertSnapshots = [];
  }

  function isolateBackground(): void {
    releaseBackgroundIsolation();
    const targets: HTMLElement[] = [];
    let modalBranch: HTMLElement | null = host;
    while (modalBranch && modalBranch !== options.documentObj.body) {
      const parentElement: HTMLElement | null = modalBranch.parentElement;
      if (!parentElement) {
        break;
      }
      Array.from(parentElement.children).forEach((sibling) => {
        if (sibling !== modalBranch && sibling instanceof HTMLElement) {
          targets.push(sibling);
        }
      });
      modalBranch = parentElement;
    }
    inertSnapshots = targets.map((element) => ({
      element,
      hadInert: element.hasAttribute('inert')
    }));
    inertSnapshots.forEach(({ element }) => {
      element.setAttribute('inert', '');
    });
  }

  function keepFocusInDialog(): void {
    if (!modalActive) {
      return;
    }
    getView()?.focusName();
  }

  function close(closeOptions: ShortcutDialogCloseOptions = {}): boolean {
    if (destroyed) {
      return false;
    }
    if (getState().busy && closeOptions.force !== true) {
      return false;
    }
    if (openFrame) {
      cancelFrame(openFrame);
      openFrame = 0;
    }
    modalActive = false;
    releaseBackgroundIsolation();
    host.removeAttribute('data-preparing');
    if (closeTimer) {
      clearTimer(closeTimer);
      closeTimer = 0;
    }
    host.setAttribute('data-open', 'false');
    options.hideTooltip();
    flushSync(() => {
      getView()?.cancelPendingIcon();
      getView()?.setError('');
      getView()?.setIconError('');
    });
    if (host.hidden || options.closeDelayMs === 0) {
      host.hidden = true;
    } else {
      closeTimer = setTimer(() => {
        closeTimer = 0;
        if (host.getAttribute('data-open') !== 'true') {
          host.hidden = true;
        }
      }, options.closeDelayMs);
    }
    if (closeOptions.restoreFocus) {
      focusElement(previousFocus);
    }
    previousFocus = null;
    return true;
  }

  function renderView(openOptions?: ShortcutDialogOpenOptions): void {
    reactRoot.render(
      <ShortcutDialogView
        key={++viewRevision}
        ref={viewRef}
        options={options}
        openOptions={openOptions}
        onRequestClose={() => {
          close({ restoreFocus: true, force: true });
        }}
      />
    );
  }

  flushSync(() => renderView());

  function open(openOptions: ShortcutDialogOpenOptions = {}): boolean {
    if (destroyed || getState().busy) {
      return false;
    }
    if (!modalActive) {
      previousFocus = openOptions.sourceElement || (
        options.documentObj.activeElement instanceof HTMLElement
          ? options.documentObj.activeElement
          : null
      );
    }
    if (closeTimer) {
      clearTimer(closeTimer);
      closeTimer = 0;
    }
    if (openFrame) {
      cancelFrame(openFrame);
      openFrame = 0;
    }
    flushSync(() => {
      // Each opening owns fresh input, select, upload, and async request state.
      renderView(openOptions);
    });
    if (typeof openOptions.onConfirm === 'function') {
      host.setAttribute('aria-describedby', `${options.idPrefix}_error`);
    } else {
      host.removeAttribute('aria-describedby');
    }
    host.setAttribute('data-open', 'false');
    host.hidden = false;
    host.setAttribute('data-preparing', 'true');
    modalActive = true;
    isolateBackground();
    keepFocusInDialog();
    const dialog = getView()?.getDialogElement() || null;
    setEnterDirection(openOptions.sourceElement, dialog, options);
    if (dialog) {
      void dialog.offsetWidth;
    }
    openFrame = requestFrame(() => {
      openFrame = 0;
      if (destroyed || host.hidden) {
        return;
      }
      host.removeAttribute('data-preparing');
      const currentDialog = getView()?.getDialogElement();
      if (currentDialog) {
        void currentDialog.offsetWidth;
      }
      host.setAttribute('data-open', 'true');
    });
    return true;
  }

  function mount(parentNode: Node, beforeNode?: Node | null): HTMLDivElement {
    if (!parentNode || typeof parentNode.appendChild !== 'function') {
      return host;
    }
    if (beforeNode && typeof parentNode.insertBefore === 'function') {
      parentNode.insertBefore(host, beforeNode);
    } else {
      parentNode.appendChild(host);
    }
    if (modalActive) {
      isolateBackground();
      keepFocusInDialog();
    }
    return host;
  }

  function submit(): Promise<boolean> {
    return getView()?.submit() || Promise.resolve(false);
  }

  function setError(message: unknown): void {
    flushSync(() => {
      getView()?.setError(message);
    });
  }

  function setIconError(message: unknown): void {
    flushSync(() => {
      getView()?.setIconError(message);
    });
  }

  function updateLanguage(): void {
    flushSync(() => {
      getView()?.updateLanguage();
    });
  }

  function handleBackdropPointerDown(event: PointerEvent): void {
    if (event.target === host) {
      close({ restoreFocus: true });
    }
  }

  function handleDocumentFocusIn(event: FocusEvent): void {
    if (!modalActive || host.contains(event.target as Node)) {
      return;
    }
    keepFocusInDialog();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const activeFocusables = (getView()?.getFocusableElements() || []).filter(
      (element) => !(
        (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
        element.disabled
      ) && !element.hidden && element.tabIndex >= 0
    );
    if (activeFocusables.length === 0) {
      return;
    }
    const first = activeFocusables[0];
    const last = activeFocusables[activeFocusables.length - 1];
    if (event.shiftKey && options.documentObj.activeElement === first) {
      event.preventDefault();
      focusElement(last);
    } else if (!event.shiftKey && options.documentObj.activeElement === last) {
      event.preventDefault();
      focusElement(first);
    } else if (!activeFocusables.includes(options.documentObj.activeElement as HTMLElement)) {
      event.preventDefault();
      focusElement(first);
    }
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }
    close({ force: true });
    destroyed = true;
    host.removeEventListener('pointerdown', handleBackdropPointerDown);
    host.removeEventListener('keydown', handleKeydown);
    options.documentObj.removeEventListener('focusin', handleDocumentFocusIn, true);
    flushSync(() => {
      reactRoot.unmount();
    });
    host.remove();
  }

  host.addEventListener('pointerdown', handleBackdropPointerDown);
  host.addEventListener('keydown', handleKeydown);
  options.documentObj.addEventListener('focusin', handleDocumentFocusIn, true);

  return Object.freeze({
    element: host,
    open,
    close,
    mount,
    submit,
    setError,
    setIconError,
    updateLanguage,
    getState,
    destroy
  });
}

export function createShortcutDialogApi() {
  return Object.freeze({
    implementation: 'react',
    MODE_ADD,
    MODE_EDIT,
    clampEnterOffset,
    getEnterOffset,
    normalizeMode,
    createShortcutDialog
  });
}
