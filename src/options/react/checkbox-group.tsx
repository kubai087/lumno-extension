import { useState } from 'react';
import { RemixIcon } from '../../shared/react/remix-icon';

export interface CheckboxItemModel {
  checked: boolean;
  id: string;
  label: string;
  labelKey: string;
  value: string;
}

export interface CheckboxGroupRenderModel {
  items: CheckboxItemModel[];
  // The items can be reordered: dragged (wired by the page) or moved with
  // Alt+Left and Alt+Right from a focused checkbox.
  sortable?: boolean;
}

export function CheckboxGroup({
  model,
  onChange,
  onMove
}: {
  model: CheckboxGroupRenderModel;
  onChange(values: string[]): void;
  onMove?(fromIndex: number, toIndex: number): void;
}) {
  const sortable = Boolean(model.sortable && onMove && model.items.length > 1);
  const serializedValues = model.items
    .filter((item) => item.checked)
    .map((item) => item.value)
    .join('\u0000');
  const [selected, setSelected] = useState(
    () => new Set(serializedValues ? serializedValues.split('\u0000') : [])
  );

  // Same-render sync, as in ToggleControl.
  const [modelValues, setModelValues] = useState(serializedValues);
  if (modelValues !== serializedValues) {
    setModelValues(serializedValues);
    setSelected(new Set(serializedValues ? serializedValues.split('\u0000') : []));
  }

  return (
    <>
      {model.items.map((item, index) => (
        <label
          className={sortable
            ? '_x_extension_checkbox_2026_unique_ _x_extension_order_chip_2026_unique_'
            : '_x_extension_checkbox_2026_unique_'}
          data-sortable={sortable ? 'true' : undefined}
          data-value={item.value}
          key={item.value}
        >
          {sortable ? (
            <RemixIcon name="ri-draggable" />
          ) : null}
          <input
            checked={selected.has(item.value)}
            data-search-result-source-type={item.value}
            id={item.id}
            onKeyDown={sortable ? (event) => {
              if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
                return;
              }
              const target = index + (event.key === 'ArrowLeft' ? -1 : 1);
              event.preventDefault();
              if (target >= 0 && target < model.items.length && onMove) {
                onMove(index, target);
              }
            } : undefined}
            onChange={(event) => {
              const next = new Set(selected);
              if (event.currentTarget.checked) {
                next.add(item.value);
              } else {
                next.delete(item.value);
              }
              setSelected(next);
              onChange(model.items
                .map((entry) => entry.value)
                .filter((value) => next.has(value)));
            }}
            type="checkbox"
          />
          <span data-i18n={item.labelKey}>{item.label}</span>
        </label>
      ))}
    </>
  );
}
