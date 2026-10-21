import { API_BASE } from './apiConfig.js';
import { initializePublicSettings } from './siteSettings.js';
import './style.css';
import { initI18n, t, getCurrentLang } from './i18n.js';
import { FirstTimeVisitorModal } from './components/VisitorModal.js';
import { AnnouncementBanner } from './components/AnnouncementBanner.js';
import { UpcomingEvents } from './components/UpcomingEvents.js';
import { MinistriesSection } from './components/MinistriesSection.js';
import { SermonsSection } from './components/SermonsSection.js';
import { GetInvolvedSection } from './components/GetInvolvedSection.js';
import { FinalCTASection } from './components/FinalCTASection.js';
import { ContactForm } from './components/ContactForm.js';
import { CampusSection } from './components/CampusSection.js';
import { LeadershipSection } from './components/LeadershipSection.js';
import { WelcomeSection } from './components/WelcomeSection.js';
import { PosterCarousel } from './components/PosterCarousel.js';
import { HistoryPreviewSection } from './components/HistoryPreviewSection.js';
import { churchData } from './data/churchData.js';
import { Router } from './router.js';
import { CookieBanner } from './cookie/CookieBanner.js';
import { CookieSettingsModal } from './cookie/CookieSettings.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

// ── Initializers ───────────────────────────────────────────
function initScrollEffects() {
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }
}

// ── Build navigation labels from i18n ────────────────────────
function getNavData() {
  return [
    { label: t('navHome'), href: '#/' },
    {
      label: t('navAbout'), href: '#/about', dropdown: true,
      columns: [
        {
          title: t('navDiscoverGroup'),
          items: [
            { label: t('navOurStory'),      href: '#/about/our-story' },
            { label: t('navOurBeliefs'),    href: '#/about/our-beliefs' },
            { label: t('navMissionVision'), href: '#/about/mission-vision' },
            { label: t('navLeadership'),    href: '#/about/leadership' },
            { label: t('navContact'),       href: '#/visit/contact' }
          ]
        },
        {
          title: t('navHistoryGroup'),
          items: [
            { label: t('navFaithHistory'), href: '#/about/faith-history' },
            { label: t('nav150Years'),     href: '#/about/150-years' },
            { label: t('navMilestones'),   href: '#/about/milestones' },
            { label: t('navOurCampus'),    href: '#/about/our-campus' }
          ]
        }
      ]
    },
    {
      label: t('navWorship'), href: '#/worship', dropdown: true,
      columns: [
        {
          title: t('navWorshipGroup'),
          items: [
            { label: t('navSundayWorship'),  href: '#/worship/sunday-worship-info' },
            { label: t('navWorshipTimings'), href: '#/worship/timings' },
            { label: t('navSermons'),        href: '#/worship/sermons' },
            { label: t('navPrayer'),         href: '#/worship/prayer' },
            { label: t('navWatchLive'),      href: '#/worship/watch-live' }
          ]
        }
      ]
    },
    { label: t('navPastorTeam'), href: '#/pastor-team' },
    {
      label: t('navMinistries'), href: '#/ministries', dropdown: true,
      columns: [
        {
          title: t('navMinistriesGroup'),
          items: [
            { label: t('navChildren'),        href: '#/ministries/children' },
            { label: t('navYouth'),           href: '#/ministries/youth' },
            { label: t('navWomen'),           href: '#/ministries/women' },
            { label: t('navMen'),             href: '#/ministries/men' },
            { label: t('navMusicChoir'),      href: '#/ministries/music' },
            { label: t('navMissions'),        href: '#/ministries/missions' },
            { label: t('navMedicalMinistry'), href: '#/ministries/medical' },
            { label: t('navChurchSchool'),    href: '#/ministries/church-school' },
            { label: t('navOutreach'),        href: '#/ministries/outreach' }
          ]
        }
      ]
    },
    { label: t('navEvents'), href: '#/events' },
    { label: t('navGallery'), href: '#/gallery' },
    {
      label: t('navVisit'), href: '#/visit', dropdown: true,
      columns: [
        {
          title: t('navVisitGroup'),
          items: [
            { label: t('navPlanVisit'), href: '#/visit/plan' },
            { label: t('navLocation'),  href: '#/visit/location' },
            { label: t('navNewHere'),   href: '#/visit/new-here', isAction: true },
            { label: t('navContact'),   href: '#/visit/contact' }
          ]
        }
      ]
    },
    { label: t('navGive'), href: '#/give' }
  ];
}

function renderNavigation() {
  const navContainer = $('#nav-links');
  if (!navContainer) return;

  const navData = getNavData();
  let html = '';

    navData.forEach(item => {
    if (item.dropdown) {
      const linkClass = item.isHighlighted ? 'nav-link nav-link--highlight' : 'nav-link';
      const wrapClass = item.isHighlighted ? 'nav-item has-dropdown nav-item--highlight' : 'nav-item has-dropdown';
      html += `
        <div class="${wrapClass}">
          <a href="${item.href}" class="${linkClass}">${item.label} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></a>
          <div class="mega-menu">
            <div class="mega-menu-inner">
              ${item.columns.map(col => `
                <div class="mega-col">
                  <h4>${col.title}</h4>
                  <ul>
                    ${col.items.map(sub => `
                      <li><a href="${sub.href}" class="${sub.isAction ? 'is-action' : ''}">${sub.label}</a></li>
                    `).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      html += `<div class="nav-item"><a href="${item.href}" class="nav-link">${item.label}</a></div>`;
    }
  });

  navContainer.innerHTML = html;
  initMobileMenu(); // Re-wire mobile menu after re-render
}

function initMobileMenu() {
  const menuBtn = $('#mobile-menu-btn');
  const navLinks = $('#nav-links');
  if (!menuBtn || !navLinks) return;

  // Remove old listeners by cloning the button
  const newBtn = menuBtn.cloneNode(true);
  menuBtn.parentNode.replaceChild(newBtn, menuBtn);

  newBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });

  $$('.nav-item.has-dropdown > .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  $$('.mega-menu a, .nav-item:not(.has-dropdown) > a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        navLinks.classList.remove('active');
      }
    });
  });
}

function initModals() {
  const btnPlanVisit = $('#btn-plan-visit');
  if (btnPlanVisit) {
    const visitorModal = new FirstTimeVisitorModal();
    btnPlanVisit.addEventListener('click', (e) => {
      e.preventDefault();
      visitorModal.open();
    });
  }

  const modalHistory = $('#history-modal');
  const closeBtns = $$('.close-modal');
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (modalHistory) modalHistory.classList.remove('active');
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target === modalHistory) modalHistory.classList.remove('active');
  });
}

async function initWatchLiveButton(settingsPromise) {
  const btn = $('#btn-watch-live');
  if (!btn) return;

  let watchUrl = '#/worship/watch-live'; // fallback to internal page
  try {
    const settings = await settingsPromise;
    const wl = settings.watchLive;
    if (wl?.enabled !== false && wl?.url) {
      watchUrl = wl.url;
    }
    if (wl?.showButton === false || wl?.enabled === false) {
      btn.hidden = true;
      return;
    }
    if (wl?.buttonText) {
      const text = btn.querySelector('span') || btn;
      text.textContent = wl.buttonText;
    }
  } catch (err) {
    console.warn('[Watch Live] Could not fetch settings, using fallback.');
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    // External URL → open in new tab; internal hash → navigate in same tab
    if (watchUrl.startsWith('http')) {
      window.open(watchUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.hash = watchUrl.replace(/^#/, '');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize i18n FIRST (reads localStorage, wires buttons)
  initI18n();

  // Render navigation in chosen language
  renderNavigation();

  initModals();
  const settingsPromise = initializePublicSettings();
  initWatchLiveButton(settingsPromise);
  initScrollEffects();

  // Initialize SPA Router
  new Router();

  // Initialize Cookie Banner
  const cookieBanner = new CookieBanner();
  cookieBanner.init();

  // Initialize JS-rendered sections (they self-subscribe to langChange)
  if (document.getElementById('home-announcement-banner')) {
    new AnnouncementBanner('home-announcement-banner');
  }
  if (document.getElementById('home-welcome-section')) {
    new WelcomeSection('home-welcome-section');
  }
  if (document.getElementById('home-event-posters')) {
    new PosterCarousel('#home-event-posters');
  }
  if (document.getElementById('home-history-preview')) {
    new HistoryPreviewSection('home-history-preview');
  }
  new LeadershipSection('#home-leadership-section');
  new CampusSection('#home-campus-section');
  new MinistriesSection('#home-ministries-section');
  new UpcomingEvents('#upcoming-events-section');
  new SermonsSection('#home-sermons-section');
  new GetInvolvedSection('#home-get-involved-section');
  if (document.querySelector('.home-contact-form-wrapper')) {
    new ContactForm('.home-contact-form-wrapper');
  }
  new FinalCTASection('#home-final-cta-section');

  // Re-render navigation whenever language changes
  window.addEventListener('langChange', () => {
    renderNavigation();
  });

  // Hide the page loader immediately — page is ready to show
  const loader = document.getElementById('page-loader');
  if (loader) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        loader.classList.add('hidden');
      });
    });
  }

  // Fetch dynamic data IN PARALLEL in the background — does NOT block page display
  Promise.allSettled([
    fetch(`${API_BASE}/events`).then(r => {
      if (!r.ok) throw new Error('events_api_error');
      return r.json();
    }),
    fetch(`${API_BASE}/sermons`).then(r => {
      if (!r.ok) throw new Error('sermons_api_error');
      return r.json();
    }),
  ]).then(([eventsResult, sermonsResult]) => {
    // Events: success path
    if (eventsResult.status === 'fulfilled') {
      churchData.events = Array.isArray(eventsResult.value) ? eventsResult.value : [];
      window.dispatchEvent(new Event('eventsUpdated'));
    } else {
      // Events: failure path — dispatch error so component can leave skeleton state
      console.error('[Events] Failed to load events from API');
      window.dispatchEvent(new Event('eventsError'));
    }

    // Sermons: success path
    if (sermonsResult.status === 'fulfilled') {
      churchData.sermons = Array.isArray(sermonsResult.value) ? sermonsResult.value : [];
      window.dispatchEvent(new Event('sermonsUpdated'));
    } else {
      // Sermons: failure path — dispatch error so component can leave skeleton state
      console.error('[Sermons] Failed to load sermons from API');
      window.dispatchEvent(new Event('sermonsError'));
    }
  });
});

