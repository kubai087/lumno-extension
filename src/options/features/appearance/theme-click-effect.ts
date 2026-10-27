const CLICK_EFFECT_MS = 260;

// The short press animation on a theme option.
function playThemeOptionClickEffect(button: Element | null, windowObj: Window): void {
  if (!button) {
    return;
  }
  button.classList.remove('x-theme-clicking');
  // Reading the layout restarts the animation when the class returns.
  void button.getBoundingClientRect();
  button.classList.add('x-theme-clicking');
  windowObj.setTimeout(() => {
    button.classList.remove('x-theme-clicking');
  }, CLICK_EFFECT_MS);
}

export { playThemeOptionClickEffect };
