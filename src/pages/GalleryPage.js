import { API_BASE } from '../apiConfig.js';
import { t } from '../i18n.js';
export class GalleryPage {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.images = [];
    this.filtered = [];
    this.activeCategory = 'all';
    this.lightboxIndex = 0;
    this.API_URL = `${API_BASE}/gallery`;
    this.page = 1;
    this.hasMore = true;
    this._keyboardBound = false;
    this._onKeydown = (e) => {
      const lightbox = document.getElementById('gal-lb');
      if (!lightbox?.classList.contains('open')) return;
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') {
        this.lightboxIndex = (this.lightboxIndex - 1 + this.filtered.length) % this.filtered.length;
        this.updateLightbox();
      }
      if (e.key === 'ArrowRight') {
        this.lightboxIndex = (this.lightboxIndex + 1) % this.filtered.length;
        this.updateLightbox();
      }
    };
    window.addEventListener('langChange', () => this.refreshLocale());
  }

  async render() {
    document.title = `${t('navGallery')} | Centenary Baptist Church, Secunderabad`;
    this.renderShell();
    this.bindEvents();
    await this.fetchImages();
    this.renderGrid();
  }

  refreshLocale() {
    if (window.location.hash !== '#/gallery') return;

    document.title = `${t('navGallery')} | Centenary Baptist Church, Secunderabad`;
    const lightbox = document.getElementById('gal-lb');
    const wasOpen = lightbox?.classList.contains('open');
    this.renderShell({ scroll: false });
    this.renderGrid();
    this.bindEvents();

    if (wasOpen && this.filtered.length) {
      this.lightboxIndex = Math.min(this.lightboxIndex, this.filtered.length - 1);
      this.openLightbox(this.lightboxIndex);
    }
  }

  async fetchImages(append = false) {
    if (!this.hasMore && append) return;
    try {
      const res = await fetch(`${this.API_URL}?page=${this.page}&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      
      if (data.length < 20) this.hasMore = false;
      
      if (append) {
        this.images = [...this.images, ...data];
      } else {
        this.images = data;
      }
      this.filterBy(this.activeCategory, false);
    } catch (err) {
      console.error('Gallery fetch error:', err);
      if (!append) {
        this.images = [];
        this.filtered = [];
      }
    }
  }

  getCategories() {
    const cats = ['all', ...new Set(this.images.map(i => i.category).filter(Boolean))];
    return cats;
  }

  filterBy(cat, render = true) {
    this.activeCategory = cat;
    this.filtered = cat === 'all' ? [...this.images] : this.images.filter(i => i.category === cat);
    if (render) {
      this.renderGrid();
      this.renderFilters();
    }
  }

  renderShell({ scroll = true } = {}) {
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    this.container.innerHTML = `
      <style>
        .gal-hero {
          position: relative;
          background: url('/new_gallery_image.png') center center / cover no-repeat;
          padding: 100px 24px 80px;
          text-align: center;
          overflow: hidden;
        }
        .gal-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0, 20, 15, 0.72) 0%,
            rgba(0, 30, 20, 0.68) 60%,
            rgba(0, 20, 15, 0.80) 100%
          );
        }
        .gal-hero-content { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
        .gal-hero-label {
          display: inline-block;
          background: rgba(201,168,76,0.2);
          border: 1px solid rgba(201,168,76,0.5);
          color: #C9A84C;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          padding: 6px 18px;
          border-radius: 20px;
          margin-bottom: 20px;
        }
        .gal-hero h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(36px, 6vw, 56px);
          color: white;
          margin: 0 0 16px;
          line-height: 1.15;
        }
        .gal-hero p {
          color: rgba(255,255,255,0.75);
          font-size: 16px;
          line-height: 1.7;
          margin: 0;
        }
        .gal-hero-gold { color: #C9A84C; }

        .gal-body { background: #F8F7F2; min-height: 400px; padding: 60px 24px 80px; }
        .gal-inner { max-width: 1200px; margin: 0 auto; }

        /* Filter pills */
        .gal-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 40px; justify-content: center; }
        .gal-filter-btn {
          padding: 8px 22px;
          border-radius: 24px;
          border: 1.5px solid #d1d5db;
          background: white;
          color: #6b7280;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          text-transform: capitalize;
        }
        .gal-filter-btn:hover { border-color: #003F3A; color: #003F3A; }
        .gal-filter-btn.active { background: #003F3A; border-color: #003F3A; color: white; }

        /* Stats bar */
        .gal-stats {
          text-align: center;
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 32px;
        }
        .gal-stats strong { color: #003F3A; }

        /* Grid */
        .gal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .gal-item {
          border-radius: 14px;
          overflow: hidden;
          background: white;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          cursor: pointer;
          transition: transform 0.25s, box-shadow 0.25s;
          position: relative;
        }
        .gal-item:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.14); }
        .gal-item-img {
          width: 100%;
          height: 220px;
          object-fit: cover;
          display: block;
          background: #e5e7eb;
          transition: transform 0.4s ease;
        }
        .gal-item:hover .gal-item-img { transform: scale(1.04); }
        .gal-item-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%);
          opacity: 0;
          transition: 0.3s;
          display: flex;
          align-items: flex-end;
          padding: 16px;
        }
        .gal-item:hover .gal-item-overlay { opacity: 1; }
        .gal-item-overlay-icon {
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.95);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
        }
        .gal-item-info { padding: 14px 16px; }
        .gal-item-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }
        .gal-item-cat {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          padding: 2px 10px;
          border-radius: 10px;
          background: #e6f6ee;
          color: #16805B;
        }
        .gal-cat-worship { background: #e6f6ee; color: #16805B; }
        .gal-cat-youth { background: #ede9fe; color: #7c3aed; }
        .gal-cat-events { background: #fef9c3; color: #b45309; }
        .gal-cat-general { background: #e0f2fe; color: #0369a1; }

        .gal-empty {
          grid-column: 1/-1;
          text-align: center;
          padding: 80px 20px;
          color: #9ca3af;
        }
        .gal-empty svg { width: 60px; height: 60px; color: #d1d5db; margin-bottom: 16px; }
        .gal-empty h3 { font-size: 18px; color: #4b5563; margin: 0 0 8px; }

        /* ── LIGHTBOX ─────────────────────────────────── */
        .gal-lb {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.94);
          z-index: 99999;
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .gal-lb.open { display: flex; }
        .gal-lb-img {
          max-width: 90vw;
          max-height: 78vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          animation: lbFadeIn 0.2s ease;
        }
        @keyframes lbFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .gal-lb-meta { margin-top: 18px; text-align: center; }
        .gal-lb-title { color: white; font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .gal-lb-cat { color: rgba(255,255,255,0.5); font-size: 12px; text-transform: capitalize; }
        .gal-lb-counter { color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 4px; }
        .gal-lb-close {
          position: absolute;
          top: 20px; right: 24px;
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 40px; height: 40px;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }
        .gal-lb-close:hover { background: rgba(255,255,255,0.25); }
        .gal-lb-prev, .gal-lb-next {
          position: absolute;
          top: 50%; transform: translateY(-50%);
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 48px; height: 48px;
          border-radius: 50%;
          font-size: 22px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }
        .gal-lb-prev { left: 20px; }
        .gal-lb-next { right: 20px; }
        .gal-lb-prev:hover, .gal-lb-next:hover { background: rgba(255,255,255,0.25); }

        @media (max-width: 640px) {
          .gal-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .gal-item-img { height: 150px; }
          .gal-lb-prev { left: 8px; }
          .gal-lb-next { right: 8px; }
        }
      </style>

      <!-- Hero -->
      <div class="gal-hero">
        <div class="gal-hero-content">
          <div class="gal-hero-label">📸 ${t('galleryTitle')}</div>
          <h1>${t('galleryHeroTitle')}</h1>
          <p>${t('gallerySubtitle')}</p>
        </div>
      </div>

      <!-- Body -->
      <div class="gal-body">
        <div class="gal-inner">
          <div class="gal-filters" id="gal-filters">
            <button class="gal-filter-btn active" data-cat="all">${t('galleryAllPhotos')}</button>
          </div>
          <div class="gal-stats" id="gal-stats"></div>
          <div class="gal-grid" id="gal-grid">
            ${[...Array(6)].map(() => `
              <div class="gal-item" style="pointer-events:none;">
                <div class="gal-item-img" style="background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200%;"></div>
                <div class="gal-item-info">
                  <div style="height:14px;background:#f3f4f6;border-radius:4px;margin-bottom:8px;"></div>
                  <div style="height:10px;background:#f3f4f6;border-radius:4px;width:60%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Lightbox -->
      <div class="gal-lb" id="gal-lb" role="dialog" aria-modal="true">
        <button class="gal-lb-close" id="gal-lb-close">✕</button>
        <button class="gal-lb-prev" id="gal-lb-prev">&#8249;</button>
        <img class="gal-lb-img" id="gal-lb-img" src="" alt="">
        <button class="gal-lb-next" id="gal-lb-next">&#8250;</button>
        <div class="gal-lb-meta">
          <div class="gal-lb-title" id="gal-lb-title"></div>
          <div class="gal-lb-cat" id="gal-lb-cat"></div>
          <div class="gal-lb-counter" id="gal-lb-counter"></div>
        </div>
      </div>
    `;
  }

  catClass(cat) {
    const map = { worship: 'gal-cat-worship', youth: 'gal-cat-youth', events: 'gal-cat-events', general: 'gal-cat-general' };
    return map[String(cat || 'general').toLowerCase()] || 'gal-cat-general';
  }

  categoryLabel(category) {
    const categoryKeys = {
      worship: 'galleryCategoryWorship',
      youth: 'galleryCategoryYouth',
      events: 'galleryCategoryEvents',
      general: 'galleryGeneral'
    };
    const normalized = String(category || 'general').toLowerCase();
    return categoryKeys[normalized] ? t(categoryKeys[normalized]) : category;
  }

  renderFilters() {
    const el = document.getElementById('gal-filters');
    if (!el) return;
    const cats = this.getCategories();
    el.innerHTML = cats.map(cat => `
      <button class="gal-filter-btn ${this.activeCategory === cat ? 'active' : ''}" data-cat="${cat}">
        ${cat === 'all' ? t('galleryAllPhotos') : this.categoryLabel(cat)}
      </button>
    `).join('');
    el.querySelectorAll('.gal-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => this.filterBy(btn.dataset.cat));
    });
  }

  renderGrid() {
    const grid = document.getElementById('gal-grid');
    const stats = document.getElementById('gal-stats');
    if (!grid) return;

    this.renderFilters();

    if (stats) {
      stats.innerHTML = t('galleryStats')
        .replace('{shown}', `<strong>${this.filtered.length}</strong>`)
        .replace('{total}', `<strong>${this.images.length}</strong>`);
    }

    if (this.filtered.length === 0) {
      grid.innerHTML = `
        <div class="gal-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <h3>${this.images.length === 0 ? t('galleryNoPhotos') : t('galleryNoCategoryPhotos')}</h3>
          <p>${this.images.length === 0 ? t('galleryCheckBack') : t('galleryTryDifferent')}</p>
        </div>
      `;
      document.getElementById('gal-load-more')?.remove();
      return;
    }

    grid.innerHTML = this.filtered.map((img, i) => `
      <div class="gal-item" data-index="${i}" tabindex="0" role="button" aria-label="${t('galleryViewPhoto')}: ${img.title || t('galleryUntitled')}">
        <div style="overflow:hidden;position:relative;">
          <img class="gal-item-img" src="${img.image_url}" alt="${img.title || ''}" loading="lazy">
          <div class="gal-item-overlay">
            <div class="gal-item-overlay-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003F3A" stroke-width="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="gal-item-info">
          <div class="gal-item-title">${img.title || t('galleryUntitled')}</div>
          <span class="gal-item-cat ${this.catClass(img.category)}">${this.categoryLabel(img.category)}</span>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.gal-item').forEach(item => {
      item.addEventListener('click', () => this.openLightbox(parseInt(item.dataset.index)));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') this.openLightbox(parseInt(item.dataset.index));
      });
    });

    let loadMoreBtn = document.getElementById('gal-load-more');
    if (this.hasMore && this.activeCategory === 'all') {
      if (!loadMoreBtn) {
        loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'gal-load-more';
        loadMoreBtn.className = 'btn btn-outline-maroon';
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.style.margin = '40px auto 0';
        loadMoreBtn.textContent = t('galleryLoadMore');
        loadMoreBtn.addEventListener('click', async () => {
          this.page++;
          loadMoreBtn.textContent = t('galleryLoading');
          await this.fetchImages(true);
          this.renderGrid();
        });
        grid.parentNode.appendChild(loadMoreBtn);
      } else {
        loadMoreBtn.textContent = t('galleryLoadMore');
      }
    } else if (loadMoreBtn) {
      loadMoreBtn.remove();
    }
  }

  openLightbox(index) {
    this.lightboxIndex = index;
    this.updateLightbox();
    document.getElementById('gal-lb').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    document.getElementById('gal-lb').classList.remove('open');
    document.body.style.overflow = '';
  }

  updateLightbox() {
    const img = this.filtered[this.lightboxIndex];
    if (!img) return;
    const lbImg = document.getElementById('gal-lb-img');
    if (lbImg) { lbImg.src = img.image_url; lbImg.alt = img.title || ''; }
    const title = document.getElementById('gal-lb-title'); if (title) title.textContent = img.title || t('galleryUntitled');
    const category = document.getElementById('gal-lb-cat'); if (category) category.textContent = this.categoryLabel(img.category);
    const n = document.getElementById('gal-lb-counter'); if (n) n.textContent = `${this.lightboxIndex + 1} / ${this.filtered.length}`;
  }

  bindEvents() {
    // Lightbox controls
    const lb = document.getElementById('gal-lb');
    document.getElementById('gal-lb-close')?.addEventListener('click', () => this.closeLightbox());
    document.getElementById('gal-lb-prev')?.addEventListener('click', () => {
      this.lightboxIndex = (this.lightboxIndex - 1 + this.filtered.length) % this.filtered.length;
      this.updateLightbox();
    });
    document.getElementById('gal-lb-next')?.addEventListener('click', () => {
      this.lightboxIndex = (this.lightboxIndex + 1) % this.filtered.length;
      this.updateLightbox();
    });
    lb?.addEventListener('click', (e) => { if (e.target === lb) this.closeLightbox(); });

    if (!this._keyboardBound) {
      document.addEventListener('keydown', this._onKeydown);
      this._keyboardBound = true;
    }
  }
}
