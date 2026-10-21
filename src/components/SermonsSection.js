import { t } from '../i18n.js';
import { churchData } from '../data/churchData.js';
import { API_BASE } from '../apiConfig.js';

export class SermonsSection {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this._isFetching = false;

    if (!this.container) return;
    this._renderSkeleton();
    window.addEventListener('langChange', () => this.render());
    window.addEventListener('sermonsUpdated', () => this.render());
    // Show error state if the API request failed
    window.addEventListener('sermonsError', () => this._renderError());
    // If sermons already loaded (e.g. cached), render immediately
    if (churchData.sermons && churchData.sermons.length > 0) {
      this.render();
    }
  }

  _renderSkeleton() {
    if (!this.container) return;
    this.container.className = 'section sermons-section';
    this.container.style.backgroundColor = 'var(--cream)';
    this.container.innerHTML = `
      <div class="wrap">
        <div class="section-header text-center fade-in-up visible" style="margin-bottom: 48px;">
          <div class="eyebrow">${t('teaching')}</div>
          <h2 style="font-family: 'Playfair Display', serif; color: var(--primary-green); font-size: 36px; margin: 0; text-transform: uppercase;">${t('navSermons')}</h2>
        </div>
        <div class="sermons-list">
          ${[1,2,3].map(() => `
            <div class="sermon-row" style="display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid #e5e7eb;gap:16px;">
              <div style="flex:1;">
                <div class="skel-block" style="height:18px;width:55%;margin-bottom:10px;"></div>
                <div class="skel-block" style="height:13px;width:40%;"></div>
              </div>
              <div style="display:flex;gap:8px;flex-shrink:0;">
                <div class="skel-block" style="height:36px;width:90px;border-radius:20px;"></div>
                <div class="skel-block" style="height:36px;width:90px;border-radius:20px;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderError() {
    if (!this.container) return;
    this.container.className = 'section sermons-section';
    this.container.style.backgroundColor = 'var(--cream)';
    this.container.innerHTML = `
      <div class="wrap">
        <div class="section-header text-center fade-in-up visible" style="margin-bottom: 32px;">
          <div class="eyebrow">${t('teaching')}</div>
          <h2 style="font-family: 'Playfair Display', serif; color: var(--primary-green); font-size: 36px; margin: 0; text-transform: uppercase;">${t('navSermons')}</h2>
        </div>
        <div style="text-align:center;padding:40px 0;color:#6b7280;" role="status" aria-live="polite">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:14px;opacity:0.45;" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style="margin:0 0 6px;font-size:15px;font-weight:500;color:#374151;">${t('sermonsUnavailable')}</p>
          <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;">${t('tryAgain')}</p>
          <button id="sermons-retry-btn" aria-label="${t('retry')}" style="
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: white;
            color: var(--primary-green, #003F3A);
            border: 1px solid var(--primary-green, #003F3A);
            padding: 10px 24px;
            border-radius: 6px;
            font-family: inherit;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          " onmouseover="this.style.background='#f0f4f2'" onmouseout="this.style.background='white'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-11.44L2.13 8"/>
            </svg>
            ${t('retry')}
          </button>
        </div>
        <div style="text-align:center;margin-top:16px;">
          <a href="#/sermons" class="btn btn-outline-maroon" style="font-size:13px;">${t('sermonsViewAll')}</a>
        </div>
      </div>
    `;

    const btn = this.container.querySelector('#sermons-retry-btn');
    if (btn) {
      btn.addEventListener('click', () => this._retry());
    }
  }

  async _retry() {
    if (this._isFetching) return;
    this._isFetching = true;
    this._renderSkeleton();

    try {
      const res = await fetch(`${API_BASE}/sermons`);
      if (!res.ok) throw new Error('sermons_api_error');
      const data = await res.json();
      churchData.sermons = Array.isArray(data) ? data : [];
      this.render();
    } catch (err) {
      console.error('[Sermons] Retry failed');
      this._renderError();
    } finally {
      this._isFetching = false;
    }
  }

  render() {
    if (!this.container) return;

    if (!churchData.sermons || churchData.sermons.length === 0) {
      this.container.className = 'section sermons-section';
      this.container.style.backgroundColor = 'var(--cream)';
      this.container.innerHTML = `
        <div class="wrap">
          <div class="section-header text-center" style="margin-bottom:32px;">
            <div class="eyebrow">${t('teaching')}</div>
            <h2 style="font-family:'Playfair Display',serif;color:var(--primary-green);font-size:36px;margin:0;text-transform:uppercase;">${t('navSermons')}</h2>
          </div>
          <div style="text-align:center;padding:40px 0;color:#6b7280;">
            <p style="margin:0 0 16px;font-size:15px;">${t('noSermons')}</p>
            <a href="#/worship/sermons" class="btn btn-outline-maroon">${t('sermonsViewAll')}</a>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="wrap">
        <div class="section-header text-center fade-in-up" style="margin-bottom: 48px;">
          <div class="eyebrow">${t('teaching')}</div>
          <h2 style="font-family: 'Playfair Display', serif; color: var(--primary-green); font-size: 36px; margin: 0; text-transform: uppercase;">${t('navSermons')}</h2>
        </div>
        
        <div class="sermons-list">
    `;

    churchData.sermons.forEach((sermon, i) => {
      const watchUrl  = sermon.videoUrl  || sermon.youtube_url || sermon.url || '';
      const listenUrl = sermon.audioUrl  || sermon.audio_url  || watchUrl;
      html += `
        <div class="sermon-row fade-in-up stagger-1">
          <div class="sermon-info">
            <h3 class="sermon-title">${sermon.title}</h3>
            <p class="sermon-meta">
              <span class="sermon-speaker"><strong>${sermon.speaker}</strong></span> &middot; 
              <span class="sermon-passage">${sermon.passage}</span> &middot; 
              <span class="sermon-date">${sermon.date}</span>
            </p>
          </div>
          <div class="sermon-actions">
            ${watchUrl ? `
            <button class="btn btn-outline-round btn-sermon-watch" data-url="${watchUrl}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              ${t('watch')}
            </button>` : ''}
            ${listenUrl ? `
            <button class="btn btn-outline-round btn-sermon-listen" data-url="${listenUrl}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
              ${t('listen')}
            </button>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
        
        <div class="sermons-footer text-center" style="margin-top: 48px;">
          <a href="#/worship/watch-live" class="btn btn-solid-maroon" style="margin-right: 16px;">${t('navWatchLive')} &rarr;</a>
          <a href="#/worship/sermons" class="btn btn-outline-maroon">${t('sermonsViewAll')}</a>
        </div>
      </div>
    `;

    this.container.className = 'section sermons-section';
    this.container.style.backgroundColor = 'var(--cream)';
    this.container.innerHTML = html;

    // Wire WATCH / LISTEN buttons to open sermon URLs
    this.container.querySelectorAll('.btn-sermon-watch, .btn-sermon-listen').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    
    this.container.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
  }
}
