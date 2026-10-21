import { t } from '../i18n.js';

export class FinalCTASection {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;
    this.render();
    window.addEventListener('langChange', () => this.render());
  }

  render() {
    if (!this.container) return;

    let html = `
      <div class="wrap text-center final-cta-content fade-in-up">
        <h2 style="font-family: 'Playfair Display', serif; color: var(--primary-green); font-size: 28px; margin: 0 0 8px 0; text-transform: uppercase;">${t('footerCtaText')}</h2>
        <p style="color: var(--muted-text); font-size: 16px; margin: 0 0 24px 0;">${t('footerCtaSub')}</p>
        <div class="fcta-actions">
          <a href="#/visit" class="btn btn-solid-maroon" style="margin-right: 16px;">${t('planVisit')}</a>
          <a href="#/worship/watch-live" class="btn btn-outline-maroon">${t('watchLive')}</a>
        </div>
      </div>
    `;

    this.container.className = 'final-cta-section';
    this.container.style.backgroundColor = 'var(--white)';
    this.container.style.padding = '48px 0';
    this.container.innerHTML = html;

    // Trigger animations
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
