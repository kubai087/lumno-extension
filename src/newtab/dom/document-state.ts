// The page's theme on the document: the body's `data-theme` the styles key
// on, and once it is set, the root's color scheme and the browser's theme
// color, with the preload's stand-in theme dropped.
function getDocumentTheme(): string {
  return document.body ? document.body.getAttribute('data-theme') || '' : '';
}

function setDocumentTheme(resolved: 'light' | 'dark'): void {
  document.body.setAttribute('data-theme', resolved);
}

function applyDocumentColorScheme(resolved: 'light' | 'dark'): void {
  if (document.documentElement) {
    document.documentElement.removeAttribute('data-wallpaper-preload-theme');
    document.documentElement.style.colorScheme = resolved;
  }
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', resolved === 'dark' ? '#111111' : '#ffffff');
  }
}

export { applyDocumentColorScheme, getDocumentTheme, setDocumentTheme };
