import './LeadershipSection.css';
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
 * LeadershipSection — Premium Heritage Pastor Team homepage preview.
 * Shows a horizontal auto-scrolling carousel that activates when the
 * section enters the viewport.
 */
export class LeadershipSection {
  constructor(containerSelector, options = {}) {
    this.containerSelector = containerSelector;
    this.container = document.querySelector(containerSelector);
    this.options = Object.assign({ isSubSection: false }, options);
    this._carouselCleanup = null;

    if (this.container) {
      this.render();
      window.addEventListener('langChange', () => this.render());
    }
  }

  render() {
    this._teardownCarousel();
    this.container = document.querySelector(this.containerSelector);
    if (!this.container) return;

    const pastors = churchData.pastoralTeam;
    if (!pastors || pastors.length === 0) return;

    const cardsHTML = pastors.map(pastor => {
      const imagePositionStyle = pastor.imagePosition ? `style="object-position: ${pastor.imagePosition};"` : '';
      const role = localizeRole(pastor.role);
      const secondaryRole = pastor.secondaryRole ? localizeRole(pastor.secondaryRole) : '';
      const altRole = secondaryRole ? `${role} / ${secondaryRole}` : role;
      const imageHTML = pastor.image
        ? `<img src="${pastor.image}" alt="${pastor.name}, ${altRole}, ${t('churchName')}" class="pt-card-photo" loading="lazy" ${imagePositionStyle}>`
        : `<div class="pt-card-photo-placeholder" aria-label="${t('profileImageUnavailable')}: ${pastor.name}"><span class="pt-cross-placeholder">†</span></div>`;

      const secondaryRoleHTML = pastor.secondaryRole 
        ? `<div class="pt-card-secondary-role">${secondaryRole}</div>` 
        : '';

      return `
      <div class="pt-card">
        <div class="pt-card-photo-wrap">
          ${imageHTML}
        </div>
        <div class="pt-card-body">
          <div class="pt-card-divider" aria-hidden="true">
            <span class="pt-cross">†</span>
          </div>
          <div class="pt-card-role">${role}</div>
          ${secondaryRoleHTML}
          <h3 class="pt-card-name">${pastor.name}</h3>
          <p class="pt-card-intro">${pastor.shortIntro || ''}</p>
          ${pastor.id ? `<a href="#/pastor-team/${pastor.id}" class="pt-card-btn" aria-label="${t('knowMore')}: ${pastor.name}">${t('knowMore')}</a>` : ''}
        </div>
      </div>
    `}).join('');

    const wrapperClass = this.options.isSubSection
      ? 'pt-section pt-section--sub'
      : 'pt-section';

    this.container.innerHTML = `
      <section class="${wrapperClass}" aria-label="${t('navPastorTeam')}">
        <div class="pt-overlay"></div>
        <div class="wrap pt-content-wrap">
          <div class="pt-header fade-in-up">
            <div class="pt-eyebrow">${t('navPastorTeam')}</div>
            <h2 class="pt-heading">${t('pastorTeamHeroTitle')}</h2>
            <p class="pt-subheading">${t('pastorTeamHeroSubtitle')}</p>
          </div>
          <div class="pt-carousel-section fade-in-up" style="animation-delay:0.15s;" aria-roledescription="carousel" aria-label="${t('navPastorTeam')}">
            <div class="pt-carousel-controls" role="group" aria-label="Carousel controls">
              <button type="button" class="pt-carousel-control" data-pt-prev aria-label="${t('carouselPrevious') || 'Previous'}">
                <span aria-hidden="true">←</span>
              </button>
              <button type="button" class="pt-carousel-control pt-carousel-toggle" data-pt-toggle aria-pressed="false" aria-label="Pause auto-scroll">
                <span aria-hidden="true">Ⅱ</span>
              </button>
              <button type="button" class="pt-carousel-control" data-pt-next aria-label="${t('carouselNext') || 'Next'}">
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <div class="pt-carousel-viewport" tabindex="0" aria-label="${t('navPastorTeam')}">
              <div class="pt-carousel-track">
                ${cardsHTML}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    this._setupAnimations();
    this._setupCarousel();
  }

  _setupAnimations() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });

    this.container.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
  }

  /* ----------------------------------------------------------------
     Auto-scrolling carousel — starts when section is in viewport
     ---------------------------------------------------------------- */
  _setupCarousel() {
    const section = this.container.querySelector('.pt-carousel-section');
    const viewport = this.container.querySelector('.pt-carousel-viewport');
    const track = this.container.querySelector('.pt-carousel-track');
    const controls = this.container.querySelector('.pt-carousel-controls');
    const previousButton = this.container.querySelector('[data-pt-prev]');
    const toggleButton = this.container.querySelector('[data-pt-toggle]');
    const nextButton = this.container.querySelector('[data-pt-next]');

    if (!section || !viewport || !track || !controls || !previousButton || !toggleButton || !nextButton) return;

    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    let userPaused = Boolean(motionQuery && motionQuery.matches);
    let interactionPaused = false;
    let inViewport = false;
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
      const card = track.querySelector('.pt-card');
      if (!card) return viewport.clientWidth;
      const trackStyle = window.getComputedStyle(track);
      const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap) || 24;
      return card.getBoundingClientRect().width + gap;
    };

    const updateControls = () => {
      const hasOverflow = isScrollable();
      controls.style.display = hasOverflow ? 'flex' : 'none';
      toggleButton.setAttribute('aria-pressed', String(userPaused));
      toggleButton.setAttribute('aria-label', userPaused ? 'Play auto-scroll' : 'Pause auto-scroll');
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

    const canAutoAdvance = () => !userPaused && !interactionPaused && inViewport && !document.hidden && isScrollable();
    const scheduleAutoAdvance = () => {
      clearAutoTimer();
      if (!canAutoAdvance()) return;

      autoTimer = window.setTimeout(() => {
        move(1);
        scheduleAutoAdvance();
      }, 2500);
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
      resumeTimer = window.setTimeout(resumeAfterInteraction, 2500);
    };

    const onPrevious = () => { pauseTemporarily(); move(-1); };
    const onNext = () => { pauseTemporarily(); move(1); };
    const onToggle = () => {
      userPaused = !userPaused;
      if (!userPaused) interactionPaused = false;
      updateControls();
      scheduleAutoAdvance();
    };
    const onKeydown = event => {
      if (event.target !== viewport) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); onNext(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); onPrevious(); }
    };
    const onFocusOut = () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (!section.contains(document.activeElement)) resumeAfterInteraction();
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

    // IntersectionObserver — auto-scroll only when section is visible
    const viewportObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        inViewport = entry.isIntersecting;
        if (inViewport) {
          scheduleAutoAdvance();
        } else {
          clearAutoTimer();
        }
      });
    }, { threshold: 0.1 });
    viewportObserver.observe(section);

    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      inViewport = true;
      scheduleAutoAdvance();
    }

    // Event listeners
    previousButton.addEventListener('click', onPrevious);
    nextButton.addEventListener('click', onNext);
    toggleButton.addEventListener('click', onToggle);
    // Note: pointerenter/pointerleave pause listeners intentionally removed so
    // carousel continues auto-moving when the cursor is hovering the section.
    section.addEventListener('focusin', pauseForInteraction);
    section.addEventListener('focusout', onFocusOut);
    viewport.addEventListener('pointerdown', pauseTemporarily);
    viewport.addEventListener('keydown', onKeydown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onResize);
    if (motionQuery) motionQuery.addEventListener('change', onMotionChange);

    updateControls();

    this._carouselCleanup = () => {
      clearAutoTimer();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      if (focusTimer) window.clearTimeout(focusTimer);
      viewportObserver.disconnect();
      previousButton.removeEventListener('click', onPrevious);
      nextButton.removeEventListener('click', onNext);
      toggleButton.removeEventListener('click', onToggle);
      section.removeEventListener('focusin', pauseForInteraction);
      section.removeEventListener('focusout', onFocusOut);
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
