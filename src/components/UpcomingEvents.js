import { t } from '../i18n.js';
import { churchData } from '../data/churchData.js';
import { API_BASE } from '../apiConfig.js';

export class UpcomingEvents {
  constructor(containerSelector) {
    this.containerSelector = containerSelector;
    this.container = document.querySelector(containerSelector);
    this._isFetching = false;

    if (this.container) {
      this._renderSkeleton();
      // Re-render on language or event data change
      window.addEventListener('langChange', () => this.render());
      window.addEventListener('eventsUpdated', () => this.render());
      // Show error state if the API request failed
      window.addEventListener('eventsError', () => this._renderError());
      // If events already loaded (e.g. cached), render immediately
      if (churchData.events && churchData.events.length > 0) {
        this.render();
      }
    }
  }

  _renderSkeleton() {
    this.container = document.querySelector(this.containerSelector);
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="events-editorial-wrapper fade-in-up visible">
        <div class="wrap">
          <div class="events-editorial-header text-center" style="margin-bottom: 48px;">
            <h2 style="font-family: 'Playfair Display', serif; color: #4C151A; font-size: 36px; margin: 0; text-transform: uppercase;">${t('eventsTitle')}</h2>
          </div>
          <div class="events-editorial-list">
            ${[1,2,3].map(() => `
              <div class="event-editorial-row" style="display:flex;gap:24px;padding:24px 0;border-bottom:1px solid #e5e7eb;align-items:center;">
                <div style="width:64px;flex-shrink:0;">
                  <div class="skel-block" style="height:20px;width:40px;margin-bottom:6px;"></div>
                  <div class="skel-block" style="height:14px;width:50px;"></div>
                </div>
                <div style="flex:1;">
                  <div class="skel-block" style="height:18px;width:60%;margin-bottom:10px;"></div>
                  <div class="skel-block" style="height:13px;width:40%;margin-bottom:8px;"></div>
                  <div class="skel-block" style="height:13px;width:80%;"></div>
                </div>
                <div style="width:90px;flex-shrink:0;">
                  <div class="skel-block" style="height:32px;width:90px;border-radius:4px;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  _renderError() {
    this.container = document.querySelector(this.containerSelector);
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="events-editorial-wrapper fade-in-up visible">
        <div class="wrap">
          <div class="events-editorial-header text-center" style="margin-bottom: 32px;">
            <h2 style="font-family: 'Playfair Display', serif; color: #4C151A; font-size: 36px; margin: 0; text-transform: uppercase;">${t('eventsTitle')}</h2>
          </div>
          <div style="text-align:center;padding:40px 0;color:#6b7280;" role="status" aria-live="polite">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:14px;opacity:0.45;" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style="margin:0 0 6px;font-size:15px;font-weight:500;color:#374151;">${t('eventsUnavailable')}</p>
            <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;">${t('tryAgain')}</p>
            <button id="events-retry-btn" aria-label="${t('retry')}" style="
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: white;
              color: #4C151A;
              border: 1px solid #4C151A;
              padding: 10px 24px;
              border-radius: 6px;
              font-family: inherit;
              font-weight: 600;
              font-size: 14px;
              cursor: pointer;
              transition: background 0.2s;
            " onmouseover="this.style.background='#fdf2f2'" onmouseout="this.style.background='white'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-11.44L2.13 8"/>
              </svg>
              ${t('retry')}
            </button>
          </div>
          <div style="text-align:center;margin-top:16px;">
            <a href="#/events" class="btn btn-outline-maroon" style="font-size:13px;">${t('eventsViewAll')}</a>
          </div>
        </div>
      </div>
    `;

    const btn = this.container.querySelector('#events-retry-btn');
    if (btn) {
      btn.addEventListener('click', () => this._retry());
    }
  }

  async _retry() {
    if (this._isFetching) return;
    this._isFetching = true;
    this._renderSkeleton();

    try {
      const res = await fetch(`${API_BASE}/events`);
      if (!res.ok) throw new Error('events_api_error');
      const data = await res.json();
      churchData.events = Array.isArray(data) ? data : [];
      this.render();
    } catch (err) {
      console.error('[Events] Retry failed');
      this._renderError();
    } finally {
      this._isFetching = false;
    }
  }

  render() {
    this.container = document.querySelector(this.containerSelector);
    if (!this.container) return;

    const displayEvents = churchData.events.slice(0, 4);

    if (!displayEvents.length) {
      this.container.innerHTML = `
        <div class="events-editorial-wrapper">
          <div class="wrap">
            <div class="events-editorial-header text-center" style="margin-bottom:32px;">
              <h2 style="font-family:'Playfair Display',serif;color:#4C151A;font-size:36px;margin:0;text-transform:uppercase;">${t('eventsTitle')}</h2>
            </div>
            <div style="text-align:center;padding:40px 0;color:#6b7280;">
              <p style="margin:0 0 16px;font-size:15px;">${t('noUpcomingEvents')}</p>
              <a href="#/events" class="btn btn-outline-maroon">${t('eventsViewAll')}</a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="events-editorial-wrapper fade-in-up">
        <div class="wrap">
          <div class="events-editorial-header text-center" style="margin-bottom: 48px;">
            <h2 style="font-family: 'Playfair Display', serif; color: #4C151A; font-size: 36px; margin: 0; text-transform: uppercase;">${t('eventsTitle')}</h2>
          </div>
          
          <div class="events-editorial-list">
    `;

    displayEvents.forEach(event => {
      html += `
        <div class="event-editorial-row fade-in-up stagger-1">
          <div class="event-editorial-date">
            <span class="ee-day">${event.date}</span>
            <span class="ee-month">${event.month}</span>
          </div>
          <div class="event-editorial-info">
            <h3 class="ee-title">${event.title}</h3>
            <p class="ee-meta">
              <span class="ee-location">${event.location}</span> &middot; <span class="ee-time">${event.time}</span>
            </p>
            <p class="ee-desc">${event.description}</p>
          </div>
          <div class="event-editorial-action">
            <a href="#/events/${event.id}" class="btn-ee-details">${t('eventsDetails')} &rarr;</a>
          </div>
        </div>
      `;
    });

    html += `
          </div>
          <div class="events-editorial-footer text-center" style="margin-top: 48px;">
            <a href="#/events" class="btn btn-outline-maroon">${t('eventsViewAll')}</a>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    
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
