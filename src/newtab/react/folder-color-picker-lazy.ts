import type { PickerOptions } from './folder-color-picker';

// The picker opens only from a folder's or shortcut's menu; keep it off the
// initial New Tab route.
export async function createFolderColorPicker(options: PickerOptions) {
  const picker = await import('./folder-color-picker');
  return picker.createFolderColorPicker(options);
}
