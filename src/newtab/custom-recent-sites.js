(function(root, factory) {
  const api = factory(root);
  root.LumnoCustomRecentSites = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  const STORAGE_KEY = '_x_extension_newtab_custom_recent_sites_2026_unique_';
  const MAX_SITES = 24;

  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2048) return '';
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return '';
      return url.href;
    } catch (_) { return ''; }
  }

  function normalizeSites(value) {
    const sites = [];
    const seen = new Set();
    for (const item of Array.isArray(value) ? value : []) {
      const url = normalizeUrl(item && item.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const host = new URL(url).hostname.replace(/^www\./i, '');
      const title = String(item.title || host).trim().slice(0, 120) || host;
      sites.push({ url, title, host, siteName: title, _xCustom: true });
      if (sites.length >= MAX_SITES) break;
    }
    return sites;
  }

  function createController(options) {
    const { documentObj: document, storage, header, grid, t, getMode, getLimit, onChange } = options;
    let sites = [];
    let page = 0;
    let editingUrl = '';
    let open = false;
    let busy = false;
    let loaded = false;
    let loadPromise = null;
    let revision = 0;
    let destroyed = false;
    const node = (tag, className) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      return element;
    };
    const textButton = (label, action, className) => {
      const button = node('button', className || 'x-nt-custom-recent-button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      return button;
    };
    const tools = node('div', 'x-nt-custom-recent-tools');
    const manage = textButton('', () => { open = !open; update(); if (open) titleInput.focus(); });
    manage.setAttribute('aria-controls', 'x-nt-custom-recent-editor');
    const previous = textButton('', () => { page = Math.max(0, page - 1); onChange(); });
    const next = textButton('', () => { page += 1; onChange(); });
    const pageLabel = node('span', 'x-nt-custom-recent-page');
    tools.append(previous, pageLabel, next, manage);
    header.appendChild(tools);
    const panel = node('section', 'x-nt-custom-recent-editor');
    panel.id = 'x-nt-custom-recent-editor';
    const hint = node('p', 'x-nt-custom-recent-hint');
    const list = node('ol', 'x-nt-custom-recent-list');
    const form = node('form', 'x-nt-custom-recent-form');
    const titleLabel = node('label');
    const titleText = node('span');
    const titleInput = node('input');
    titleInput.name = 'site-title';
    titleInput.maxLength = 120;
    titleInput.required = true;
    titleLabel.append(titleText, titleInput);
    const urlLabel = node('label');
    const urlText = node('span');
    const urlInput = node('input');
    urlInput.name = 'site-url';
    urlInput.inputMode = 'url';
    urlInput.maxLength = 2048;
    urlInput.required = true;
    urlInput.spellcheck = false;
    urlLabel.append(urlText, urlInput);
    const actions = node('div', 'x-nt-custom-recent-form-actions');
    const save = node('button', 'x-nt-custom-recent-button x-nt-custom-recent-save');
    save.type = 'submit';
    const cancel = textButton('', () => { resetForm(); update(); titleInput.focus(); });
    actions.append(save, cancel);
    const error = node('p', 'x-nt-custom-recent-error');
    error.id = 'x-nt-custom-recent-error';
    error.setAttribute('role', 'alert');
    const status = node('p', 'x-nt-custom-recent-status');
    status.setAttribute('role', 'status');
    form.append(titleLabel, urlLabel, actions);
    panel.append(hint, form, error, status, list);
    grid.parentNode.insertBefore(panel, grid);
    const empty = node('p', 'x-nt-custom-recent-empty');
    grid.parentNode.insertBefore(empty, grid);

    function resetForm() {
      editingUrl = '';
      form.reset();
      error.textContent = '';
      urlInput.removeAttribute('aria-invalid');
      urlInput.removeAttribute('aria-describedby');
    }

    function fail(message) {
      error.textContent = message;
      status.textContent = '';
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.setAttribute('aria-describedby', error.id);
    }

    function load() {
      if (loaded) return Promise.resolve(sites);
      if (loadPromise) return loadPromise;
      const startingRevision = revision;
      loadPromise = new Promise((resolve) => {
        if (!storage || typeof storage.get !== 'function') { resolve({}); return; }
        storage.get([STORAGE_KEY], (result) => resolve(result || {}));
      }).then((result) => {
        if (revision === startingRevision) sites = normalizeSites(result[STORAGE_KEY]);
        loaded = true;
        return sites;
      }).finally(() => { loadPromise = null; });
      return loadPromise;
    }

    async function persist(value) {
      if (busy) return false;
      const serialize = (items) => JSON.stringify(normalizeSites(items).map(({ title, url }) => ({ title, url })));
      const expected = serialize(sites);
      busy = true;
      error.textContent = '';
      status.textContent = '';
      update();
      try {
        if (!storage || typeof storage.set !== 'function') throw new Error('storage-unavailable');
        const normalized = normalizeSites(value);
        const write = async () => {
          const latest = await new Promise((resolve, reject) => storage.get([STORAGE_KEY], (result) => {
            const runtimeError = options.chromeObj?.runtime?.lastError;
            if (runtimeError) reject(new Error(runtimeError.message)); else resolve(result || {});
          }));
          if (serialize(latest[STORAGE_KEY]) !== expected) {
            sites = normalizeSites(latest[STORAGE_KEY]);
            revision += 1;
            onChange();
            throw new Error('list-changed');
          }
          await new Promise((resolve, reject) => storage.set({
            [STORAGE_KEY]: normalized.map(({ title, url }) => ({ title, url }))
          }, () => {
            const runtimeError = options.chromeObj?.runtime?.lastError;
            if (runtimeError) reject(new Error(runtimeError.message)); else resolve();
          }));
        };
        const locks = options.lockManager || root.navigator?.locks;
        if (locks && typeof locks.request === 'function') await locks.request(STORAGE_KEY, write);
        else await write();
        sites = normalized;
        revision += 1;
        loaded = true;
        status.textContent = t('custom_recent_saved', 'Saved');
        onChange();
        return true;
      } catch (failure) {
        error.textContent = failure.message === 'list-changed'
          ? t('custom_recent_changed_elsewhere', 'The list changed in another tab. Review it and try again.')
          : t('custom_recent_save_failed', 'Could not save. Please try again.');
        return false;
      } finally {
        busy = false;
        update();
      }
    }

    function edit(item) {
      if (busy) return;
      open = true;
      editingUrl = item.url;
      titleInput.value = item.title;
      urlInput.value = item.url;
      error.textContent = '';
      update();
      titleInput.focus();
      titleInput.select();
    }

    function pageItems(items, limit) {
      const all = normalizeSites(items);
      const count = Math.max(1, Number(limit) || 1);
      page = Math.min(page, Math.max(0, Math.ceil(all.length / count) - 1));
      return all.slice(page * count, (page + 1) * count);
    }

    function update() {
      const active = getMode() === 'custom' && getLimit() > 0;
      tools.hidden = !active;
      panel.hidden = !active || !open;
      empty.hidden = !active || sites.length > 0 || open;
      empty.textContent = t('custom_recent_empty', 'No sites yet. Choose Manage sites to add your first one.');
      panel.setAttribute('aria-label', t('custom_recent_manage', 'Manage sites'));
      manage.textContent = t('custom_recent_manage', 'Manage sites');
      manage.setAttribute('aria-expanded', String(open));
      manage.disabled = busy;
      const pageCount = Math.max(1, Math.ceil(sites.length / Math.max(1, getLimit())));
      page = Math.min(page, pageCount - 1);
      previous.hidden = next.hidden = pageLabel.hidden = pageCount <= 1;
      previous.textContent = t('custom_recent_previous', 'Previous page');
      next.textContent = t('custom_recent_next', 'Next page');
      previous.disabled = page === 0;
      next.disabled = page >= pageCount - 1;
      pageLabel.textContent = `${page + 1} / ${pageCount}`;
      hint.textContent = t('custom_recent_description', 'Choose the sites and their order. This list is saved on this device.');
      titleText.textContent = t('custom_recent_name', 'Website name');
      urlText.textContent = t('custom_recent_url', 'Website URL');
      urlInput.placeholder = 'https://example.com';
      save.textContent = editingUrl ? t('custom_recent_save', 'Save changes') : t('custom_recent_add', 'Add site');
      cancel.textContent = t('custom_recent_cancel', 'Cancel edit');
      cancel.hidden = !editingUrl;
      save.disabled = busy || (!editingUrl && sites.length >= MAX_SITES);
      titleInput.disabled = urlInput.disabled = cancel.disabled = busy;
      if (!open) return;
      const focusedRow = list.contains(document.activeElement) ? document.activeElement.closest('li') : null;
      const focusedSite = focusedRow?.dataset.siteUrl;
      const focusedAction = document.activeElement?.dataset.action;
      list.replaceChildren();
      sites.forEach((item, index) => {
        const row = node('li', 'x-nt-custom-recent-row');
        row.dataset.siteUrl = item.url;
        const copy = node('span', 'x-nt-custom-recent-copy');
        const name = node('strong');
        const address = node('span');
        name.textContent = item.title;
        address.textContent = item.url;
        copy.append(name, address);
        const controls = node('div', 'x-nt-custom-recent-row-actions');
        const rowButton = (key, fallback, icon, action, disabled) => {
          const button = textButton('', action);
          button.dataset.action = key;
          button.setAttribute('aria-label', `${t(key, fallback)}: ${item.title}`);
          button.title = t(key, fallback);
          const glyph = node('i', `ri-icon ${icon}`);
          glyph.setAttribute('aria-hidden', 'true');
          button.appendChild(glyph);
          button.disabled = busy || disabled;
          controls.appendChild(button);
        };
        const move = (delta) => {
          const reordered = sites.slice();
          [reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
          void persist(reordered).then((saved) => {
            if (saved) list.children[index + delta]?.querySelector('button:not(:disabled)')?.focus();
          });
        };
        rowButton('custom_recent_move_up', 'Move up', 'ri-arrow-up-line', () => move(-1), index === 0);
        rowButton('custom_recent_move_down', 'Move down', 'ri-arrow-down-line', () => move(1), index === sites.length - 1);
        rowButton('custom_recent_edit', 'Edit', 'ri-edit-line', () => edit(item));
        rowButton('custom_recent_remove', 'Remove', 'ri-delete-bin-line', () => {
          void persist(sites.filter((site) => site.url !== item.url)).then((saved) => {
            if (!saved) return;
            if (editingUrl === item.url) { resetForm(); update(); }
            (list.children[Math.min(index, sites.length - 1)]?.querySelector('button:not(:disabled)') || titleInput).focus();
          });
        });
        row.append(copy, controls);
        list.appendChild(row);
      });
      if (focusedSite && active) {
        const row = Array.from(list.children).find((item) => item.dataset.siteUrl === focusedSite);
        const sameAction = row && Array.from(row.querySelectorAll('button')).find((button) => button.dataset.action === focusedAction && !button.disabled);
        (sameAction || row?.querySelector('button:not(:disabled)') || titleInput).focus();
      }
      if (sites.length >= MAX_SITES) hint.textContent += ` ${t('custom_recent_limit', 'Maximum number of sites')}: ${MAX_SITES}.`;
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (busy) return;
      const url = normalizeUrl(urlInput.value);
      if (!url) { fail(t('custom_recent_invalid_url', 'Enter a valid HTTP or HTTPS website URL.')); urlInput.focus(); return; }
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      if (sites.some((item) => item.url === url && item.url !== editingUrl)) {
        fail(t('custom_recent_duplicate', 'This URL is already in your list.')); urlInput.focus(); return;
      }
      if (!editingUrl && sites.length >= MAX_SITES) return;
      const value = { title, url };
      const nextSites = editingUrl ? sites.map((item) => item.url === editingUrl ? value : item) : [...sites, value];
      void persist(nextSites).then((saved) => {
        if (!saved) return;
        page = Math.floor(Math.max(0, sites.findIndex((item) => item.url === url)) / Math.max(1, getLimit()));
        resetForm(); update(); onChange(); titleInput.focus();
      });
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault(); event.stopPropagation();
      open = false; resetForm(); update(); manage.focus();
    });
    const storageListener = (changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY] || destroyed) return;
      sites = normalizeSites(changes[STORAGE_KEY].newValue);
      if (editingUrl && !sites.some((item) => item.url === editingUrl)) {
        editingUrl = '';
        error.textContent = t('custom_recent_removed_elsewhere', 'This site was removed in another tab. You can add it again.');
      }
      revision += 1;
      loaded = true;
      update(); onChange();
    };
    options.chromeObj?.storage?.onChanged?.addListener(storageListener);
    update();
    return {
      load,
      pageItems,
      update,
      edit,
      destroy() {
        destroyed = true;
        options.chromeObj?.storage?.onChanged?.removeListener(storageListener);
        tools.remove(); panel.remove(); empty.remove();
      }
    };
  }

  return { STORAGE_KEY, MAX_SITES, normalizeUrl, normalizeSites, createController };
});
