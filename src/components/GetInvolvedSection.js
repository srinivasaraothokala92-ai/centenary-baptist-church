import { t } from '../i18n.js';

export class GetInvolvedSection {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;
    this.render();
    window.addEventListener('langChange', () => this.render());
  }

  render() {
    if (!this.container) return;

    // Elegant stacked or horizontal blocks, distinct from the ministries grid.
    let html = `
      <div class="wrap">
        <div class="section-header text-center fade-in-up" style="margin-bottom: 48px;">
          <h2 style="font-family: 'Playfair Display', serif; color: var(--primary-green); font-size: 36px; margin: 0; text-transform: uppercase;">${t('getInvolvedTitle')}</h2>
        </div>
        
        <div class="get-involved-blocks fade-in-up stagger-1">
          <a href="#/ministries/prayer" class="gi-block">
            <div class="gi-content">
              <h3>${t('getInvolvedPray')}</h3>
              <p>${t('getInvolvedPrayerCells')}</p>
            </div>
            <div class="gi-arrow">&rarr;</div>
          </a>
          
          <a href="#/ministries" class="gi-block">
            <div class="gi-content">
              <h3>${t('getInvolvedServe')}</h3>
              <p>${t('getInvolvedServeText')}</p>
            </div>
            <div class="gi-arrow">&rarr;</div>
          </a>
          
          <a href="#/give" class="gi-block">
            <div class="gi-content">
              <h3>${t('getInvolvedGive')}</h3>
              <p>${t('getInvolvedGiveText')}</p>
            </div>
            <div class="gi-arrow">&rarr;</div>
          </a>
          
          <a href="#/worship" class="gi-block">
            <div class="gi-content">
              <h3>${t('getInvolvedAttend')}</h3>
              <p>${t('getInvolvedAttendText')}</p>
            </div>
            <div class="gi-arrow">&rarr;</div>
          </a>
        </div>
      </div>
    `;

    this.container.className = 'section get-involved-section';
    this.container.style.backgroundColor = 'var(--parchment)';
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
