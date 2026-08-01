'use strict';

const Validator = (() => {

  // ============================================================
  //  PHONE RULES — country code → required digit count
  // ============================================================
  const PHONE_RULES = {

    // 🌍 AFRICA
    '+260': { name: 'Zambia', digits: 9, flag: '🇿🇲', placeholder: '971 234 567' },
    '+263': { name: 'Zimbabwe', digits: 9, flag: '🇿🇼', placeholder: '77 123 4567' },
    '+27':  { name: 'South Africa', digits: 9, flag: '🇿🇦', placeholder: '82 123 4567' },
    '+267': { name: 'Botswana', digits: 8, flag: '🇧🇼', placeholder: '71 234 567' },
    '+258': { name: 'Mozambique', digits: 9, flag: '🇲🇿', placeholder: '82 123 4567' },
    '+265': { name: 'Malawi', digits: 9, flag: '🇲🇼', placeholder: '991 234 567' },
    '+255': { name: 'Tanzania', digits: 9, flag: '🇹🇿', placeholder: '712 345 678' },
    '+254': { name: 'Kenya', digits: 9, flag: '🇰🇪', placeholder: '712 345 678' },
    '+256': { name: 'Uganda', digits: 9, flag: '🇺🇬', placeholder: '712 345 678' },
    '+250': { name: 'Rwanda', digits: 9, flag: '🇷🇼', placeholder: '788 123 456' },
    '+251': { name: 'Ethiopia', digits: 9, flag: '🇪🇹', placeholder: '911 234 567' },
    '+234': { name: 'Nigeria', digits: 10, flag: '🇳🇬', placeholder: '802 345 6789' },
    '+233': { name: 'Ghana', digits: 9, flag: '🇬🇭', placeholder: '201 234 567' },
    '+221': { name: 'Senegal', digits: 9, flag: '🇸🇳', placeholder: '77 123 4567' },
    '+225': { name: 'Côte d\'Ivoire', digits: 10, flag: '🇨🇮', placeholder: '01 23 45 67 89' },
    '+237': { name: 'Cameroon', digits: 9, flag: '🇨🇲', placeholder: '671 23 45 67' },
    '+243': { name: 'DR Congo', digits: 9, flag: '🇨🇩', placeholder: '991 234 567' },
    '+244': { name: 'Angola', digits: 9, flag: '🇦🇴', placeholder: '923 123 456' },
    '+264': { name: 'Namibia', digits: 9, flag: '🇳🇦', placeholder: '81 123 4567' },
    '+20':  { name: 'Egypt', digits: 10, flag: '🇪🇬', placeholder: '100 123 4567' },
    '+212': { name: 'Morocco', digits: 9, flag: '🇲🇦', placeholder: '612 345 678' },
    '+216': { name: 'Tunisia', digits: 8, flag: '🇹🇳', placeholder: '20 123 456' },
    '+213': { name: 'Algeria', digits: 9, flag: '🇩🇿', placeholder: '551 23 45 67' },
  
    // 🌍 EUROPE
    '+44': { name: 'United Kingdom', digits: 10, flag: '🇬🇧', placeholder: '7911 123456' },
    '+49': { name: 'Germany', digits: 10, flag: '🇩🇪', placeholder: '170 1234567' },
    '+33': { name: 'France', digits: 9, flag: '🇫🇷', placeholder: '6 12 34 56 78' },
    '+39': { name: 'Italy', digits: 10, flag: '🇮🇹', placeholder: '312 345 6789' },
    '+34': { name: 'Spain', digits: 9, flag: '🇪🇸', placeholder: '612 34 56 78' },
    '+31': { name: 'Netherlands', digits: 9, flag: '🇳🇱', placeholder: '612 345 678' },
    '+32': { name: 'Belgium', digits: 9, flag: '🇧🇪', placeholder: '470 12 34 56' },
    '+41': { name: 'Switzerland', digits: 9, flag: '🇨🇭', placeholder: '78 123 45 67' },
    '+46': { name: 'Sweden', digits: 9, flag: '🇸🇪', placeholder: '70 123 45 67' },
    '+47': { name: 'Norway', digits: 8, flag: '🇳🇴', placeholder: '412 34 567' },
    '+45': { name: 'Denmark', digits: 8, flag: '🇩🇰', placeholder: '12 34 56 78' },
    '+48': { name: 'Poland', digits: 9, flag: '🇵🇱', placeholder: '512 345 678' },
    '+351': { name: 'Portugal', digits: 9, flag: '🇵🇹', placeholder: '912 345 678' },
    '+43': { name: 'Austria', digits: 10, flag: '🇦🇹', placeholder: '660 1234567' },
    '+353': { name: 'Ireland', digits: 9, flag: '🇮🇪', placeholder: '85 123 4567' },
  
    // 🌍 AMERICAS
    '+1':  { name: 'USA / Canada', digits: 10, flag: '🇺🇸', placeholder: '202 555 0147' },
    '+52': { name: 'Mexico', digits: 10, flag: '🇲🇽', placeholder: '55 1234 5678' },
    '+55': { name: 'Brazil', digits: 11, flag: '🇧🇷', placeholder: '11 91234 5678' },
    '+54': { name: 'Argentina', digits: 10, flag: '🇦🇷', placeholder: '11 1234 5678' },
    '+57': { name: 'Colombia', digits: 10, flag: '🇨🇴', placeholder: '300 123 4567' },
    '+56': { name: 'Chile', digits: 9, flag: '🇨🇱', placeholder: '912 345 678' },
  
    // 🌍 ASIA & OCEANIA
    '+86': { name: 'China', digits: 11, flag: '🇨🇳', placeholder: '131 2345 6789' },
    '+81': { name: 'Japan', digits: 10, flag: '🇯🇵', placeholder: '90 1234 5678' },
    '+91': { name: 'India', digits: 10, flag: '🇮🇳', placeholder: '98765 43210' },
    '+61': { name: 'Australia', digits: 9, flag: '🇦🇺', placeholder: '412 345 678' },
    '+64': { name: 'New Zealand', digits: 9, flag: '🇳🇿', placeholder: '21 123 4567' },
    '+65': { name: 'Singapore', digits: 8, flag: '🇸🇬', placeholder: '8123 4567' },
    '+971': { name: 'UAE', digits: 9, flag: '🇦🇪', placeholder: '50 123 4567' },
    '+966': { name: 'Saudi Arabia', digits: 9, flag: '🇸🇦', placeholder: '50 123 4567' }
  
  };
  // ============================================================
  //  EMAIL
  // ============================================================
  function validateEmail(raw) {
    const email = raw.trim().toLowerCase();
  
    if (!email) {
      return { ok: false, value: email, error: 'Email is required.' };
    }
  
    if (/\s/.test(email)) {
      return { ok: false, value: email, error: 'Email must not contain spaces.' };
    }
  
    const pattern = /^[a-z0-9._%+\-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  
    if (!pattern.test(email)) {
      return {
        ok: false,
        value: email,
        error: 'Enter a valid email (e.g. example@domain.com)'
      };
    }
  
    return { ok: true, value: email, error: null };
  }

  // ============================================================
  //  PHONE
  // ============================================================
  function sanitizePhone(raw) { return raw.replace(/\D/g, ''); }

  function validatePhone(raw, countryCode) {
    let digits = sanitizePhone(raw);
    const rule = PHONE_RULES[countryCode];

    if (!digits) {
      return { ok: false, value: digits, error: 'Phone number is required.' };
    }

    if (!rule) {
      return { ok: false, value: digits, error: 'Unsupported country.' };
    }

    // Remove leading 0 (common user mistake)
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    // rule.digits is a plain number — compare directly
    if (digits.length !== rule.digits) {
      return {
        ok: false,
        value: digits,
        error: `${rule.name} numbers must be exactly ${rule.digits} digits (you entered ${digits.length}).`
      };
    }

    return {
      ok: true,
      value: `${countryCode}${digits}`,
      error: null
    };
  }

  // ============================================================
  //  PASSWORD  (min 8, upper, lower, number, special)
  // ============================================================
  function validatePassword(raw) {
    if (!raw) {
      return { ok: false, strength: 0, errors: ['Password is required.'] };
    }
  
    let score = 0;
    const errors = [];
  
    if (raw.length >= 8) score++; else errors.push('At least 8 characters.');
    if (/[A-Z]/.test(raw)) score++; else errors.push('Add uppercase letter.');
    if (/[a-z]/.test(raw)) score++; else errors.push('Add lowercase letter.');
    if (/[0-9]/.test(raw)) score++; else errors.push('Add a number.');
    if (/[^A-Za-z0-9]/.test(raw)) score++; else errors.push('Add special character.');
  
    const strength = Math.min(score, 4);
  
    return {
      ok: errors.length === 0,
      strength,
      errors
    };
  }

  // ============================================================
  //  NAME
  // ============================================================
  function validateName(raw, label = 'Name') {
    const value = raw.trim();
    if (!value)           return { ok: false, value, error: `${label} is required.` };
    if (value.length < 2) return { ok: false, value, error: `${label} must be at least 2 characters.` };
    if (/[^a-zA-Z\s\-']/.test(value))
      return { ok: false, value, error: `${label} contains invalid characters.` };
    return { ok: true, value, error: null };
  }

  // ============================================================
  //  SANITIZE — trim + strip HTML tags
  // ============================================================
  function sanitizeText(raw) {
    return String(raw)
      .trim()
      .replace(/<[^>]*>?/gm, '') // remove HTML tags
      .replace(/[<>]/g, '');     // extra protection
  }

  // ============================================================
  //  DOM HELPERS
  // ============================================================
  function showError(inputEl, message) {
    if (!inputEl) return;
    let errEl = inputEl.parentElement && inputEl.parentElement.querySelector('.field-error');
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error';
      inputEl.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
    inputEl.classList.add('input-invalid');
    inputEl.classList.remove('input-valid');
  }

  function showValid(inputEl) {
    if (!inputEl) return;
    const errEl = inputEl.parentElement && inputEl.parentElement.querySelector('.field-error');
    if (errEl) errEl.textContent = '';
    inputEl.classList.remove('input-invalid');
    inputEl.classList.add('input-valid');
  }

  function clearState(inputEl) {
    if (!inputEl) return;
    const errEl = inputEl.parentElement && inputEl.parentElement.querySelector('.field-error');
    if (errEl) errEl.textContent = '';
    inputEl.classList.remove('input-invalid', 'input-valid');
  }

  // ============================================================
  //  PASSWORD STRENGTH BAR
  // ============================================================
  function renderStrengthBar(containerEl, strength) {
    if (!containerEl) return;
    let bar = containerEl.querySelector('.strength-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'strength-bar';
      bar.innerHTML = `<div class="strength-track"><div class="strength-fill"></div></div><span class="strength-label"></span>`;
      containerEl.appendChild(bar);
    }
    const levels = [
      { pct: 0,   color: 'transparent', text: ''       },
      { pct: 25,  color: '#e74c3c',     text: 'Weak'   },
      { pct: 50,  color: '#e67e22',     text: 'Fair'   },
      { pct: 75,  color: '#f1c40f',     text: 'Good'   },
      { pct: 100, color: '#2ecc71',     text: 'Strong' },
    ];
    const lv = levels[Math.min(strength, 4)];
    bar.querySelector('.strength-fill').style.cssText = `width:${lv.pct}%;background:${lv.color}`;
    const lbl = bar.querySelector('.strength-label');
    lbl.textContent = lv.text;
    lbl.style.color = lv.color;
  }

  // ============================================================
  //  PHONE FIELD BUILDER
  // ============================================================
  function buildPhoneField(wrapEl, inputId) {
    if (!wrapEl) return { select: null, input: null };

    const defaultRule = PHONE_RULES['+260'];

    // Options show: code only (no flags, no country name in the visible label)
    const options = Object.entries(PHONE_RULES)
      .map(([code, r]) => `<option value="${code}">${code} (${r.name})</option>`)
      .join('');

    wrapEl.innerHTML = `
      <div class="phone-row">
        <select class="phone-code-select" id="${inputId}-code" aria-label="Country code">${options}</select>
        <input type="tel" id="${inputId}" class="modal-input phone-number-input"
               placeholder="${defaultRule.placeholder}"
               maxlength="${defaultRule.digits}"
               autocomplete="tel-national" />
      </div>`;

    const select = wrapEl.querySelector(`#${inputId}-code`);
    const input  = wrapEl.querySelector(`#${inputId}`);

    // Strip non-digits as user types and hard-enforce maxlength
    input.addEventListener('input', () => {
      let cleaned = input.value.replace(/\D/g, '');
      const rule  = PHONE_RULES[select.value];
      if (rule && cleaned.length > rule.digits) {
        cleaned = cleaned.slice(0, rule.digits);
      }
      if (input.value !== cleaned) input.value = cleaned;
    });

    // Update placeholder + maxlength when country changes
    select.addEventListener('change', () => {
      const rule = PHONE_RULES[select.value];
      if (rule) {
        input.placeholder = rule.placeholder;
        input.maxLength   = rule.digits;
        input.value       = ''; // clear when switching country
      }
    });

    // Strip leading zero on blur
    input.addEventListener('blur', () => {
      if (input.value.startsWith('0')) {
        input.value = input.value.substring(1);
      }
    });

    return { select, input };
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================
  return {
    PHONE_RULES,
    validateEmail,
    validatePhone,
    validatePassword,
    validateName,
    sanitizeText,
    sanitizePhone,
    showError,
    showValid,
    clearState,
    renderStrengthBar,
    buildPhoneField,
  };

})();