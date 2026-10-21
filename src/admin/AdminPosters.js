import { API_BASE } from '../apiConfig.js';
import { supabaseClient } from '../supabaseFrontendClient.js';
import { AdminLayout } from './AdminLayout.js';
import './admin.css';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const icons = {
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20H5a1 1 0 0 1-1-1v-7M15 5l4 4M13 7l5-5 4 4-5 5-4 1z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v5M14 11v5M9 7l1-3h4l1 3M6 7l1 13h10l1-13"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>'
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toLocalDateInput(value) {
  if (!value) return '';
  const candidate = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

/**
 * Authenticated administration for the public Events & Announcements carousel.
 * The API is deliberately the source of truth: this screen does not fall back
 * to localStorage, so a failed save can never look like it succeeded.
 */
export class AdminPosters {
  constructor(containerId = 'page-content') {
    this.containerId = containerId;
    this.container = null;
    this.posters = [];
    this.filters = { query: '', status: 'all' };
    this.editingPoster = null;
    this.activeModal = null;
    this.previewObjectUrl = null;
    this.toastTimer = null;
    this.API_URL = `${API_BASE}/event-posters`;
    this.onEscape = this.onEscape.bind(this);
  }

  async authHeaders({ json = true } = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const headers = {};

    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async request(path = '', options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(`${this.API_URL}${path}`, {
      ...options,
      headers: {
        ...(await this.authHeaders({ json: !isFormData })),
        ...(options.headers || {})
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '');

    if (!response.ok) {
      const message = typeof payload === 'object'
        ? payload.error || payload.message
        : payload;
      throw new Error(message || `Request failed (${response.status})`);
    }

    return payload;
  }

  normalisePoster(record = {}) {
    const rawStatus = String(record.status || (record.active === false ? 'draft' : 'published')).toLowerCase();
    const status = ['draft', 'published', 'unpublished'].includes(rawStatus) ? rawStatus : 'draft';

    return {
      id: String(record.id ?? ''),
      title: record.title || '',
      category: record.category || record.ministry || '',
      description: record.description || record.subtitle || '',
      imageUrl: record.imageUrl || record.image_url || record.image || '',
      storagePath: record.storagePath || record.storage_path || '',
      eventDate: toLocalDateInput(record.eventDate || record.event_date),
      eventEndDate: toLocalDateInput(record.eventEndDate || record.event_end_date),
      startTime: record.startTime || record.start_time || '',
      venue: record.venue || record.location || '',
      contactInfo: record.contactInfo || record.contact_info || '',
      status,
      displayOrder: Number(record.displayOrder ?? record.display_order ?? record.order ?? 0),
      createdAt: record.createdAt || record.created_at || '',
      updatedAt: record.updatedAt || record.updated_at || ''
    };
  }

  sortPosters(posters) {
    return [...posters].sort((a, b) => {
      const orderDifference = (a.displayOrder || Number.MAX_SAFE_INTEGER) - (b.displayOrder || Number.MAX_SAFE_INTEGER);
      if (orderDifference !== 0) return orderDifference;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  async render() {
    this.closeModal({ restoreFocus: false });
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;

    this.container.innerHTML = AdminLayout.getLayout(this.renderShell(), '/admin/event-posters');
    this.bindEvents();
    await this.loadPosters();
  }

  renderShell() {
    return `
      <section class="event-posters-admin" aria-labelledby="event-posters-title">
        <header class="event-posters-admin__header">
          <div>
            <p class="event-posters-admin__eyebrow">Homepage content</p>
            <h1 id="event-posters-title" class="admin-title">Event Posters</h1>
            <p class="event-posters-admin__intro">Create and arrange the announcements shown in the Church Events carousel.</p>
          </div>
          <button type="button" class="admin-btn admin-btn-primary event-posters-admin__add" data-action="create">
            ${icons.add}
            <span>Add event poster</span>
          </button>
        </header>

        <div class="event-posters-stats" aria-label="Poster summary">
          <article class="event-poster-stat">
            <span>Total posters</span>
            <strong id="event-posters-total">—</strong>
          </article>
          <article class="event-poster-stat event-poster-stat--published">
            <span>Published</span>
            <strong id="event-posters-published">—</strong>
          </article>
          <article class="event-poster-stat event-poster-stat--draft">
            <span>Draft / unpublished</span>
            <strong id="event-posters-drafts">—</strong>
          </article>
          <article class="event-poster-stat event-poster-stat--upcoming">
            <span>Upcoming events</span>
            <strong id="event-posters-upcoming">—</strong>
          </article>
        </div>

        <section class="admin-card event-posters-admin__list" aria-labelledby="event-poster-list-title">
          <div class="admin-card-header event-posters-admin__list-header">
            <div>
              <h2 id="event-poster-list-title">All event posters</h2>
              <p id="event-posters-result-count" class="event-posters-admin__result-count" aria-live="polite">Loading posters…</p>
            </div>
            <div class="event-posters-admin__filters" aria-label="Filter posters">
              <label class="event-posters-admin__search">
                ${icons.search}
                <span class="sr-only">Search posters</span>
                <input id="event-posters-search" type="search" autocomplete="off" placeholder="Search title or ministry">
              </label>
              <label class="sr-only" for="event-posters-status">Filter by publication status</label>
              <select id="event-posters-status" class="event-posters-admin__status-filter">
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>
          </div>
          <div id="event-posters-feedback" class="event-posters-feedback" hidden role="alert"></div>
          <div class="admin-table-scroll">
            <table class="admin-table event-posters-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Poster</th>
                  <th scope="col">Event details</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody id="event-posters-table-body">
                ${this.renderLoadingRow()}
              </tbody>
            </table>
          </div>
        </section>
      </section>
      <div id="event-posters-toast" class="event-posters-toast" role="status" aria-live="polite" hidden></div>
    `;
  }

  renderLoadingRow() {
    return `<tr><td colspan="7"><div class="admin-empty">Loading event posters…</div></td></tr>`;
  }

  getFilteredPosters() {
    const query = this.filters.query.trim().toLocaleLowerCase();
    return this.sortPosters(this.posters).filter((poster) => {
      const matchesStatus = this.filters.status === 'all' || poster.status === this.filters.status;
      const searchable = [poster.title, poster.category, poster.description, poster.venue]
        .join(' ')
        .toLocaleLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }

  renderRows() {
    const posters = this.getFilteredPosters();
    if (!posters.length) {
      const isFiltered = this.posters.length > 0;
      return `<tr><td colspan="7"><div class="admin-empty event-posters-empty">
        ${icons.image}
        <strong>${isFiltered ? 'No posters match these filters' : 'No event posters yet'}</strong>
        <span>${isFiltered ? 'Try another search or status filter.' : 'Create the first one to show an announcement on the homepage.'}</span>
        ${isFiltered ? '' : '<button type="button" class="admin-btn admin-btn-primary" data-action="create">Add event poster</button>'}
      </div></td></tr>`;
    }

    const allPosters = this.sortPosters(this.posters);
    return posters.map((poster) => {
      const actualIndex = allPosters.findIndex((item) => item.id === poster.id);
      const canMoveUp = actualIndex > 0;
      const canMoveDown = actualIndex >= 0 && actualIndex < allPosters.length - 1;
      const statusLabel = poster.status === 'published' ? 'Published' : poster.status === 'unpublished' ? 'Unpublished' : 'Draft';
      const date = this.formatDateRange(poster);
      const thumbnail = poster.imageUrl
        ? `<img src="${escapeHtml(poster.imageUrl)}" alt="${escapeHtml(poster.title || 'Event poster')}" loading="lazy">`
        : `<span class="event-posters-thumb__missing">${icons.image}<span>Image unavailable</span></span>`;
      const publishAction = poster.status === 'published' ? 'unpublish' : 'publish';
      const publishLabel = poster.status === 'published' ? 'Unpublish' : 'Publish';

      return `
        <tr>
          <td>
            <div class="event-posters-order">
              <strong>${poster.displayOrder || actualIndex + 1}</strong>
              <div class="event-posters-order__actions" aria-label="Change ${escapeHtml(poster.title || 'poster')} order">
                <button type="button" class="event-posters-icon-button" data-action="move-up" data-id="${escapeHtml(poster.id)}" ${canMoveUp ? '' : 'disabled'} aria-label="Move up" title="Move up">${icons.up}</button>
                <button type="button" class="event-posters-icon-button" data-action="move-down" data-id="${escapeHtml(poster.id)}" ${canMoveDown ? '' : 'disabled'} aria-label="Move down" title="Move down">${icons.down}</button>
              </div>
            </div>
          </td>
          <td><div class="event-posters-thumb">${thumbnail}</div></td>
          <td>
            <div class="event-posters-title-cell">
              <strong>${escapeHtml(poster.title || 'Untitled poster')}</strong>
              ${poster.category ? `<span>${escapeHtml(poster.category)}</span>` : '<span>Uncategorised</span>'}
              ${poster.description ? `<small title="${escapeHtml(poster.description)}">${escapeHtml(this.truncate(poster.description, 88))}</small>` : ''}
            </div>
          </td>
          <td><span class="event-posters-date">${icons.calendar}${escapeHtml(date)}</span></td>
          <td><span class="event-posters-status event-posters-status--${poster.status}">${statusLabel}</span></td>
          <td><time datetime="${escapeHtml(poster.updatedAt || poster.createdAt || '')}">${escapeHtml(this.formatUpdated(poster.updatedAt || poster.createdAt))}</time></td>
          <td>
            <div class="event-posters-row-actions">
              <button type="button" class="admin-btn admin-btn-outline event-posters-publish-button" data-action="${publishAction}" data-id="${escapeHtml(poster.id)}">${publishLabel}</button>
              <button type="button" class="event-posters-icon-button" data-action="edit" data-id="${escapeHtml(poster.id)}" aria-label="Edit ${escapeHtml(poster.title || 'poster')}" title="Edit">${icons.edit}</button>
              <button type="button" class="event-posters-icon-button event-posters-icon-button--danger" data-action="delete" data-id="${escapeHtml(poster.id)}" aria-label="Delete ${escapeHtml(poster.title || 'poster')}" title="Delete">${icons.trash}</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  renderList() {
    if (!this.container) return;
    const tableBody = this.container.querySelector('#event-posters-table-body');
    const count = this.container.querySelector('#event-posters-result-count');
    if (tableBody) tableBody.innerHTML = this.renderRows();
    if (count) {
      const shown = this.getFilteredPosters().length;
      count.textContent = `${shown} of ${this.posters.length} poster${this.posters.length === 1 ? '' : 's'}`;
    }
    this.renderStats();
  }

  renderStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const published = this.posters.filter((poster) => poster.status === 'published').length;
    const drafts = this.posters.length - published;
    const upcoming = this.posters.filter((poster) => {
      if (!poster.eventDate) return false;
      const eventDate = new Date(`${poster.eventDate}T00:00:00`);
      return !Number.isNaN(eventDate.getTime()) && eventDate >= today;
    }).length;
    const values = {
      '#event-posters-total': this.posters.length,
      '#event-posters-published': published,
      '#event-posters-drafts': drafts,
      '#event-posters-upcoming': upcoming
    };
    Object.entries(values).forEach(([selector, value]) => {
      const element = this.container?.querySelector(selector);
      if (element) element.textContent = value;
    });
  }

  async loadPosters() {
    this.setFeedback('', '');
    const tableBody = this.container?.querySelector('#event-posters-table-body');
    if (tableBody) tableBody.innerHTML = this.renderLoadingRow();

    try {
      const payload = await this.request();
      const records = Array.isArray(payload) ? payload : payload.posters || [];
      this.posters = this.sortPosters(records.map((record) => this.normalisePoster(record)));
      this.renderList();
    } catch (error) {
      console.error('Failed to load event posters:', error);
      this.posters = [];
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="admin-empty event-posters-error-state">
          <strong>We could not load event posters.</strong>
          <span>${escapeHtml(error.message || 'Please try again.')}</span>
          <button type="button" class="admin-btn admin-btn-outline" data-action="retry">Try again</button>
        </div></td></tr>`;
      }
      const count = this.container?.querySelector('#event-posters-result-count');
      if (count) count.textContent = 'Unable to load posters';
      this.renderStats();
      this.setFeedback('The poster list could not be loaded. Please check your connection and try again.', 'error');
    }
  }

  bindEvents() {
    const searchInput = this.container?.querySelector('#event-posters-search');
    const statusSelect = this.container?.querySelector('#event-posters-status');
    searchInput?.addEventListener('input', (event) => {
      this.filters.query = event.target.value;
      this.renderList();
    });
    statusSelect?.addEventListener('change', (event) => {
      this.filters.status = event.target.value;
      this.renderList();
    });

    this.container?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || !this.container?.contains(button) || button.disabled) return;
      const { action, id } = button.dataset;

      if (action === 'create') this.openModal();
      if (action === 'retry') await this.loadPosters();
      if (action === 'edit') this.openModal(this.posters.find((poster) => poster.id === id));
      if (action === 'publish' || action === 'unpublish') await this.setPublication(id, action, button);
      if (action === 'move-up' || action === 'move-down') await this.movePoster(id, action === 'move-up' ? 'up' : 'down', button);
      if (action === 'delete') await this.deletePoster(id, button);
    });
  }

  async uploadImage(file) {
    const body = new FormData();
    body.append('file', file);
    const result = await this.request('/upload', { method: 'POST', body });
    const imageUrl = result.imageUrl || result.url;
    if (!imageUrl) throw new Error('The upload did not return an image URL.');
    return { imageUrl, storagePath: result.storagePath || '' };
  }

  validateImageFile(file) {
    if (!file) return '';
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return 'Choose a JPG, PNG, or WebP image.';
    if (file.size > MAX_IMAGE_BYTES) return 'The image must be 10 MB or smaller.';
    return '';
  }

  openModal(poster = null) {
    this.closeModal({ restoreFocus: false });
    this.editingPoster = poster || null;
    const isEditing = Boolean(poster);
    const status = poster?.status || 'draft';
    const imageUrl = poster?.imageUrl || '';
    const nextOrder = this.posters.length ? Math.max(...this.posters.map((item) => item.displayOrder || 0)) + 1 : 1;
    const dialog = document.createElement('div');
    dialog.id = 'event-poster-modal';
    dialog.className = 'event-poster-modal';
    dialog.innerHTML = `
      <div class="event-poster-modal__backdrop" data-modal-close></div>
      <section class="event-poster-modal__panel" role="dialog" aria-modal="true" aria-labelledby="event-poster-modal-title">
        <header class="event-poster-modal__header">
          <div>
            <p class="event-posters-admin__eyebrow">${isEditing ? 'Edit announcement' : 'New announcement'}</p>
            <h2 id="event-poster-modal-title">${isEditing ? 'Edit event poster' : 'Add event poster'}</h2>
          </div>
          <button type="button" class="event-posters-icon-button" data-modal-close aria-label="Close form">${icons.close}</button>
        </header>
        <form id="event-poster-form" class="event-poster-form" novalidate>
          <div id="event-poster-form-message" class="event-poster-form__message" hidden role="alert"></div>
          <div class="event-poster-form__grid">
            <label class="event-poster-field event-poster-field--wide">
              <span>Event title <b aria-hidden="true">*</b></span>
              <input name="title" type="text" maxlength="160" required value="${escapeHtml(poster?.title || '')}" placeholder="e.g. Youth Harvest Sunday">
            </label>
            <label class="event-poster-field">
              <span>Category / ministry</span>
              <input name="category" type="text" maxlength="100" value="${escapeHtml(poster?.category || '')}" placeholder="e.g. Baptist Youth Fellowship">
            </label>
            <label class="event-poster-field">
              <span>Publication status</span>
              <select name="status">
                <option value="draft" ${status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="published" ${status === 'published' ? 'selected' : ''}>Published</option>
                <option value="unpublished" ${status === 'unpublished' ? 'selected' : ''}>Unpublished</option>
              </select>
            </label>
            <label class="event-poster-field">
              <span>Event date</span>
              <input name="eventDate" type="date" value="${escapeHtml(poster?.eventDate || '')}">
            </label>
            <label class="event-poster-field">
              <span>End date <em>(optional)</em></span>
              <input name="eventEndDate" type="date" value="${escapeHtml(poster?.eventEndDate || '')}">
            </label>
            <label class="event-poster-field">
              <span>Start time <em>(optional)</em></span>
              <input name="startTime" type="time" value="${escapeHtml(poster?.startTime || '')}">
            </label>
            <label class="event-poster-field">
              <span>Display order</span>
              <input name="displayOrder" type="number" min="1" step="1" value="${poster?.displayOrder || nextOrder}">
            </label>
            <label class="event-poster-field event-poster-field--wide">
              <span>Short description</span>
              <textarea name="description" maxlength="500" rows="3" placeholder="A short introduction displayed beneath the event title.">${escapeHtml(poster?.description || '')}</textarea>
            </label>
            <label class="event-poster-field">
              <span>Venue / location</span>
              <input name="venue" type="text" maxlength="180" value="${escapeHtml(poster?.venue || '')}" placeholder="e.g. Centenary Baptist Church">
            </label>
            <label class="event-poster-field">
              <span>Contact information</span>
              <input name="contactInfo" type="text" maxlength="180" value="${escapeHtml(poster?.contactInfo || '')}" placeholder="Phone, email, or coordinator">
            </label>
          </div>

          <fieldset class="event-poster-image-field">
            <legend>Poster image ${isEditing ? '' : '<b aria-hidden="true">*</b>'}</legend>
            <div class="event-poster-image-field__content">
              <div id="event-poster-preview" class="event-poster-preview">
                ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Current poster preview">` : `<span>${icons.image}<small>Image preview</small></span>`}
              </div>
              <div class="event-poster-image-field__inputs">
                <label class="event-poster-upload-control">
                  <span>${icons.upload} Select JPG, PNG, or WebP</span>
                  <input id="event-poster-image-file" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp">
                </label>
                <small>Maximum upload size: 10 MB. A selected image is uploaded only when you save.</small>
                <label class="event-poster-field">
                  <span>Or use an existing image URL</span>
                  <input id="event-poster-image-url" name="imageUrl" type="url" value="${escapeHtml(imageUrl)}" placeholder="https://… or /images/posters/…">
                </label>
              </div>
            </div>
          </fieldset>
          <footer class="event-poster-modal__footer">
            <button type="button" class="admin-btn admin-btn-outline" data-modal-close>Cancel</button>
            <button type="submit" class="admin-btn admin-btn-primary" id="event-poster-save">${isEditing ? 'Save changes' : 'Create poster'}</button>
          </footer>
        </form>
      </section>`;

    document.body.append(dialog);
    document.body.classList.add('event-poster-modal-open');
    this.activeModal = dialog;

    dialog.querySelectorAll('[data-modal-close]').forEach((element) => {
      element.addEventListener('click', () => this.closeModal());
    });
    dialog.querySelector('#event-poster-form')?.addEventListener('submit', (event) => this.savePoster(event));
    dialog.querySelector('#event-poster-image-file')?.addEventListener('change', (event) => this.previewSelectedFile(event));
    dialog.querySelector('#event-poster-image-url')?.addEventListener('input', (event) => {
      if (dialog.querySelector('#event-poster-image-file')?.files?.length) return;
      this.updatePreview(event.target.value.trim());
    });
    document.addEventListener('keydown', this.onEscape);
    window.setTimeout(() => dialog.querySelector('[name="title"]')?.focus(), 0);
  }

  onEscape(event) {
    if (event.key === 'Escape' && this.activeModal) this.closeModal();
  }

  previewSelectedFile(event) {
    const file = event.target.files?.[0];
    const error = this.validateImageFile(file);
    if (error) {
      event.target.value = '';
      this.setFormMessage(error, 'error');
      return;
    }
    this.setFormMessage('', '');
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = URL.createObjectURL(file);
    this.updatePreview(this.previewObjectUrl);
  }

  updatePreview(url) {
    const preview = this.activeModal?.querySelector('#event-poster-preview');
    if (!preview) return;
    preview.innerHTML = url
      ? `<img src="${escapeHtml(url)}" alt="Selected poster preview">`
      : `<span>${icons.image}<small>Image preview</small></span>`;
  }

  setFormMessage(message, type = 'error') {
    const messageElement = this.activeModal?.querySelector('#event-poster-form-message');
    if (!messageElement) return;
    messageElement.textContent = message;
    messageElement.hidden = !message;
    messageElement.className = `event-poster-form__message${message ? ` event-poster-form__message--${type}` : ''}`;
  }

  async savePoster(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get('title') || '').trim();
    const eventDate = String(values.get('eventDate') || '');
    const eventEndDate = String(values.get('eventEndDate') || '');
    const imageFile = values.get('imageFile');
    let imageUrl = String(values.get('imageUrl') || '').trim();
    const saveButton = this.activeModal?.querySelector('#event-poster-save');

    if (!title) {
      this.setFormMessage('Enter an event title before saving.');
      form.querySelector('[name="title"]')?.focus();
      return;
    }
    if (eventDate && eventEndDate && eventEndDate < eventDate) {
      this.setFormMessage('The end date cannot be earlier than the event date.');
      return;
    }
    const file = imageFile instanceof File && imageFile.size ? imageFile : null;
    const imageError = this.validateImageFile(file);
    if (imageError) {
      this.setFormMessage(imageError);
      return;
    }
    if (!file && !imageUrl && !this.editingPoster?.imageUrl) {
      this.setFormMessage('Choose a poster image or provide an image URL.');
      return;
    }

    const originalLabel = saveButton?.textContent;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = file ? 'Uploading image…' : 'Saving…';
    }
    this.setFormMessage('', '');

    try {
      let storagePath = this.editingPoster?.storagePath || '';
      if (file) {
        const upload = await this.uploadImage(file);
        imageUrl = upload.imageUrl;
        storagePath = upload.storagePath;
        if (saveButton) saveButton.textContent = 'Saving…';
      }

      const payload = {
        title,
        category: String(values.get('category') || '').trim(),
        description: String(values.get('description') || '').trim(),
        eventDate: eventDate || null,
        eventEndDate: eventEndDate || null,
        startTime: String(values.get('startTime') || '') || null,
        venue: String(values.get('venue') || '').trim(),
        contactInfo: String(values.get('contactInfo') || '').trim(),
        imageUrl: imageUrl || this.editingPoster?.imageUrl || '',
        storagePath,
        status: String(values.get('status') || 'draft'),
        displayOrder: Math.max(1, Number.parseInt(String(values.get('displayOrder') || ''), 10) || this.nextDisplayOrder())
      };

      if (this.editingPoster) {
        await this.request(`/${encodeURIComponent(this.editingPoster.id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        this.showToast('Event poster updated successfully.', 'success');
      } else {
        await this.request('', { method: 'POST', body: JSON.stringify(payload) });
        this.showToast('Event poster created successfully.', 'success');
      }
      this.closeModal({ restoreFocus: false });
      await this.loadPosters();
    } catch (error) {
      console.error('Failed to save event poster:', error);
      this.setFormMessage(error.message || 'The poster could not be saved. Please try again.');
    } finally {
      if (saveButton?.isConnected) {
        saveButton.disabled = false;
        saveButton.textContent = originalLabel;
      }
    }
  }

  nextDisplayOrder() {
    return this.posters.length ? Math.max(...this.posters.map((poster) => poster.displayOrder || 0)) + 1 : 1;
  }

  async setPublication(id, action, button) {
    const poster = this.posters.find((item) => item.id === id);
    if (!poster) return;
    this.setButtonBusy(button, true, action === 'publish' ? 'Publishing…' : 'Unpublishing…');
    try {
      await this.request(`/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      this.showToast(action === 'publish' ? 'Poster is now published.' : 'Poster has been unpublished.', 'success');
      await this.loadPosters();
    } catch (error) {
      console.error(`Failed to ${action} poster:`, error);
      this.showToast(error.message || `Unable to ${action} this poster.`, 'error');
    } finally {
      if (button?.isConnected) this.setButtonBusy(button, false);
    }
  }

  async movePoster(id, direction, button) {
    const ordered = this.sortPosters(this.posters);
    const index = ordered.findIndex((poster) => poster.id === id);
    const destination = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || destination < 0 || destination >= ordered.length) return;
    [ordered[index], ordered[destination]] = [ordered[destination], ordered[index]];
    const orderedIds = ordered.map((poster) => poster.id);

    this.setButtonBusy(button, true);
    try {
      await this.request('/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds }) });
      this.showToast('Poster order updated.', 'success');
      await this.loadPosters();
    } catch (error) {
      console.error('Failed to reorder event posters:', error);
      this.showToast(error.message || 'Unable to update poster order.', 'error');
    } finally {
      if (button?.isConnected) this.setButtonBusy(button, false);
    }
  }

  async deletePoster(id, button) {
    const poster = this.posters.find((item) => item.id === id);
    if (!poster) return;
    const confirmed = window.confirm(`Delete “${poster.title || 'this event poster'}”? This cannot be undone.`);
    if (!confirmed) return;

    this.setButtonBusy(button, true);
    try {
      await this.request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
      this.showToast('Event poster deleted.', 'success');
      await this.loadPosters();
    } catch (error) {
      console.error('Failed to delete event poster:', error);
      this.showToast(error.message || 'Unable to delete this poster.', 'error');
    } finally {
      if (button?.isConnected) this.setButtonBusy(button, false);
    }
  }

  setButtonBusy(button, busy, busyLabel = '') {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.disabled = true;
      if (busyLabel) button.textContent = busyLabel;
      return;
    }
    button.disabled = false;
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }

  setFeedback(message, type) {
    const feedback = this.container?.querySelector('#event-posters-feedback');
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.className = `event-posters-feedback${message ? ` event-posters-feedback--${type}` : ''}`;
  }

  showToast(message, type = 'success') {
    const toast = this.container?.querySelector('#event-posters-toast');
    if (!toast) return;
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toast.className = `event-posters-toast event-posters-toast--${type}`;
    this.toastTimer = window.setTimeout(() => { if (toast.isConnected) toast.hidden = true; }, 4200);
  }

  closeModal({ restoreFocus = true } = {}) {
    const dialog = this.activeModal || document.getElementById('event-poster-modal');
    if (!dialog) return;
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
    dialog.remove();
    document.body.classList.remove('event-poster-modal-open');
    document.removeEventListener('keydown', this.onEscape);
    this.activeModal = null;
    this.editingPoster = null;
    if (restoreFocus) this.container?.querySelector('[data-action="create"]')?.focus();
  }

  truncate(text, maxLength) {
    const value = String(text || '');
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }

  formatDateRange(poster) {
    if (!poster.eventDate) return 'Date to be announced';
    const start = this.formatDate(poster.eventDate);
    if (!poster.eventEndDate || poster.eventEndDate === poster.eventDate) return start;
    return `${start} – ${this.formatDate(poster.eventEndDate)}`;
  }

  formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'Date to be announced';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  formatUpdated(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
}

// The explicit name makes future imports clearer without breaking the older
// lazy-router export that already points at this file.
export { AdminPosters as AdminEventPosters };
