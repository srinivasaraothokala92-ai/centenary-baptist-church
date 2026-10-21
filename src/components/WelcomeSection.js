import { t } from '../i18n.js';
import { FirstTimeVisitorModal } from './VisitorModal.js';

export class WelcomeSection {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    
    // Bind the render method so it can be used as an event listener
    this.render = this.render.bind(this);
    
    // Listen for language changes to re-render
    window.addEventListener('langChange', this.render);
    
    this.render();
  }

  render() {
    if (!this.container) return;

    // Icons
    const worshipIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="20"></line><line x1="8" y1="9" x2="16" y2="9"></line></svg>`;
    const communityIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
    const involvedIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

    const html = `
      <div class="welcome-section-inner">
        <!-- Top Welcome Area -->
        <div class="welcome-top text-center fade-in-up">
          <div class="welcome-eyebrow">${t('welcomeEyebrow')}</div>
          <h2 class="welcome-title">${t('welcomeTitle')}</h2>
          <p class="welcome-desc">${t('welcomeDesc')}</p>
          
          <div class="welcome-features">
            <div class="welcome-feature">
              <div class="welcome-feature-icon">${worshipIcon}</div>
              <h4>${t('worshipLabel')}</h4>
              <p>${t('worshipText')}</p>
            </div>
            <div class="welcome-feature">
              <div class="welcome-feature-icon">${communityIcon}</div>
              <h4>${t('communityLabel')}</h4>
              <p>${t('communityText')}</p>
            </div>
            <div class="welcome-feature">
              <div class="welcome-feature-icon">${involvedIcon}</div>
              <h4>${t('involvedLabel')}</h4>
              <p>${t('involvedText')}</p>
            </div>
          </div>
          
          <button class="btn btn-solid-green welcome-new-here" id="btn-welcome-new-here">${t('newHereBtn')}</button>
        </div>

      </div>
    `;

    this.container.innerHTML = html;

    // Setup intersection observer for animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    
    const animatedElements = this.container.querySelectorAll('.fade-in-up');
    animatedElements.forEach(el => observer.observe(el));

    const newHereBtn = this.container.querySelector('#btn-welcome-new-here');
    if (newHereBtn) {
      newHereBtn.addEventListener('click', () => {
        const modal = new FirstTimeVisitorModal();
        modal.open();
      });
    }
  }
}
