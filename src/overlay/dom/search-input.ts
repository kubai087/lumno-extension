// The search field in the input's container, found again after the input
// re-rendered.
function findLiveSearchInput(container: Element): HTMLInputElement | null {
  const input = container.querySelector('#_x_extension_search_input_2024_unique_') ||
    container.querySelector('input');
  return input instanceof HTMLInputElement ? input : null;
}

export { findLiveSearchInput };
