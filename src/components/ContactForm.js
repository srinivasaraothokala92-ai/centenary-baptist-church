import { API_BASE } from '../apiConfig.js';
import { getSiteSettings } from '../siteSettings.js';
import { t } from '../i18n.js';
import './ContactForm.css';

export class ContactForm {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;
    
    this.render();
    this.bindEvents();
    this.applySiteSettings();
    window.addEventListener('langChange', () => this.refreshLocale());
  }

  refreshLocale() {
    if (this.isDisabled || !this.container?.isConnected) return;

    const values = this.inputs ? Object.fromEntries(
      Object.entries(this.inputs)
        .filter(([key]) => key !== 'honeypot')
        .map(([key, input]) => [key, input.value])
    ) : {};
    const activeView = this.successView?.style.display === 'block'
      ? 'success'
      : this.errorView?.style.display === 'block'
        ? 'error'
        : 'form';

    this.render();
    Object.entries(values).forEach(([key, value]) => {
      if (this.inputs[key]) this.inputs[key].value = value;
    });
    this.bindEvents();
    this.showView(activeView, this.lastErrorMessage);
  }

  async applySiteSettings() {
    const settings = await getSiteSettings();
    if (settings.contactForm?.enabled === false) {
      this.isDisabled = true;
      this.container.innerHTML = '';
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="contact-form-card">
        <div class="cf-form-view">
          <form id="cbc-contact-form" novalidate>
            <!-- Honeypot -->
            <input type="text" name="honeypot" id="cf-honeypot" style="display:none" tabindex="-1" autocomplete="off" />

            <div class="cf-row">
              <div class="cf-group">
                <label for="cf-fname">${t('formFName')} <span>*</span></label>
                <input type="text" id="cf-fname" class="cf-input" name="firstName" placeholder="${t('formFNamePlaceholder')}" required />
                <span class="cf-error-text">${t('formFNameError')}</span>
              </div>
              <div class="cf-group">
                <label for="cf-lname">${t('formLName')} <span>*</span></label>
                <input type="text" id="cf-lname" class="cf-input" name="lastName" placeholder="${t('formLNamePlaceholder')}" required />
                <span class="cf-error-text">${t('formLNameError')}</span>
              </div>
            </div>

            <div class="cf-row">
              <div class="cf-group">
                <label for="cf-phone">${t('formPhone')} <span>*</span></label>
                <input type="tel" id="cf-phone" class="cf-input" name="phone" placeholder="${t('formPhonePlaceholder')}" required />
                <span class="cf-error-text">${t('formPhoneError')}</span>
              </div>
              <div class="cf-group">
                <label for="cf-email">${t('formEmail')} <span>*</span></label>
                <input type="email" id="cf-email" class="cf-input" name="email" placeholder="${t('formEmailPlaceholder')}" required />
                <span class="cf-error-text">${t('formEmailError')}</span>
              </div>
            </div>

            <div class="cf-group" style="margin-bottom: 24px;">
              <label for="cf-message">${t('formMsg')} <span>*</span></label>
              <textarea id="cf-message" class="cf-textarea" name="message" placeholder="${t('formMsgPlaceholder')}" required></textarea>
              <span class="cf-error-text">${t('formMsgError')}</span>
            </div>

            <button type="submit" class="cf-submit" id="cf-submit-btn">
              <span>${t('formSubmit')}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </form>
        </div>

        <div class="cf-success-state" style="display: none;">
          <div class="cf-success-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h3 class="cf-state-title">${t('formSuccessTitle')}</h3>
          <p class="cf-state-desc">${t('formSuccessDesc')}</p>
          <button class="cf-btn-reset" id="cf-btn-success-reset">${t('formSendAnother')}</button>
        </div>

        <div class="cf-error-state" style="display: none;">
          <div class="cf-error-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 class="cf-state-title">${t('formErrorTitle')}</h3>
          <p class="cf-state-desc" id="cf-error-message">${t('formErrorDesc')}</p>
          <button class="cf-btn-reset" id="cf-btn-error-reset">${t('formTryAgain')}</button>
        </div>
      </div>
    `;
    
    this.formView = this.container.querySelector('.cf-form-view');
    this.successView = this.container.querySelector('.cf-success-state');
    this.errorView = this.container.querySelector('.cf-error-state');
    this.form = this.container.querySelector('#cbc-contact-form');
    this.submitBtn = this.container.querySelector('#cf-submit-btn');
    this.btnText = this.submitBtn.querySelector('span');
    
    this.inputs = {
      fname: this.container.querySelector('#cf-fname'),
      lname: this.container.querySelector('#cf-lname'),
      phone: this.container.querySelector('#cf-phone'),
      email: this.container.querySelector('#cf-email'),
      message: this.container.querySelector('#cf-message'),
      honeypot: this.container.querySelector('#cf-honeypot')
    };
  }

  bindEvents() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Clear validation error on input
    Object.values(this.inputs).forEach(input => {
      input.addEventListener('input', () => {
        const group = input.closest('.cf-group');
        if (group && group.classList.contains('has-error')) {
          group.classList.remove('has-error');
        }
      });
    });

    this.container.querySelector('#cf-btn-success-reset').addEventListener('click', () => {
      this.form.reset();
      this.showView('form');
    });

    this.container.querySelector('#cf-btn-error-reset').addEventListener('click', () => {
      this.showView('form');
    });
  }

  validate() {
    let isValid = true;
    const { fname, lname, phone, email, message } = this.inputs;

    if (!fname.value.trim()) {
      fname.closest('.cf-group').classList.add('has-error');
      isValid = false;
    }
    
    if (!lname.value.trim()) {
      lname.closest('.cf-group').classList.add('has-error');
      isValid = false;
    }

    if (!phone.value.trim() || phone.value.replace(/[^0-9+]/g, '').length < 8) {
      phone.closest('.cf-group').classList.add('has-error');
      isValid = false;
    }

    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.closest('.cf-group').classList.add('has-error');
      isValid = false;
    }
    
    if (!message.value.trim() || message.value.trim().length < 10) {
      message.closest('.cf-group').classList.add('has-error');
      isValid = false;
    }

    return isValid;
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    if (!this.validate()) return;

    // Loading State
    this.submitBtn.disabled = true;
    this.btnText.textContent = t('formSending');

    const payload = {
      firstName: this.inputs.fname.value.trim(),
      lastName: this.inputs.lname.value.trim(),
      phone: this.inputs.phone.value.trim(),
      email: this.inputs.email.value.trim(),
      message: this.inputs.message.value.trim(),
      honeypot: this.inputs.honeypot.value
    };

    try {
      const response = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        this.showView('success');
      } else {
        this.showView('error', data.error);
      }
    } catch (err) {
      console.error('Contact Form Submission Error:', err);
      this.showView('error');
    } finally {
      this.submitBtn.disabled = false;
      this.btnText.textContent = t('formSubmit');
    }
  }

  showView(viewName, errorMsg = null) {
    this.formView.style.display = 'none';
    this.successView.style.display = 'none';
    this.errorView.style.display = 'none';

    if (viewName === 'form') {
      this.lastErrorMessage = null;
      this.formView.style.display = 'block';
    } else if (viewName === 'success') {
      this.lastErrorMessage = null;
      this.successView.style.display = 'block';
    } else if (viewName === 'error') {
      this.errorView.style.display = 'block';
      this.lastErrorMessage = errorMsg || this.lastErrorMessage || null;
      if (this.lastErrorMessage) {
        this.container.querySelector('#cf-error-message').textContent = this.lastErrorMessage;
      }
    }
  }
}
