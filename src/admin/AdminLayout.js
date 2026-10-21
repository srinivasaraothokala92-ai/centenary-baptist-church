import './admin.css';

export class AdminLayout {
  static getLayout(content, activePath) {
    const isActive = (path) => activePath === path ? 'active' : '';

    // Components replace their container's markup after this method returns. Defer
    // binding until that replacement is in the document, while keeping the
    // listener itself delegated and idempotent across route changes.
    window.requestAnimationFrame(() => this.bindResponsiveNavigation());

    return `
      <div class="admin-wrapper">
        <aside class="admin-sidebar" id="admin-sidebar" aria-label="Admin navigation">
          <div class="admin-sidebar-header">
            <img src="/images/cbc-logo-header.png" alt="Centenary Baptist Church" style="border-radius:50%;" onerror="this.style.display='none'">
            <div>
              <h1>CENTENARY<br>BAPTIST CHURCH</h1>
              <span>Admin Panel</span>
            </div>
          </div>
          <nav class="admin-nav">
            <a href="#/admin" class="${isActive('/admin')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
              Dashboard
            </a>
            <a href="#/admin/events" class="${isActive('/admin/events')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>
              Events
            </a>
            <a href="#/admin/sermons" class="${isActive('/admin/sermons')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              Sermons
            </a>
            <a href="#/admin/ministries" class="${isActive('/admin/ministries')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              Ministries
            </a>
            <a href="#/admin/campus" class="${isActive('/admin/campus')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/></svg>
              Campus
            </a>
            <a href="#/admin/leadership" class="${isActive('/admin/leadership')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              Leadership
            </a>
            <a href="#/admin/donations" class="${isActive('/admin/donations')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              Donations
            </a>
            <a href="#/admin/contacts" class="${isActive('/admin/contacts')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              Form Submissions <span class="sidebar-badge">12</span>
            </a>
            <a href="#/admin/visitors" class="${isActive('/admin/visitors')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              Visitors
            </a>
            <a href="#/admin/media" class="${isActive('/admin/media')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
              Media Library
            </a>
            <a href="#/admin/gallery" class="${isActive('/admin/gallery')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/></svg>
              Gallery Upload
            </a>
            <a href="#/admin/event-posters" class="${isActive('/admin/event-posters')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zm-6.5-5.5l-2.5 3.01L9.5 11l-3 4h11l-3.5-4.5z"/></svg>
              Event Posters
            </a>
            <a href="#/admin/settings" class="${isActive('/admin/settings')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
              Site Settings
            </a>
            <a href="#/admin/users" class="${isActive('/admin/users')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              Admin Users
            </a>
            <a href="#/admin/logs" class="${isActive('/admin/logs')}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              Audit Logs
            </a>
            <br>
            <a href="#/">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
              View Live Site
            </a>
            <a href="#/admin/logout" id="admin-logout-btn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
              Logout
            </a>
          </nav>
          <div class="sidebar-footer">
            Est. 1875<br>
            "We Preach Christ Crucified"<br>
            <span style="font-size: 0.7rem; font-family: 'Inter', sans-serif;">1 Cor. 1:23</span>
          </div>
        </aside>
        <button type="button" class="admin-sidebar-backdrop" aria-label="Close navigation" tabindex="-1"></button>

        <main class="admin-main">
          <div class="admin-topbar">
            <button type="button" class="admin-menu-toggle" data-admin-menu-toggle aria-label="Open navigation" aria-controls="admin-sidebar" aria-expanded="false">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
            <div class="topbar-left">
              <h2><span class="topbar-title-full">Centenary Baptist Church, Secunderabad</span><span class="topbar-title-short">CBC Admin</span></h2>
              <span>Content Management System</span>
            </div>
            <div class="topbar-right">
              <button type="button" class="admin-search-toggle" data-admin-search-toggle aria-label="Open search" aria-controls="admin-global-search" aria-expanded="false">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg>
              </button>
              <div class="topbar-search" id="admin-global-search">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" placeholder="Search anything...">
              </div>
              <div class="topbar-icons">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/><circle cx="18" cy="6" r="3" fill="#ef4444"/></svg>
              </div>
              <div class="topbar-user">
                <div class="user-avatar">A</div>
                <div class="user-info">
                  <strong>Admin User</strong>
                  <span>Administrator</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="admin-content-inner">
            ${content}
          </div>
        </main>
      </div>
    `;
  }

  static bindResponsiveNavigation() {
    if (this.responsiveNavigationBound) return;
    this.responsiveNavigationBound = true;

    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-admin-menu-toggle]');
      if (toggle) {
        const wrapper = toggle.closest('.admin-wrapper');
        this.setSidebarOpen(wrapper, !wrapper?.classList.contains('admin-sidebar-open'));
        return;
      }

      if (event.target.closest('.admin-sidebar-backdrop') || event.target.closest('.admin-sidebar .admin-nav a')) {
        this.setSidebarOpen(document.querySelector('.admin-wrapper'), false);
        return;
      }

      const searchToggle = event.target.closest('[data-admin-search-toggle]');
      if (searchToggle) {
        const wrapper = searchToggle.closest('.admin-wrapper');
        const open = !wrapper?.classList.contains('admin-search-open');
        wrapper?.classList.toggle('admin-search-open', open);
        searchToggle.setAttribute('aria-expanded', String(open));
        searchToggle.setAttribute('aria-label', open ? 'Close search' : 'Open search');
        if (open) wrapper?.querySelector('.topbar-search input')?.focus();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const wrapper = document.querySelector('.admin-wrapper');
      this.setSidebarOpen(wrapper, false);
      if (wrapper?.classList.contains('admin-search-open')) {
        wrapper.classList.remove('admin-search-open');
        const searchToggle = wrapper.querySelector('[data-admin-search-toggle]');
        searchToggle?.setAttribute('aria-expanded', 'false');
        searchToggle?.setAttribute('aria-label', 'Open search');
      }
    });
  }

  static setSidebarOpen(wrapper, open) {
    if (!wrapper) return;

    wrapper.classList.toggle('admin-sidebar-open', open);
    document.body.classList.toggle('admin-drawer-open', open);

    const toggle = wrapper.querySelector('[data-admin-menu-toggle]');
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
}
