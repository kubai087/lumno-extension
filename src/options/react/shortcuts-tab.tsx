import { useEffect, useRef, type ReactNode } from 'react';
import { queryHtmlElement } from '../../shared/dom-lookup';
import { AggregateSearchList, type AggregateSearchListOptions, type AggregateSearchListRenderModel } from './aggregate-search-list';
import { GroupActionConfirm, type GroupActionConfirmModel } from './group-action-confirm';
import { InfoButton } from './info-button';
import { SettingDivider, SettingSwitch } from './setting-rows';
import { SiteSearchForm, type SiteSearchFormRenderModel, type SiteSearchFormSaveHandler } from './settings-forms';
import { SiteSearchList, type SiteSearchListOptions, type SiteSearchListRenderModel } from './site-search-list';
import type { ToggleControlRenderModel } from './toggle-control';
import { RemixIcon } from '../../shared/react/remix-icon';

// The lists a reader can reorder by dragging, as the search source order names them.
export type ShortcutsListId = 'custom' | 'site' | 'ai' | 'engine' | 'aggregate';

export interface SearchGroupChipModel {
  group: string;
  label: string;
}

// A list's model is null until its section first draws it.
export interface ShortcutsTabModel {
  order: { title: string; info: string; keyboardHint: string; groups: SearchGroupChipModel[] };
  custom: { title: string; clear: GroupActionConfirmModel; list: SiteSearchListRenderModel | null };
  form: SiteSearchFormRenderModel | null;
  aggregate: {
    title: string;
    clear: GroupActionConfirmModel;
    autoGroup: { title: string; info: string; toggle: ToggleControlRenderModel };
    list: AggregateSearchListRenderModel | null;
  };
  sites: { title: string; reset: GroupActionConfirmModel; list: SiteSearchListRenderModel | null };
  ai: { title: string; info: string; list: SiteSearchListRenderModel | null };
  engines: { title: string; list: SiteSearchListRenderModel | null };
}

export interface ShortcutsTabHandlers {
  onMoveGroup(fromIndex: number, toIndex: number): void;
  // Each returns the function that takes the drag off again.
  attachGroupDrag(host: HTMLElement | null): () => void;
  attachListDrag(listId: ShortcutsListId, host: HTMLElement | null): () => void;
  custom: SiteSearchListOptions;
  sites: SiteSearchListOptions;
  ai: SiteSearchListOptions;
  engines: SiteSearchListOptions;
  aggregate: AggregateSearchListOptions;
  onAddSiteSearch: SiteSearchFormSaveHandler;
  onClearCustom(): void | Promise<void>;
  onClearAggregates(): void | Promise<void>;
  onResetBuiltin(): void | Promise<void>;
  onAutoGroupChange(checked: boolean): void;
}

const GROUP_CLASS = '_x_extension_shortcut_group_2024_unique_';
const GROUP_HEADER_CLASS = '_x_extension_shortcut_group_header_2024_unique_';
const GROUP_TITLE_CLASS = '_x_extension_shortcut_group_title_2024_unique_ _x_extension_section_title_2024_unique_';
const TITLE_WITH_ICON_CLASS = `${GROUP_TITLE_CLASS} _x_extension_section_title_with_icon_2026_unique_`;
const LIST_CLASS = '_x_extension_shortcut_list_2024_unique_';

function SearchGroupOrder({
  model,
  onMove,
  attachDrag
}: {
  model: ShortcutsTabModel['order'];
  onMove(fromIndex: number, toIndex: number): void;
  attachDrag(host: HTMLElement | null): () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // The chip moved from the keyboard keeps focus after the reorder.
  const focusGroupRef = useRef('');
  useEffect(() => attachDrag(hostRef.current), [attachDrag]);
  useEffect(() => {
    const group = focusGroupRef.current;
    const host = hostRef.current;
    if (!group || !host) {
      return;
    }
    focusGroupRef.current = '';
    const chip = queryHtmlElement(host, `[data-group="${group}"]`);
    if (chip && chip.ownerDocument.activeElement !== chip) {
      chip.focus({ preventScroll: true });
    }
  });
  return (
    <div
      aria-label={model.title}
      className="_x_extension_order_chips_2026_unique_"
      id="_x_extension_search_source_group_order_2026_unique_"
      ref={hostRef}
      role="list"
    >
      {model.groups.map((item, index) => (
        <div
          aria-description={model.keyboardHint}
          aria-label={item.label}
          className="_x_extension_order_chip_2026_unique_"
          data-group={item.group}
          data-sortable="true"
          key={item.group}
          onKeyDown={(event) => {
            if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
              return;
            }
            event.preventDefault();
            const target = index + (event.key === 'ArrowLeft' ? -1 : 1);
            if (target >= 0 && target < model.groups.length) {
              focusGroupRef.current = item.group;
              onMove(index, target);
            }
          }}
          role="listitem"
          tabIndex={0}
        >
          <RemixIcon name="ri-draggable" />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// A list container whose rows the reader can drag into a new order.
function DraggableList({
  id,
  className,
  listId,
  attachDrag,
  children
}: {
  id: string;
  className?: string;
  listId: ShortcutsListId;
  attachDrag(listId: ShortcutsListId, host: HTMLElement | null): () => void;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => attachDrag(listId, hostRef.current), [attachDrag, listId]);
  return (
    <div className={className} id={id} ref={hostRef}>
      {children}
    </div>
  );
}

function SiteSearchListSlot({
  model,
  options
}: {
  model: SiteSearchListRenderModel | null;
  options: SiteSearchListOptions;
}) {
  return model ? <SiteSearchList model={model} options={options} /> : null;
}

export function ShortcutsTab({ model, handlers }: { model: ShortcutsTabModel; handlers: ShortcutsTabHandlers }) {
  const { order, custom, aggregate, sites, ai, engines } = model;
  return (
    <div className="_x_extension_shortcuts_section_2024_unique_">
      <div className={`${GROUP_CLASS} _x_extension_search_source_order_group_2026_unique_`}>
        <div className={GROUP_HEADER_CLASS}>
          <div className={TITLE_WITH_ICON_CLASS}>
            <span>{order.title}</span>
            <InfoButton tooltip={order.info} />
          </div>
        </div>
        <SearchGroupOrder attachDrag={handlers.attachGroupDrag} model={order} onMove={handlers.onMoveGroup} />
      </div>
      <SettingDivider />
      <div className={GROUP_CLASS}>
        <div className={GROUP_HEADER_CLASS}>
          <div className={GROUP_TITLE_CLASS}>{custom.title}</div>
          <GroupActionConfirm
            disabled={!custom.list || custom.list.items.length === 0}
            iconName="ri-delete-bin-4-line"
            id="_x_extension_custom_clear_2024_unique_"
            model={custom.clear}
            onConfirm={handlers.onClearCustom}
          />
        </div>
        <DraggableList
          attachDrag={handlers.attachListDrag}
          className={LIST_CLASS}
          id="_x_extension_site_search_custom_list_2024_unique_"
          listId="custom"
        >
          <SiteSearchListSlot model={custom.list} options={handlers.custom} />
        </DraggableList>
      </div>
      {model.form ? <SiteSearchForm model={model.form} onSave={handlers.onAddSiteSearch} /> : null}
      <SettingDivider />
      <div className={GROUP_CLASS} id="_x_extension_aggregate_search_group_2026_unique_">
        <div className={GROUP_HEADER_CLASS}>
          <div className={GROUP_TITLE_CLASS}>{aggregate.title}</div>
          <GroupActionConfirm
            disabled={!aggregate.list || aggregate.list.items.length === 0}
            iconName="ri-delete-bin-4-line"
            id="_x_extension_aggregate_search_clear_2026_unique_"
            model={aggregate.clear}
            onConfirm={handlers.onClearAggregates}
          />
        </div>
        <div className="_x_extension_setting_row_2024_unique_ _x_extension_setting_row_compact_2024_unique_">
          <div>
            <p className="_x_extension_setting_title_2024_unique_ _x_extension_setting_title_with_icon_2024_unique_">
              <span>{aggregate.autoGroup.title}</span>
              <InfoButton tooltip={aggregate.autoGroup.info} />
            </p>
          </div>
          <SettingSwitch model={aggregate.autoGroup.toggle} onChange={handlers.onAutoGroupChange} />
        </div>
        <DraggableList attachDrag={handlers.attachListDrag} id="_x_extension_aggregate_search_list_2026_unique_" listId="aggregate">
          {aggregate.list ? <AggregateSearchList model={aggregate.list} options={handlers.aggregate} /> : null}
        </DraggableList>
      </div>
      <SettingDivider />
      <div className={GROUP_CLASS}>
        <div className={GROUP_HEADER_CLASS}>
          <div className={GROUP_TITLE_CLASS}>{sites.title}</div>
          <GroupActionConfirm
            iconName="ri-refresh-line"
            id="_x_extension_builtin_reset_2024_unique_"
            model={sites.reset}
            onConfirm={handlers.onResetBuiltin}
          />
        </div>
        <DraggableList
          attachDrag={handlers.attachListDrag}
          className={LIST_CLASS}
          id="_x_extension_site_search_builtin_list_2024_unique_"
          listId="site"
        >
          <SiteSearchListSlot model={sites.list} options={handlers.sites} />
        </DraggableList>
      </div>
      <div className={GROUP_CLASS} id="_x_extension_site_search_ai_group_2026_unique_">
        <div className={GROUP_HEADER_CLASS}>
          <div className={TITLE_WITH_ICON_CLASS}>
            <span>{ai.title}</span>
            <InfoButton tooltip={ai.info} />
          </div>
        </div>
        <DraggableList
          attachDrag={handlers.attachListDrag}
          className={LIST_CLASS}
          id="_x_extension_site_search_ai_builtin_list_2026_unique_"
          listId="ai"
        >
          <SiteSearchListSlot model={ai.list} options={handlers.ai} />
        </DraggableList>
      </div>
      <SettingDivider />
      <div className={GROUP_CLASS} id="_x_extension_search_engine_group_2026_unique_">
        <div className={GROUP_HEADER_CLASS}>
          <div className={GROUP_TITLE_CLASS}>{engines.title}</div>
        </div>
        <DraggableList
          attachDrag={handlers.attachListDrag}
          className={LIST_CLASS}
          id="_x_extension_search_engine_builtin_list_2026_unique_"
          listId="engine"
        >
          <SiteSearchListSlot model={engines.list} options={handlers.engines} />
        </DraggableList>
      </div>
    </div>
  );
}
