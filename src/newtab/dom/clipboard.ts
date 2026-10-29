// Copies text through a hidden selection, for when the clipboard API is not
// there or refuses; focus goes back to where it was.
function copyTextThroughSelection(text: unknown): boolean {
  if (!document || !document.body || typeof document.execCommand !== 'function') {
    return false;
  }
  const activeElement = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = String(text || '');
  textarea.setAttribute('readonly', '');
  textarea.style.setProperty('position', 'fixed');
  textarea.style.setProperty('left', '-9999px');
  textarea.style.setProperty('top', '0');
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  textarea.remove();
  if (activeElement && 'focus' in activeElement && typeof activeElement.focus === 'function') {
    activeElement.focus({ preventScroll: true });
  }
  return copied;
}

export { copyTextThroughSelection };
