import './PosterCarousel.css';
import { API_BASE } from '../apiConfig.js';
import { getCurrentLang, t } from '../i18n.js';

const AUTOPLAY_DELAY = 3500;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const text = (key, fallback) => {
  const translated = t(key);
  return translated && translated !== key ? translated : fallback;
};

const localeForLanguage = (language) => ({
  te: 'te-IN',
  hi: 'hi-IN',
  en: 'en-IN'
}[language] || 'en-IN');

function safeImageUrl(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function normalisePoster(record) {
  const image = safeImageUrl(record?.image_url || record?.imageUrl || record?.image);
  if (!image) return null;
  return {
    id: String(record.id || image),
    title: String(record.title || record.event_title || 'Church event'),
    category: String(record.category || record.ministry || record.subtitle || ''),
    description: String(record.description || ''),
    image,
    eventDate: record.event_date || record.eventDate || null,
    eventEndDate: record.event_end_date || record.eventEndDate || null,
    startTime: record.start_time || record.startTime || null,
    customDateText: record.custom_date_text || record.customDateText || null,
    dateNote: record.date_note || record.dateNote || null,
    isUnverified: Boolean(record.is_unverified || record.isUnverified),
    displayOrder: Number(record.display_order ?? record.displayOrder ?? record.order ?? 0),
    createdAt: record.created_at || record.createdAt || ''
  };
}

function isPublished(record) {
  return String(record?.status || '').toLowerCase() === 'published';
}

function comparePosters(a, b) {
  const aOrder = Number.isFinite(a.displayOrder) ? a.displayOrder : 0;
  const bOrder = Number.isFinite(b.displayOrder) ? b.displayOrder : 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.createdAt).localeCompare(String(b.createdAt));
}

function asLocalDate(value) {
  if (!value) return null;
  const simpleDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (simpleDate) {
    const [, year, month, day] = simpleDate;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Local poster images shipped with the site – used as a fallback when the
// Supabase API is unavailable (e.g. table not yet created, network error).
// Dates precisely reflect original artwork; Day of Prayer is flagged for admin review.
const DEFAULT_FALLBACK_POSTERS = [
  {
    id: 'local-poster-1',
    title: 'Youth Harvest Sunday 2026',
    category: 'Baptist Youth Fellowship',
    description: 'Celebrating God\'s Abundant Blessings · Stalls & Fellowship',
    image: '/images/posters/poster-3.jpeg',
    imageUrl: '/images/posters/poster-3.jpeg',
    eventDate: '2026-10-18',
    startTime: 'After 9:30 AM Telugu Service',
    customDateText: 'Sun, 18 Oct 2026 · After 9:30 AM Service',
    isUnverified: false,
    status: 'published',
    displayOrder: 1,
    createdAt: ''
  },
  {
    id: 'local-poster-2',
    title: 'Day of Prayer',
    category: 'Prayer Committee',
    description: 'All Church Pastors · A wonderful opportunity to spend time in God\'s presence',
    image: '/images/posters/poster-1.jpeg',
    imageUrl: '/images/posters/poster-1.jpeg',
    eventDate: null,
    startTime: null,
    customDateText: 'Sat, 31 Oct · 10:00 AM – 4:00 PM',
    dateNote: 'Flagged for Admin Review',
    isUnverified: true,
    status: 'published',
    displayOrder: 2,
    createdAt: ''
  },
  {
    id: 'local-poster-3',
    title: 'Candlelight Service Choir Auditions',
    category: 'Choir & Music Ministry',
    description: 'CLS Choir & Kids CLS Choir · Annual Christmas Choir Preparations',
    image: '/images/posters/poster-2.jpeg',
    imageUrl: '/images/posters/poster-2.jpeg',
    eventDate: '2026-10-17',
    eventEndDate: '2026-10-18',
    customDateText: '17 & 18 Oct · Sat 5–7 PM | Sun 2:30–4:30 PM',
    isUnverified: false,
    status: 'published',
    displayOrder: 3,
    createdAt: ''
  }
];

/**
 * A lightweight, accessible public carousel for published event-poster records.
 * Falls back to local poster images when the API is unavailable.
 */
export class PosterCarousel {
  constructor(containerTarget, { endpoint = `${API_BASE}/event-posters` } = {}) {
    this.container = typeof containerTarget === 'string'
      ? document.querySelector(containerTarget)
      : containerTarget;
    this.endpoint = endpoint;
    this.posters = [];
    this.positions = [];
    this.activePosition = 0;
    this.isLoading = true;
    this.error = null;
    this.autoTimer = null;
    this.resumeTimer = null;
    this.interactionPaused = false;
    this.explicitlyPaused = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    this.lightboxOpen = false;
    this.lastFocusedElement = null;
    this.abortController = null;
    this.renderListeners = [];
    this.dragStartX = null;
    this.didDrag = false;
    this.inViewport = true;
    this.viewportObserver = null;

    this.onDocumentKeydown = this.onDocumentKeydown.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onPostersUpdated = this.onPostersUpdated.bind(this);
    this.onLanguageChange = this.onLanguageChange.bind(this);

    if (this.container) this.init();
  }

  init() {
    document.addEventListener('keydown', this.onDocumentKeydown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('eventPostersUpdated', this.onPostersUpdated);
    window.addEventListener('langChange', this.onLanguageChange);

    if ('IntersectionObserver' in window && this.container) {
      this.viewportObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          this.inViewport = entry.isIntersecting;
          if (this.inViewport) {
            this.refreshMetrics();
            this.startAutoplay();
          } else {
            this.stopAutoplay();
          }
        });
      }, { threshold: 0.1 });
      this.viewportObserver.observe(this.container);
    }

    this.render();
    this.load();
  }

  async load() {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.isLoading = true;
    this.error = null;
    this.render();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(this.endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`API error (${response.status})`);

      const payload = await response.json();
      const records = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : payload?.posters || []);

      const apiPosters = records
        .filter(isPublished)
        .map(normalisePoster)
        .filter(Boolean)
        .sort(comparePosters);

      // Use API data if available; otherwise fall back to local images
      this.posters = apiPosters.length > 0 ? apiPosters : DEFAULT_FALLBACK_POSTERS.map(normalisePoster).filter(Boolean);
      this.activePosition = 0;
    } catch (error) {
      if (error.name === 'AbortError' && this.abortController?.signal.aborted) return;
      // API unavailable — show local poster images so the section is never empty
      console.warn('[PosterCarousel] API unavailable, using local fallback posters:', error.message);
      this.posters = DEFAULT_FALLBACK_POSTERS.map(normalisePoster).filter(Boolean);
      this.error = null; // clear error so we render slides not the error panel
      this.activePosition = 0;
    } finally {
      if (!this.abortController?.signal.aborted) {
        this.isLoading = false;
        this.render();
      }
    }
  }

  onPostersUpdated() { this.load(); }
  onLanguageChange() { this.render(); }

  render() {
    this.stopAutoplay();
    this.removeRenderListeners();
    if (!this.container) return;
    const header = this.renderHeader();

    if (this.isLoading) {
      this.container.innerHTML = `
        <section class="poster-section-wrapper" aria-labelledby="poster-section-title" aria-busy="true">
          ${header}
          <div class="poster-state poster-state--loading" role="status" aria-live="polite">
            <span class="poster-loading-mark" aria-hidden="true"></span>
            <p>Loading church events and announcements…</p>
          </div>
        </section>`;
      return;
    }

    if (this.error) {
      this.container.innerHTML = `
        <section class="poster-section-wrapper" aria-labelledby="poster-section-title">
          ${header}
          <div class="poster-state poster-state--error" role="alert">
            <p>We could not load the latest announcements. Please try again.</p>
            <button type="button" class="poster-retry-btn" data-poster-action="retry">${escapeHtml(text('retry', 'Retry'))}</button>
          </div>
        </section>`;
      this.bindStatusActions();
      return;
    }

    if (!this.posters.length) {
      this.container.innerHTML = `
        <section class="poster-section-wrapper" aria-labelledby="poster-section-title">
          ${header}
          <div class="poster-state poster-state--empty" role="status">
            <p>There are no published announcements at the moment. Please check back soon.</p>
          </div>
        </section>`;
      return;
    }

    // For a multi-card carousel showing at least 3 cards at a time,
    // duplicate posters if fewer than 6 so the track can scroll smoothly across all cards
    let displayItems = this.posters;
    if (displayItems.length > 0 && displayItems.length < 6) {
      displayItems = [...displayItems, ...displayItems];
      if (displayItems.length < 6) {
        displayItems = [...displayItems, ...this.posters];
      }
    }
    const slides = displayItems.map((poster, index) => this.renderPoster(poster, index)).join('');
    this.container.innerHTML = `
      <section class="poster-section-wrapper" aria-labelledby="poster-section-title">
        <div class="poster-section-inner">
          ${header}
          <div class="poster-carousel-stage" aria-roledescription="carousel" aria-label="Church events and announcements">
            <button type="button" class="poster-nav-btn poster-nav-btn--prev" data-poster-action="previous" aria-label="Previous posters" hidden>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div class="poster-viewport" id="poster-carousel-viewport" tabindex="0" aria-label="Church event posters">
              <div class="poster-track">${slides}</div>
            </div>
            <button type="button" class="poster-nav-btn poster-nav-btn--next" data-poster-action="next" aria-label="Next posters" hidden>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div class="poster-pagination" role="tablist" aria-label="Poster carousel pagination" hidden></div>
        </div>
      </section>
      <div class="poster-lightbox" role="dialog" aria-modal="true" aria-label="Poster viewer" aria-hidden="true">
        <div class="poster-lightbox-dialog" role="document">
          <button type="button" class="poster-lightbox-close" data-poster-action="close" aria-label="Close poster viewer"><span aria-hidden="true">×</span></button>
          <img class="poster-lightbox-image" src="" alt="" />
          <p class="poster-lightbox-caption"></p>
        </div>
      </div>`;

    this.viewport = this.container.querySelector('.poster-viewport');
    this.slides = Array.from(this.container.querySelectorAll('.poster-slide'));
    this.previousButton = this.container.querySelector('.poster-nav-btn--prev');
    this.nextButton = this.container.querySelector('.poster-nav-btn--next');
    this.pagination = this.container.querySelector('.poster-pagination');
    this.stage = this.container.querySelector('.poster-carousel-stage');
    this.lightbox = this.container.querySelector('.poster-lightbox');
    this.lightboxImage = this.container.querySelector('.poster-lightbox-image');
    this.lightboxCaption = this.container.querySelector('.poster-lightbox-caption');
    this.lightboxClose = this.container.querySelector('.poster-lightbox-close');
    this.bindCarouselEvents();
    // Compute scroll positions. Since the section may be off-screen at render
    // time, retry until the viewport reports real dimensions.
    this._scheduleMetricsRefresh();
  }

  _scheduleMetricsRefresh(attempts = 0) {
    requestAnimationFrame(() => {
      if (!this.viewport) return;
      if (this.viewport.clientWidth > 0) {
        this.refreshMetrics();
      } else if (attempts < 20) {
        // Section is off-screen; retry in 150 ms
        setTimeout(() => this._scheduleMetricsRefresh(attempts + 1), 150);
      }
    });
  }

  renderHeader() {
    return `
      <div class="poster-header">
        <p class="poster-eyebrow"><span></span>${escapeHtml(text('posterEyebrow', 'CENTENARY BAPTIST CHURCH · SECUNDERABAD'))}<span></span></p>
        <h2 class="poster-title" id="poster-section-title">${escapeHtml(text('posterTitle', 'Church Events & Announcements'))}</h2>
        <p class="poster-subtitle">${escapeHtml(text('posterSubtitle', 'Stay connected with our church family and be a part of our upcoming events, ministries and celebrations.'))}</p>
        <div class="poster-ornament" aria-hidden="true"><span></span><svg viewBox="0 0 24 24"><path d="M10.25 22h3.5v-8h3.5L12 2 6.75 14h3.5v8Zm1.75-16.12 1.67 6.37h-3.34L12 5.88Z"/></svg><span></span></div>
      </div>`;
  }

  renderPoster(poster, index) {
    const originalIndex = index % this.posters.length;
    const dateText = poster.customDateText || (poster.eventDate ? this.formatDate(poster.eventDate, poster.eventEndDate) : '');
    const timeText = !poster.customDateText && poster.startTime ? ` · <span class="poster-card-time">${escapeHtml(poster.startTime)}</span>` : '';
    const description = poster.description ? `<p class="poster-card-description">${escapeHtml(poster.description)}</p>` : '';

    let dateBadge = '';
    if (dateText || poster.dateNote) {
      dateBadge = `
        <span class="poster-card-date ${poster.isUnverified ? 'poster-card-date--unverified' : ''}">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
          </svg>
          <span class="poster-date-main">${escapeHtml(dateText)}${timeText}</span>
          ${poster.dateNote ? `<span class="poster-review-tag" title="Date/weekday discrepancy in artwork — flagged for administrator review"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${escapeHtml(poster.dateNote)}</span>` : ''}
        </span>`;
    }

    return `
      <article class="poster-slide" data-poster-index="${originalIndex}" role="group" aria-roledescription="slide" aria-label="${originalIndex + 1} of ${this.posters.length}">
        <button type="button" class="poster-card" data-poster-action="open" data-poster-index="${originalIndex}" aria-haspopup="dialog" aria-label="${escapeHtml(`View poster: ${poster.title}`)}">
          <span class="poster-image-frame"><img src="${escapeHtml(poster.image)}" alt="${escapeHtml(poster.title)}" loading="lazy" decoding="async" /></span>
          <span class="poster-card-content">
            ${dateBadge}
            <strong class="poster-card-title">${escapeHtml(poster.title)}</strong>
            ${poster.category ? `<span class="poster-card-category">${escapeHtml(poster.category)}</span>` : ''}
            ${description}
            <span class="poster-view-action">${escapeHtml(text('clickToZoom', 'VIEW POSTER'))} <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path d="M5 12h13M13 6l6 6-6 6"/></svg></span>
          </span>
        </button>
      </article>`;
  }

  formatDate(start, end) {
    const first = asLocalDate(start);
    const last = asLocalDate(end);
    if (!first) return '';
    const formatter = new Intl.DateTimeFormat(localeForLanguage(getCurrentLang()), { day: '2-digit', month: 'short', year: 'numeric' });
    const firstText = formatter.format(first);
    return last && last.getTime() !== first.getTime() ? `${firstText} – ${formatter.format(last)}` : firstText;
  }

  bindStatusActions() {
    const retry = this.container.querySelector('[data-poster-action="retry"]');
    if (retry) this.listen(retry, 'click', () => this.load());
  }

  bindCarouselEvents() {
    const onClick = (event) => {
      const button = event.target.closest('[data-poster-action]');
      if (!button || !this.container.contains(button)) return;
      const action = button.dataset.posterAction;
      if (action === 'previous') {
        this.pauseBriefly();
        this.goToPosition(this.activePosition - 1);
      } else if (action === 'next') {
        this.pauseBriefly();
        this.goToPosition(this.activePosition + 1);
      } else if (action === 'open' && !this.didDrag) {
        this.openLightbox(Number(button.dataset.posterIndex));
      } else if (action === 'close') {
        this.closeLightbox();
      }
    };
    const onPaginationClick = (event) => {
      const dot = event.target.closest('[data-poster-position]');
      if (!dot) return;
      this.pauseBriefly();
      this.goToPosition(Number(dot.dataset.posterPosition));
    };
    const onScroll = () => {
      if (this.scrollFrame) return;
      this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = null;
        this.syncActivePosition();
      });
    };
    const onKeydown = (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault(); this.pauseBriefly(); this.goToPosition(this.activePosition + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault(); this.pauseBriefly(); this.goToPosition(this.activePosition - 1);
      } else if (event.key === 'Home') {
        event.preventDefault(); this.pauseBriefly(); this.goToPosition(0);
      } else if (event.key === 'End') {
        event.preventDefault(); this.pauseBriefly(); this.goToPosition(this.positions.length - 1);
      }
    };
    const onPointerDown = (event) => {
      this.dragStartX = event.clientX;
      this.didDrag = false;
      this.pauseForInteraction();
    };
    const onPointerMove = (event) => {
      if (this.dragStartX !== null && Math.abs(event.clientX - this.dragStartX) > 8) this.didDrag = true;
    };
    const onPointerEnd = () => {
      this.dragStartX = null;
      window.setTimeout(() => { this.didDrag = false; }, 0);
      this.resumeAfterInteraction(3500);
    };
    const onFocusOut = (event) => {
      if (!this.stage.contains(event.relatedTarget)) this.resumeAfterInteraction(1000);
    };
    const onMouseEnter = () => {
      this.pauseForInteraction();
    };
    const onMouseLeave = () => {
      this.resumeAfterInteraction(1200);
    };

    this.listen(this.container, 'click', onClick);
    this.listen(this.pagination, 'click', onPaginationClick);
    this.listen(this.viewport, 'scroll', onScroll, { passive: true });
    this.listen(this.viewport, 'keydown', onKeydown);
    // Pause autoplay on hover per client instruction
    this.listen(this.stage, 'mouseenter', onMouseEnter);
    this.listen(this.stage, 'mouseleave', onMouseLeave);
    this.listen(this.stage, 'focusout', onFocusOut);
    this.listen(this.viewport, 'pointerdown', onPointerDown, { passive: true });
    this.listen(this.viewport, 'pointermove', onPointerMove, { passive: true });
    this.listen(this.viewport, 'pointerup', onPointerEnd, { passive: true });
    this.listen(this.viewport, 'pointercancel', onPointerEnd, { passive: true });
    this.listen(this.lightbox, 'click', (event) => { if (event.target === this.lightbox) this.closeLightbox(); });
  }

  listen(target, eventName, handler, options) {
    target?.addEventListener(eventName, handler, options);
    this.renderListeners.push({ target, eventName, handler, options });
  }

  removeRenderListeners() {
    this.renderListeners.forEach(({ target, eventName, handler, options }) => target?.removeEventListener(eventName, handler, options));
    this.renderListeners = [];
  }

  refreshMetrics() {
    if (!this.viewport || !this.slides?.length) return;
    const maxScroll = Math.max(0, this.viewport.scrollWidth - this.viewport.clientWidth);
    const positions = [];
    const count = this.posters.length;
    for (let i = 0; i < count; i++) {
      const slide = this.slides[i];
      if (slide) {
        const left = Math.min(Math.max(0, slide.offsetLeft), maxScroll);
        if (!positions.some((pos) => Math.abs(pos - left) < 4)) {
          positions.push(left);
        }
      }
    }
    // Fallback if layout hasn't resolved yet
    if (positions.length <= 1 && this.slides.length > 1 && this.viewport.clientWidth > 0 && maxScroll > 0) {
      const card = this.slides[0];
      const step = card ? card.offsetWidth + 20 : Math.round(this.viewport.clientWidth / 3);
      for (let i = 0; i < count; i++) {
        const left = Math.min(i * step, maxScroll);
        if (!positions.some((pos) => Math.abs(pos - left) < 4)) {
          positions.push(left);
        }
      }
    }
    this.positions = positions.length ? positions : [0];
    this.activePosition = Math.min(this.activePosition, this.positions.length - 1);
    this.previousButton.hidden = this.positions.length <= 1;
    this.nextButton.hidden = this.positions.length <= 1;
    this.pagination.hidden = this.positions.length <= 1;
    this.renderPagination();
    this.goToPosition(this.activePosition, 'auto');
    this.startAutoplay();
  }

  renderPagination() {
    if (!this.pagination) return;
    this.pagination.innerHTML = this.positions.map((_, index) => `
      <button type="button" class="poster-dot ${index === this.activePosition ? 'is-active' : ''}" role="tab"
        aria-selected="${index === this.activePosition}" aria-controls="poster-carousel-viewport"
        aria-label="Show poster position ${index + 1} of ${this.positions.length}" data-poster-position="${index}"></button>`).join('');
  }

  syncActivePosition() {
    if (!this.viewport || !this.positions.length) return;
    const scrollLeft = this.viewport.scrollLeft;
    const closest = this.positions.reduce((best, position, index) => (
      Math.abs(position - scrollLeft) < Math.abs(this.positions[best] - scrollLeft) ? index : best
    ), 0);
    if (closest !== this.activePosition) {
      this.activePosition = closest;
      this.updatePagination();
    }
  }

  updatePagination() {
    this.pagination?.querySelectorAll('.poster-dot').forEach((dot, index) => {
      const active = index === this.activePosition;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
    });
  }

  goToPosition(index, behavior = 'smooth') {
    if (!this.viewport || !this.positions.length) return;
    const count = this.positions.length;

    // Handle seamless forward wrap
    if (index >= count) {
      const loopSlide = this.slides[count];
      const nextLeft = loopSlide ? loopSlide.offsetLeft : (this.positions[count - 1] + (this.slides[0]?.offsetWidth || 300) + 20);
      this.viewport.scrollTo({ left: nextLeft, behavior });
      this.activePosition = 0;
      this.updatePagination();

      window.setTimeout(() => {
        if (this.viewport && this.activePosition === 0) {
          this.viewport.scrollTo({ left: this.positions[0], behavior: 'auto' });
        }
      }, 550);
      return;
    }

    this.activePosition = ((index % count) + count) % count;
    this.viewport.scrollTo({ left: this.positions[this.activePosition], behavior });
    this.updatePagination();
  }

  startAutoplay() {
    this.stopAutoplay();
    if (this.positions.length <= 1 || this.explicitlyPaused || this.interactionPaused || document.hidden || this.lightboxOpen || !this.inViewport) return;
    this.autoTimer = window.setTimeout(() => {
      this.goToPosition(this.activePosition + 1);
      this.startAutoplay();
    }, AUTOPLAY_DELAY);
  }

  stopAutoplay() {
    if (this.autoTimer) {
      window.clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  pauseForInteraction() {
    this.interactionPaused = true;
    this.stopAutoplay();
  }

  resumeAfterInteraction(delay = 0) {
    window.clearTimeout(this.resumeTimer);
    this.resumeTimer = window.setTimeout(() => {
      this.interactionPaused = false;
      this.startAutoplay();
    }, delay);
  }

  pauseBriefly() {
    this.pauseForInteraction();
    this.resumeAfterInteraction(AUTOPLAY_DELAY + 1000);
  }

  onResize() {
    if (!this.viewport) return;
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.refreshMetrics(), 120);
  }

  onVisibilityChange() {
    if (document.hidden) this.stopAutoplay();
    else this.startAutoplay();
  }

  openLightbox(index) {
    const poster = this.posters[index % this.posters.length];
    if (!poster || !this.lightbox) return;
    this.pauseForInteraction();
    this.lightboxOpen = true;
    this.lastFocusedElement = document.activeElement;
    this.lightboxImage.src = poster.image;
    this.lightboxImage.alt = poster.title;
    this.lightboxCaption.textContent = poster.category ? `${poster.title} — ${poster.category}` : poster.title;
    this.lightbox.classList.add('is-open');
    this.lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('poster-lightbox-open');
    requestAnimationFrame(() => this.lightboxClose?.focus());
  }

  closeLightbox() {
    if (!this.lightbox || !this.lightboxOpen) return;
    this.lightboxOpen = false;
    this.lightbox.classList.remove('is-open');
    this.lightbox.setAttribute('aria-hidden', 'true');
    this.lightboxImage.removeAttribute('src');
    document.body.classList.remove('poster-lightbox-open');
    this.lastFocusedElement?.focus?.();
    this.lastFocusedElement = null;
    this.resumeAfterInteraction(400);
  }

  onDocumentKeydown(event) {
    if (!this.lightboxOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeLightbox();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.lightboxClose?.focus();
    }
  }

  destroy() {
    this.abortController?.abort();
    this.closeLightbox();
    this.stopAutoplay();
    window.clearTimeout(this.resumeTimer);
    window.clearTimeout(this.resizeTimer);
    if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
    this.removeRenderListeners();
    document.removeEventListener('keydown', this.onDocumentKeydown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('eventPostersUpdated', this.onPostersUpdated);
    window.removeEventListener('langChange', this.onLanguageChange);
    this.viewportObserver?.disconnect();
    document.body.classList.remove('poster-lightbox-open');
  }
}
