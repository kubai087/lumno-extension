// The style a page view transition runs with, added once to the head and
// marked so a second transition finds it there.
const VIEW_TRANSITION_STYLE_ATTRIBUTE = 'data-nt-focus-resume-transition';

function addTransitionStyle(cssText: string): void {
  const head = document.head || document.documentElement;
  if (!head || document.querySelector(`style[${VIEW_TRANSITION_STYLE_ATTRIBUTE}]`)) {
    return;
  }
  const style = document.createElement('style');
  style.setAttribute(VIEW_TRANSITION_STYLE_ATTRIBUTE, 'true');
  style.textContent = cssText;
  head.appendChild(style);
}

export { addTransitionStyle };
