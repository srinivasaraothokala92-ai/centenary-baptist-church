import './PastorTeamPage.css';
import { churchData } from '../data/churchData.js';
import { t } from '../i18n.js';

const roleTranslationKeys = {
  'Senior Pastor': 'roleSeniorPastor',
  'Associate Pastor': 'roleAssociatePastor',
  'Church Pastor': 'roleChurchPastor',
  Pastor: 'rolePastor',
  'Outreach Pastor': 'roleOutreachPastor'
};

function localizeRole(role) {
  return roleTranslationKeys[role] ? t(roleTranslationKeys[role]) : role;
}

/**
 * PastorTeamPage — handles:
 *   #/pastor-team           → premium team listing (all pastors as cards)
 *   #/pastor-team/:id       → individual full biography
 */
export class PastorTeamPage {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentPath = null;
    this._carouselCleanup = null;
    this._animationObserver = null;

    window.addEventListener('langChange', () => {
      const activePath = (window.location.hash || '').replace(/^#/, '');
      if (this.currentPath && activePath === this.currentPath) {
        this.render(this.currentPath, { scroll: false });
      }
    });

    // Stop timers/listeners if the visitor leaves the team listing without
    // requiring the page component to be recreated.
    window.addEventListener('hashchange', () => {
      const activePath = (window.location.hash || '').replace(/^#/, '');
      if (!activePath.startsWith('/pastor-team')) this._teardownCarousel();
    });
  }

  render(path, { scroll = true } = {}) {
    if (!this.container) return;

    this._teardownCarousel();
    this._disconnectAnimations();
    this.currentPath = path;

    const isProfile = path.startsWith('/pastor-team/');
    if (isProfile) {
      const id = path.split('/')[2];
      const pastor = churchData.pastoralTeam.find(p => p.id === id);
      pastor ? this.renderProfile(pastor) : (window.location.hash = '#/pastor-team');
    } else {
      this.renderTeam();
    }

    // SEO
    document.title = `${t('navPastorTeam')} | Centenary Baptist Church, Secunderabad`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'Meet the pastoral team serving Centenary Baptist Church, Secunderabad — faithfully leading worship in Telugu, Hindi and English.';

    if (scroll) window.scrollTo(0, 0);
  }

  /* ----------------------------------------------------------------
     Team listing — all pastors as premium portrait cards
     ---------------------------------------------------------------- */
  renderTeam() {
    const pastors = churchData.pastoralTeam;

    const cardsHTML = pastors.map(pastor => {
      const intro = pastor.shortIntro || pastor.bio.split('\n\n')[0];
      
      const imagePositionStyle = pastor.imagePosition ? `style="object-position: ${pastor.imagePosition};"` : '';
      const role = localizeRole(pastor.role);
      const secondaryRole = pastor.secondaryRole ? localizeRole(pastor.secondaryRole) : '';
      const altRole = secondaryRole ? `${role} / ${secondaryRole}` : role;
      const imageHTML = pastor.image
        ? `<img src="${pastor.image}" alt="${pastor.name}, ${altRole}, ${t('churchName')}" class="ptp-card-photo" loading="lazy" ${imagePositionStyle}>`
        : `<div class="ptp-card-photo-placeholder" aria-label="${t('profileImageUnavailable')}: ${pastor.name}"><span class="ptp-cross-placeholder">†</span></div>`;

      const secondaryRoleHTML = pastor.secondaryRole 
        ? `<div class="ptp-card-secondary-role">${secondaryRole}</div>` 
        : '';

      return `
        <div class="ptp-card">
          <div class="ptp-card-photo-wrap">
            ${imageHTML}
          </div>
          <div class="ptp-card-body">
            <div class="ptp-card-divider" aria-hidden="true">
              <span class="ptp-cross">†</span>
            </div>
            <div class="ptp-role">${role}</div>
            ${secondaryRoleHTML}
            <h2 class="ptp-name">${pastor.name}</h2>
            <p class="ptp-intro">${intro}</p>
            ${pastor.id ? `<a href="#/pastor-team/${pastor.id}" class="ptp-know-more" aria-label="${t('fullProfileOf')}: ${pastor.name}">${t('knowMore')}</a>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="ptp-page-wrapper">
        <div class="ptp-overlay"></div>
        <div class="ptp-content-wrap">
          <div class="ptp-hero fade-in-up">
            <div class="wrap">
              <div class="ptp-eyebrow">${t('navPastorTeam')}</div>
              <h1 class="ptp-hero-title">${t('pastorTeamHeroTitle')}</h1>
              <p class="ptp-hero-subtitle">${t('pastorTeamHeroSubtitle')}</p>
            </div>
          </div>
          <div class="wrap ptp-team-wrap fade-in-up" style="animation-delay: 0.15s;">
            <section class="ptp-carousel" aria-roledescription="carousel" aria-label="${t('navPastorTeam')}">
              <div class="ptp-carousel-controls" role="group" aria-label="${t('navPastorTeam')}">
                <button type="button" class="ptp-carousel-control" data-ptp-prev aria-controls="ptp-team-carousel-viewport" aria-label="${t('carouselPrevious')}">
                  <span aria-hidden="true">←</span>
                </button>
                <button type="button" class="ptp-carousel-control ptp-carousel-toggle" data-ptp-toggle aria-controls="ptp-team-carousel-viewport" aria-pressed="false" aria-label="${t('pausePastorCarousel')}">
                  <span aria-hidden="true">Ⅱ</span>
                </button>
                <button type="button" class="ptp-carousel-control" data-ptp-next aria-controls="ptp-team-carousel-viewport" aria-label="${t('carouselNext')}">
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <div id="ptp-team-carousel-viewport" class="ptp-carousel-viewport" tabindex="0" aria-label="${t('navPastorTeam')}">
                <div class="ptp-carousel-track">${cardsHTML}</div>
              </div>
            </section>
          </div>
        </div>
      </div>
    `;

    this._setupAnimations();
    this._setupCarousel();
  }

  /* ----------------------------------------------------------------
     Full biography profile
     ---------------------------------------------------------------- */
  renderProfile(pastor) {
    const bioParagraphs = pastor.bio.split('\n\n').map(p => `<p>${p}</p>`).join('');

    const imagePositionStyle = pastor.imagePosition ? `style="object-position: ${pastor.imagePosition};"` : '';
    const role = localizeRole(pastor.role);
    const secondaryRole = pastor.secondaryRole ? localizeRole(pastor.secondaryRole) : '';
    const altRole = secondaryRole ? `${role} / ${secondaryRole}` : role;
    const imageHTML = pastor.image
      ? `<img src="${pastor.image}" alt="${pastor.name}, ${altRole}, ${t('churchName')}" class="ptp-profile-img" ${imagePositionStyle}>`
      : `<div class="ptp-profile-img-placeholder" aria-label="${t('profileImageUnavailable')}: ${pastor.name}"><span class="ptp-cross-placeholder-large">†</span></div>`;

    const secondaryRoleHTML = pastor.secondaryRole 
      ? `<div class="ptp-profile-secondary-role">${secondaryRole}</div>` 
      : '';

    this.container.innerHTML = `
      <div class="ptp-profile-page">
        <div class="wrap">
          <nav class="ptp-breadcrumb" aria-label="Breadcrumb">
            <a href="#/" class="ptp-bc-link">${t('navHome')}</a>
            <span class="ptp-bc-sep" aria-hidden="true">›</span>
            <a href="#/pastor-team" class="ptp-bc-link">${t('navPastorTeam')}</a>
            <span class="ptp-bc-sep" aria-hidden="true">›</span>
            <span class="ptp-bc-current" aria-current="page">${pastor.name}</span>
          </nav>

          <div class="ptp-profile-layout">
            <aside class="ptp-profile-aside">
              ${imageHTML}
              <div class="ptp-profile-aside-meta">
                <div class="ptp-profile-role">${role}</div>
                ${secondaryRoleHTML}
                <div class="ptp-profile-church">${t('churchName')}</div>
              </div>
            </aside>

            <div class="ptp-profile-content">
              <h1 class="ptp-profile-name">${pastor.name}</h1>
              <div class="ptp-profile-divider" aria-hidden="true"></div>
              <div class="ptp-profile-bio">${bioParagraphs}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _setupAnimations() {
    this._disconnectAnimations();

    if (!('IntersectionObserver' in window)) {
      this.container.querySelectorAll('.fade-in-up').forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });

    this.container.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
    this._animationObserver = observer;
  }

  _disconnectAnimations() {
    if (this._animationObserver) {
      this._animationObserver.disconnect();
      this._animationObserver = null;
    }
  }

  /* ----------------------------------------------------------------
     Team carousel — one equal-height horizontal row, with touch,
     keyboard, pause and reduced-motion support.
     ---------------------------------------------------------------- */
  _setupCarousel() {
    const carousel = this.container.querySelector('.ptp-carousel');
    const viewport = this.container.querySelector('.ptp-carousel-viewport');
    const track = this.container.querySelector('.ptp-carousel-track');
    const controls = this.container.querySelector('.ptp-carousel-controls');
    const previousButton = this.container.querySelector('[data-ptp-prev]');
    const toggleButton = this.container.querySelector('[data-ptp-toggle]');
    const nextButton = this.container.querySelector('[data-ptp-next]');

    if (!carousel || !viewport || !track || !controls || !previousButton || !toggleButton || !nextButton) return;

    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    let userPaused = Boolean(motionQuery && motionQuery.matches);
    let interactionPaused = false;
    let autoTimer = null;
    let resumeTimer = null;
    let focusTimer = null;

    const clearAutoTimer = () => {
      if (autoTimer) window.clearTimeout(autoTimer);
      autoTimer = null;
    };

    const maxScroll = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const isScrollable = () => maxScroll() > 2;
    const scrollStep = () => {
      const card = track.querySelector('.ptp-card');
      if (!card) return viewport.clientWidth;
      const trackStyle = window.getComputedStyle(track);
      const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap) || 24;
      return card.getBoundingClientRect().width + gap;
    };

    const updateControls = () => {
      const hasOverflow = isScrollable();
      controls.hidden = !hasOverflow;
      toggleButton.setAttribute('aria-pressed', String(userPaused));
      toggleButton.setAttribute('aria-label', userPaused ? t('playPastorCarousel') : t('pausePastorCarousel'));
      toggleButton.innerHTML = `<span aria-hidden="true">${userPaused ? '▶' : 'Ⅱ'}</span>`;
    };

    const move = direction => {
      const lastScrollPosition = maxScroll();
      if (!lastScrollPosition) return;

      const currentPosition = viewport.scrollLeft;
      let nextPosition;
      if (direction > 0) {
        nextPosition = currentPosition >= lastScrollPosition - 2
          ? 0
          : Math.min(currentPosition + scrollStep(), lastScrollPosition);
      } else {
        nextPosition = currentPosition <= 2
          ? lastScrollPosition
          : Math.max(currentPosition - scrollStep(), 0);
      }

      viewport.scrollTo({
        left: nextPosition,
        behavior: motionQuery && motionQuery.matches ? 'auto' : 'smooth'
      });
    };

    const canAutoAdvance = () => !userPaused && !interactionPaused && !document.hidden && isScrollable();
    const scheduleAutoAdvance = () => {
      clearAutoTimer();
      if (!canAutoAdvance()) return;

      autoTimer = window.setTimeout(() => {
        move(1);
        scheduleAutoAdvance();
      }, 4500);
    };

    const pauseForInteraction = () => {
      interactionPaused = true;
      clearAutoTimer();
    };

    const resumeAfterInteraction = () => {
      interactionPaused = false;
      scheduleAutoAdvance();
    };

    const pauseTemporarily = () => {
      pauseForInteraction();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(resumeAfterInteraction, 6000);
    };

    const onPrevious = () => {
      pauseTemporarily();
      move(-1);
    };
    const onNext = () => {
      pauseTemporarily();
      move(1);
    };
    const onToggle = () => {
      userPaused = !userPaused;
      // Choosing "play" is an explicit request to resume even if focus is
      // still resting on the control after a mouse or keyboard activation.
      if (!userPaused) interactionPaused = false;
      updateControls();
      scheduleAutoAdvance();
    };
    const onKeydown = event => {
      if (event.target !== viewport) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
      }
    };
    const onFocusOut = () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (!carousel.contains(document.activeElement)) resumeAfterInteraction();
      }, 0);
    };
    const onVisibilityChange = () => {
      if (document.hidden) pauseForInteraction();
      else resumeAfterInteraction();
    };
    const onResize = () => {
      if (viewport.scrollLeft > maxScroll()) viewport.scrollLeft = maxScroll();
      updateControls();
      scheduleAutoAdvance();
    };
    const onMotionChange = event => {
      if (event.matches) userPaused = true;
      updateControls();
      scheduleAutoAdvance();
    };

    previousButton.addEventListener('click', onPrevious);
    nextButton.addEventListener('click', onNext);
    toggleButton.addEventListener('click', onToggle);
    carousel.addEventListener('pointerenter', pauseForInteraction);
    carousel.addEventListener('pointerleave', resumeAfterInteraction);
    carousel.addEventListener('focusin', pauseForInteraction);
    carousel.addEventListener('focusout', onFocusOut);
    viewport.addEventListener('pointerdown', pauseTemporarily);
    viewport.addEventListener('keydown', onKeydown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onResize);
    if (motionQuery) motionQuery.addEventListener('change', onMotionChange);

    updateControls();
    scheduleAutoAdvance();

    this._carouselCleanup = () => {
      clearAutoTimer();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      if (focusTimer) window.clearTimeout(focusTimer);
      previousButton.removeEventListener('click', onPrevious);
      nextButton.removeEventListener('click', onNext);
      toggleButton.removeEventListener('click', onToggle);
      carousel.removeEventListener('pointerenter', pauseForInteraction);
      carousel.removeEventListener('pointerleave', resumeAfterInteraction);
      carousel.removeEventListener('focusin', pauseForInteraction);
      carousel.removeEventListener('focusout', onFocusOut);
      viewport.removeEventListener('pointerdown', pauseTemporarily);
      viewport.removeEventListener('keydown', onKeydown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      if (motionQuery) motionQuery.removeEventListener('change', onMotionChange);
    };
  }

  _teardownCarousel() {
    if (this._carouselCleanup) {
      this._carouselCleanup();
      this._carouselCleanup = null;
    }
  }
}
