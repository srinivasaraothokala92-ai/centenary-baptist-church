import { API_BASE } from '../apiConfig.js';
import { churchData } from '../data/churchData.js';
import { t } from '../i18n.js';

const API_URL = `${API_BASE}/ministries`;

export class MinistriesSection {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;
    this.ministries = [];
    this.init();
    window.addEventListener('langChange', () => this.render());
  }

  async init() {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        // Only active ministries, sorted by sort_order
        this.ministries = data.filter(m => m.is_active);
      } else {
        throw new Error('API unavailable');
      }
    } catch {
      // Graceful fallback to static churchData
      this.ministries = churchData.ministries.map((m, i) => ({
        id: i,
        title: m.title,
        short_desc: m.desc,
        icon: m.icon,
        image_url: m.image,
        slug: m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        is_active: true,
        sort_order: i + 1
      }));
    }
    this.render();
  }

  render() {
    if (!this.container) return;

    let html = `
      <div class="wrap">
        <div class="section-header text-center fade-in-up" style="margin-bottom: 48px;">
          <h2 style="font-family: 'Playfair Display', serif; color: var(--primary-green); font-size: 36px; margin: 0;">${t('navMinistries')}</h2>
        </div>
        <div class="ministries-grid-elegant fade-in-up stagger-1">
    `;

    this.ministries.forEach(m => {
      const imageStyle = m.image_url
        ? `background-image: url('${m.image_url}')`
        : `background: linear-gradient(135deg, #003F3A, #005F58)`;

      html += `
        <a href="#/ministries/${m.slug || ''}" class="ministry-card-elegant">
          <div class="mc-img" style="${imageStyle}"></div>
          <div class="mc-overlay"></div>
          <div class="mc-content">
            <div class="mc-icon">${m.icon || ''}</div>
            <div class="mc-text">
              <h3>${m.title}</h3>
              <span class="mc-arrow">&rarr;</span>
            </div>
          </div>
        </a>
      `;
    });

    html += `
        </div>
      </div>
    `;

    this.container.className = 'section ministries-section-elegant';
    this.container.innerHTML = html;

    // Trigger scroll animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1 });

    this.container.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
  }
}
