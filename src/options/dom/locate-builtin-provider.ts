// A custom site search that repeats a built-in one can point at it: the
// built-in row scrolls into view and flashes once.
function locateBuiltinProvider(doc: Document, normalizedTemplate: string): void {
  const targetRow = Array.from(doc.querySelectorAll(
    '[data-type="builtin"][data-template]'
  )).find((row) => row.getAttribute('data-template') === normalizedTemplate);
  if (!targetRow) {
    return;
  }
  targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  targetRow.removeAttribute('data-flash');
  // Reading the layout restarts the animation when the attribute returns.
  void targetRow.getBoundingClientRect();
  targetRow.setAttribute('data-flash', 'true');
  const onFlashEnd = () => {
    targetRow.removeAttribute('data-flash');
    targetRow.removeEventListener('animationend', onFlashEnd);
  };
  targetRow.addEventListener('animationend', onFlashEnd);
}

export { locateBuiltinProvider };
