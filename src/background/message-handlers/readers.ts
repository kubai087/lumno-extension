// Reading the untyped fields of incoming messages.
import type * as SHORTCUT_KEY_MATCHER from '../../domain/shortcut-key-matcher';
import type { OpenDisposition } from '../../domain/messages';

function readDisposition(value: unknown): OpenDisposition | undefined {
  return value === 'currentTab' || value === 'newTab' || value === 'backgroundTab' || value === 'splitTab' ? value : undefined;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// The keys a page saw pressed, with only the fields of the expected types.
function readKeyDescriptor(value: unknown): Partial<SHORTCUT_KEY_MATCHER.KeyDescriptor> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const fields: object = value;
  const descriptor: Partial<SHORTCUT_KEY_MATCHER.KeyDescriptor> = {};
  if ('ctrlKey' in fields && typeof fields.ctrlKey === 'boolean') descriptor.ctrlKey = fields.ctrlKey;
  if ('altKey' in fields && typeof fields.altKey === 'boolean') descriptor.altKey = fields.altKey;
  if ('shiftKey' in fields && typeof fields.shiftKey === 'boolean') descriptor.shiftKey = fields.shiftKey;
  if ('metaKey' in fields && typeof fields.metaKey === 'boolean') descriptor.metaKey = fields.metaKey;
  if ('key' in fields && typeof fields.key === 'string') descriptor.key = fields.key;
  return descriptor;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export {
  getErrorMessage,
  readDisposition,
  readKeyDescriptor,
  readString
};
