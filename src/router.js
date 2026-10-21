import { trackPageView } from './cookie/cookieConsent.js';
import { ContactForm } from './components/ContactForm.js';
import { FirstTimeVisitorModal } from './components/VisitorModal.js';
import { supabaseClient } from './supabaseFrontendClient.js';

// Public visitors do not need the CMS or internal-page modules on their first
// page view. Loading them only when their route is opened reduces the initial
// JavaScript payload and keeps the admin code out of the public entry bundle.
const lazyModules = {
  renderer: () => import('./pages/PageRenderer.js'),
  galleryPage: () => import('./pages/GalleryPage.js'),
  pastorTeamPage: () => import('./pages/PastorTeamPage.js'),
  adminEvents: () => import('./admin/AdminEvents.js'),
  adminDonations: () => import('./admin/AdminDonations.js'),
  adminContacts: () => import('./admin/AdminContacts.js'),
  adminDashboard: () => import('./admin/AdminDashboard.js'),
  adminGallery: () => import('./admin/AdminGallery.js'),
  adminSermons: () => import('./admin/AdminSermons.js'),
  adminLogin: () => import('./admin/AdminLogin.js'),
  adminUsers: () => import('./admin/AdminUsers.js'),
  adminSiteSettings: () => import('./admin/AdminSiteSettings.js'),
  adminMinistries: () => import('./admin/AdminMinistries.js'),
  adminCampus: () => import('./admin/AdminCampus.js'),
  adminMedia: () => import('./admin/AdminMedia.js'),
  adminAuditLogs: () => import('./admin/AdminAuditLogs.js'),
  adminLeadership: () => import('./admin/AdminLeadership.js'),
  adminVisitors: () => import('./admin/AdminVisitors.js'),
  adminPosters: () => import('./admin/AdminPosters.js')
};

export class Router {
  constructor() {
    this.homepageView = document.getElementById('homepage-view');
    this.pageContentContainer = document.getElementById('page-content');
    this.mainHeader = document.querySelector('header');
    this.mainFooter = document.querySelector('footer');
    this.topBar = document.querySelector('.top-bar');

    
    // Bind routing events
    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Initial route check
    this.handleRoute();

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && window.location.hash.startsWith('#/admin')) {
        window.location.hash = '#/admin/login';
      }
    });
  }

  async handleRoute() {
    const hash = window.location.hash || '#/';
    
    // Always scroll to top when navigating
    window.scrollTo(0, 0);
    
    // Track SPA page view (internally checks for consent and admin/member isolation)
    trackPageView(hash);
    
    // Action overrides for modals
    if (hash === '#/visit/new-here') {
      window.history.replaceState(null, null, ' '); // Clear hash
      const visitorModal = new FirstTimeVisitorModal();
      visitorModal.open();
      return;
    }

    if (hash === '#/' || hash === '#' || hash === '') {
      this.showHomepage();
    } else if (hash.startsWith('#/admin')) {
      await this.showAdmin(hash);
    } else {
      await this.showInternalPage(hash.replace('#', ''));
    }
  }

  async getLazyComponent(key, exportName) {
    if (!this[key]) {
      const module = await lazyModules[key]();
      const Component = module[exportName];
      this[key] = new Component('page-content');
    }
    return this[key];
  }

  async showAdmin(hash) {
    this.homepageView.style.display = 'none';
    this.pageContentContainer.style.display = 'block';
    if (this.mainHeader) this.mainHeader.style.display = 'none';
    if (this.mainFooter) this.mainFooter.style.display = 'none';
    if (this.topBar) this.topBar.style.display = 'none';

    if (hash === '#/admin/logout') {
      await supabaseClient.auth.signOut();
      window.location.hash = '#/admin/login';
      return;
    }

    if (hash === '#/admin/login') {
      (await this.getLazyComponent('adminLogin', 'AdminLogin')).render();
      return;
    }

    // Protect all admin routes — require login
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.hash = '#/admin/login';
      return;
    }

    // getUser() obtains the current authoritative account record.
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    const isActive = user?.app_metadata?.is_active !== false && user?.user_metadata?.is_active !== false;
    if (userError || !user || !isActive || (role !== 'admin' && role !== 'super_admin')) {
      await supabaseClient.auth.signOut();
      window.location.hash = '#/admin/login';
      return;
    }
    const adminSession = { ...session, user };

    // Super Admin only — Admin Users page
    if (hash === '#/admin/users') {
      if (role !== 'super_admin') {
        this.pageContentContainer.innerHTML = `
          <div style="
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', sans-serif;
            background: #F8F9F7;
          ">
            <div style="
              background: white;
              border-radius: 20px;
              padding: 60px 48px;
              text-align: center;
              box-shadow: 0 8px 40px rgba(0,0,0,0.08);
              max-width: 480px;
              width: 90%;
            ">
              <div style="
                width: 80px; height: 80px;
                background: #fee2e2;
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                margin: 0 auto 24px;
              ">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h2 style="
                font-family: 'Playfair Display', serif;
                font-size: 28px;
                color: #111827;
                margin: 0 0 12px 0;
              ">Access Denied</h2>
              <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                You don't have permission to access <strong>Admin Users</strong>.
              </p>
              <p style="color: #9ca3af; font-size: 13px; margin: 0 0 32px 0;">
                This section is restricted to <strong style="color:#b47a18;">Super Admins</strong> only.
                Please contact your Super Admin if you need access.
              </p>
              <a href="#/admin" style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: #003F3A;
                color: white;
                text-decoration: none;
                padding: 12px 28px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                transition: background 0.2s;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to Dashboard
              </a>
            </div>
          </div>
        `;
        return;
      }
      (await this.getLazyComponent('adminUsers', 'AdminUsers')).render(adminSession);
      return;
    }

    // Super Admin only — Site Settings page
    if (hash === '#/admin/settings') {
      if (role !== 'super_admin') {
        this.pageContentContainer.innerHTML = `
          <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;background:#F8F9F7;">
            <div style="background:white;border-radius:20px;padding:60px 48px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.08);max-width:480px;width:90%;">
              <div style="width:80px;height:80px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h2 style="font-family:'Playfair Display',serif;font-size:28px;color:#111827;margin:0 0 12px;">Access Denied</h2>
              <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 8px;">You don't have permission to access <strong>Site Settings</strong>.</p>
              <p style="color:#9ca3af;font-size:13px;margin:0 0 32px;">This section is restricted to <strong style="color:#b47a18;">Super Admins</strong> only.</p>
              <a href="#/admin" style="display:inline-flex;align-items:center;gap:8px;background:#003F3A;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Dashboard
              </a>
            </div>
          </div>
        `;
        return;
      }
      (await this.getLazyComponent('adminSiteSettings', 'AdminSiteSettings')).render();
      return;
    }

    if (hash === '#/admin/donations') {
      (await this.getLazyComponent('adminDonations', 'AdminDonations')).render();
    } else if (hash === '#/admin/contacts') {
      (await this.getLazyComponent('adminContacts', 'AdminContacts')).render();
    } else if (hash === '#/admin/events') {
      (await this.getLazyComponent('adminEvents', 'AdminEvents')).render();
    } else if (hash === '#/admin/gallery') {
      (await this.getLazyComponent('adminGallery', 'AdminGallery')).render();
    } else if (hash === '#/admin/sermons') {
      (await this.getLazyComponent('adminSermons', 'AdminSermons')).render();
    } else if (hash === '#/admin/ministries') {
      (await this.getLazyComponent('adminMinistries', 'AdminMinistries')).render();
    } else if (hash === '#/admin/campus') {
      (await this.getLazyComponent('adminCampus', 'AdminCampus')).render();
    } else if (hash === '#/admin/media') {
      (await this.getLazyComponent('adminMedia', 'AdminMedia')).render();
    } else if (hash === '#/admin/logs') {
      if (role !== 'super_admin') {
        window.location.hash = '#/admin';
        return;
      }
      (await this.getLazyComponent('adminAuditLogs', 'AdminAuditLogs')).render();
    } else if (hash === '#/admin/leadership') {
      (await this.getLazyComponent('adminLeadership', 'AdminLeadership')).render();
    } else if (hash === '#/admin/visitors') {
      (await this.getLazyComponent('adminVisitors', 'AdminVisitors')).render();
    } else if (hash === '#/admin/event-posters' || hash === '#/admin/posters') {
      (await this.getLazyComponent('adminPosters', 'AdminPosters')).render();
    } else {
      (await this.getLazyComponent('adminDashboard', 'AdminDashboard')).render();
    }
  }



  showHomepage() {
    this.pageContentContainer.style.display = 'none';
    this.homepageView.style.display = 'block';
    if (this.mainHeader) this.mainHeader.style.display = 'block';
    if (this.mainFooter) this.mainFooter.style.display = 'block';
    if (this.topBar) this.topBar.style.display = 'block';
    
    // Re-bind homepage forms if necessary (already bound in main.js on DOMContentLoaded, so this is fine)
  }

  async showInternalPage(path) {
    this.homepageView.style.display = 'none';
    this.pageContentContainer.style.display = 'block';
    if (this.mainHeader) this.mainHeader.style.display = 'block';
    if (this.mainFooter) this.mainFooter.style.display = 'block';
    if (this.topBar) this.topBar.style.display = 'block';

    // Gallery — own full-page layout (hero + grid + lightbox)
    if (path === '/gallery') {
      (await this.getLazyComponent('galleryPage', 'GalleryPage')).render();
      return;
    }

    // Pastor Team
    if (path === '/pastor-team' || path.startsWith('/pastor-team/')) {
      (await this.getLazyComponent('pastorTeamPage', 'PastorTeamPage')).render(path);
      return;
    }

    // Render the specific page content
    (await this.getLazyComponent('renderer', 'PageRenderer')).render(path);
    
    // Special case: if it's the contact page, bind the contact form
    if (path === '/visit/contact' || path === '/visit' || path === '/visit/plan') {
      setTimeout(() => {
        const contactWrapper = this.pageContentContainer.querySelector('.contact-form-wrapper-page');
        if (contactWrapper) {
          contactWrapper.innerHTML = '';
          new ContactForm('.contact-form-wrapper-page');
        }
      }, 150);
    }
    
    // Special case: initialize the FaithfulnessTimeline if it exists on the rendered page
    setTimeout(async () => {
      if (document.getElementById('about-faithfulness-timeline')) {
        const { FaithfulnessTimeline } = await import('./components/FaithfulnessTimeline.js');
        new FaithfulnessTimeline('#about-faithfulness-timeline');
      }
    }, 50);
  }
}
