'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  //  STATE & CONSTANTS
  // ============================================================

  const API = 'https://illstar-backend.onrender.com/api';
  const WA_NUMBER = '260971467772';

  // ── TAB SWITCHING ──────────────────────────────────────────────
  const payTabs  = document.querySelectorAll('.pay-tab');
  const payViews = document.querySelectorAll('.pay-view');

  payTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      payTabs.forEach(t  => t.classList.remove('active'));
      payViews.forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });

  const SHIPPING_RULES = {
    ZM: {
      freeThreshold: 800,
      provinces: {
        lusaka: 50, copperbelt: 80, central: 90, eastern: 110,
        southern: 100, northwestern: 130, western: 120, northern: 140,
        luapula: 140, muchinga: 150,
      },
      default: 100,
    },
    SADC: 15, AFRICA: 25, EUROPE_NA: 35, REST: 45,
  };

  // These rates are only ever used as a LAST-RESORT fallback — for a
  // product that has no explicit price_usd/price_gbp/price_eur set in the
  // admin. Whenever a product DOES have an explicit price for the selected
  // currency, that exact number is used instead (see getProductDisplayPrice
  // and getCartItemDisplayPrice below). Kept in line with your typical
  // pricing pattern (~K250 ↔ ~$50/£50/€50) so the fallback estimate is sane.
  // Matches the header currency dropdown's rates too — keep both in sync.
  const COUNTRY_CURRENCY_MAP = {
    ZM: { symbol: 'K',  code: 'ZMW', rate: 1     },
    DE: { symbol: '€',  code: 'EUR', rate: 0.20  },
    FR: { symbol: '€',  code: 'EUR', rate: 0.20  },
    IT: { symbol: '€',  code: 'EUR', rate: 0.20  },
    ES: { symbol: '€',  code: 'EUR', rate: 0.20  },
    NL: { symbol: '€',  code: 'EUR', rate: 0.20  },
    BE: { symbol: '€',  code: 'EUR', rate: 0.20  },
    AT: { symbol: '€',  code: 'EUR', rate: 0.20  },
    GB: { symbol: '£',  code: 'GBP', rate: 0.20  },
  };
  const DEFAULT_CURRENCY = { symbol: '$', code: 'USD', rate: 0.20 };
    // Real-world exchange rates used ONLY to calculate the true ZMW value for the database
  const REAL_EXCHANGE_RATES = {
    'ZMW': 1,
    'USD': 0.036, // $1 = ~K27.5
    'EUR': 0.033, // €1 = ~K30
    'GBP': 0.029  // £1 = ~K35
  };
  let currentCurrency = { symbol: 'K', rate: 1 };
  const currencyMap   = { 'K': 'ZMW', '$': 'USD', '£': 'GBP', '€': 'EUR' };

  let products    = [];
  let cart        = JSON.parse(localStorage.getItem('cart'))        || [];
  let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
  let token       = localStorage.getItem('token')                   || null;

  // ============================================================
  //  TOAST NOTIFICATION
  // ============================================================

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3500);
  }

  // ============================================================
  //  CURRENCY HELPERS
  // ============================================================

  function setCurrency(symbol, rate) {
    currentCurrency.symbol = symbol;
    currentCurrency.rate   = rate;
    const btn = document.getElementById('currency-btn');
    if (btn) {
      const selectedItem = document.querySelector(`#currency-list li[data-symbol="${symbol}"]`);
      const img  = selectedItem?.querySelector('img')?.src || '';
      const text = selectedItem?.textContent.trim() || symbol;
      btn.innerHTML = `<img src="${img}" style="width:16px; margin-right:6px;"> ${text} ▾`;
    }
    renderProducts(); renderCart(); coRenderItems();
  }

  function updateCurrencyByCountry(countryCode) {
    const currency = COUNTRY_CURRENCY_MAP[countryCode] || DEFAULT_CURRENCY;
    setCurrency(currency.symbol, currency.rate);
  }

  // ============================================================
  //  SHIPPING HELPERS
  // ============================================================

  function getShippingZone(countryCode) {
    const sadc     = ['ZM','ZW','ZA','BW','MZ','MW','TZ','NA','AO','CD'];
    const africa   = ['KE','UG','RW','ET','NG','GH','SN','CI','CM','EG','MA','TN','DZ'];
    const europeNA = ['GB','DE','FR','IT','ES','NL','BE','CH','SE','NO','DK','PL','PT','AT','IE','US','CA'];
    if (countryCode === 'ZM')           return 'ZAMBIA';
    if (sadc.includes(countryCode))     return 'SADC';
    if (africa.includes(countryCode))   return 'AFRICA';
    if (europeNA.includes(countryCode)) return 'EUROPE_NA';
    return 'REST';
  }

  let pickupMode = false;

  function calculateShipping() {
    if (pickupMode) return 0;
    const countryCode = document.getElementById('co-country')?.value  || '';
    const province    = (document.getElementById('co-province')?.value || '').toLowerCase();
    const zone        = getShippingZone(countryCode);
    if (zone === 'ZAMBIA') {
      // Always compare against the fixed ZMW subtotal — never a converted
      // display price — or the free-shipping threshold breaks in other currencies.
      const subtotalZMW = cart.reduce((s, i) => s + i.baseZMW * i.qty, 0);
      if (subtotalZMW >= SHIPPING_RULES.ZM.freeThreshold) return 0;
      const rateZMW = SHIPPING_RULES.ZM.provinces[province] ?? SHIPPING_RULES.ZM.default;
      return rateZMW * currentCurrency.rate;
    }
    const usdToDisplay = (usd) => (usd / DEFAULT_CURRENCY.rate) * currentCurrency.rate;
    if (zone === 'SADC')      return usdToDisplay(SHIPPING_RULES.SADC);
    if (zone === 'AFRICA')    return usdToDisplay(SHIPPING_RULES.AFRICA);
    if (zone === 'EUROPE_NA') return usdToDisplay(SHIPPING_RULES.EUROPE_NA);
    return usdToDisplay(SHIPPING_RULES.REST);
  }

  // ============================================================
  //  CART & PRODUCT HELPERS
  // ============================================================

  function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }

  // Always derive the on-screen cart/checkout price the SAME way the product
  // card does: use the exact price you set for that currency (price_usd,
  // price_gbp, price_eur) if it exists — only fall back to a rate-based
  // estimate off the ZMW price when that specific currency price was never
  // set for this product. This is what keeps the price identical from the
  // product card all the way through checkout, instead of the cart showing
  // a made-up rate-converted number that doesn't match what you priced it at.
  function getCartItemDisplayPrice(item) {
    const code = currencyMap[currentCurrency.symbol];
    if (item.prices && code && item.prices[code] !== undefined && item.prices[code] !== null) {
      return parseFloat(item.prices[code]);
    }
    return item.baseZMW * currentCurrency.rate;
  }

  function getSubtotalDisplay() {
    return cart.reduce((sum, item) => sum + getCartItemDisplayPrice(item) * item.qty, 0);
  }

  function getProductPriceZMW(product) {
    if (product.prices?.ZMW !== undefined) return parseFloat(product.prices.ZMW);
    if (product.price) return parseFloat(String(product.price).replace(/[^\d.]/g, ''));
    return 0;
  }

  function getProductDisplayPrice(product) {
    const code = currencyMap[currentCurrency.symbol];
    if (product.prices && code && product.prices[code] !== undefined) return parseFloat(product.prices[code]);
    return getProductPriceZMW(product) * currentCurrency.rate;
  }

  // ============================================================
  //  PHYSICAL PICKUP LOGIC
  // ============================================================

  function syncPickupVisibility() {
    const country     = (document.getElementById('co-country')?.value  || '').trim();
    const province    = (document.getElementById('co-province')?.value || '').toLowerCase().trim();
    const pickupRow   = document.getElementById('co-pickup-row');
    const pickupCheck = document.getElementById('co-pickup-checkbox');
    const shippingRow = document.getElementById('co-shipping-row');
    const isEligible  = (country === 'ZM') && (province === 'lusaka');
    if (!pickupRow) return;
    if (isEligible) {
      pickupRow.classList.remove('hidden'); pickupRow.style.display = '';
    } else {
      pickupRow.classList.add('hidden'); pickupRow.style.display = 'none';
      pickupMode = false;
      if (pickupCheck) pickupCheck.checked = false;
      if (shippingRow) shippingRow.style.display = '';
    }
    coRenderItems();
  }

  function updateProvinceVisibility() {
    const country = document.getElementById('co-country')?.value || '';
    const field   = document.getElementById('province-field');
    if (!field) return;
    pickupMode = false;
    const pickupCheck = document.getElementById('co-pickup-checkbox');
    if (pickupCheck) pickupCheck.checked = false;

    if (country === 'ZM') {
      field.innerHTML = `<div class="co-select-wrap"><select id="co-province">
        <option value="lusaka">Lusaka</option><option value="copperbelt">Copperbelt</option>
        <option value="central">Central</option><option value="southern">Southern</option>
        <option value="western">Western</option><option value="eastern">Eastern</option>
        <option value="northern">Northern</option><option value="luapula">Luapula</option>
        <option value="muchinga">Muchinga</option><option value="northwestern">North-Western</option>
      </select></div>`;
      field.style.display = 'block';
      document.getElementById('co-province')?.addEventListener('change', syncPickupVisibility);
    } else if (country) {
      field.innerHTML = `<input type="text" id="co-province" placeholder="City / State / Region" />`;
      field.style.display = 'block';
      document.getElementById('co-province')?.addEventListener('input', syncPickupVisibility);
    } else {
      field.style.display = 'none';
    }
    syncPickupVisibility();
  }

  document.addEventListener('change', e => {
    if (e.target.id === 'co-pickup-checkbox') {
      pickupMode = e.target.checked;
      const shippingRow = document.getElementById('co-shipping-row');
      if (shippingRow) shippingRow.style.display = pickupMode ? 'none' : '';
      coRenderItems();
    }
  });

  // ============================================================
  //  GLOBAL MODAL
  // ============================================================

  const globalModal    = document.getElementById('global-modal');
  const globalContent  = document.getElementById('global-modal-content');
  const closeGlobalBtn = document.getElementById('close-global-modal');

  function getModalContent(type) {
    switch (type) {
      case 'login': return `
        <h2>Login</h2>
        <div class="auth-field-wrap"><input type="email" placeholder="Email" class="modal-input" id="login-email" autocomplete="email"></div>
        <div class="auth-field-wrap"><div class="password-wrap">
          <input type="password" placeholder="Password" class="modal-input" id="login-password" autocomplete="current-password">
          <button type="button" class="toggle-pw" data-target="login-password" aria-label="Show password"></button>
        </div></div>
        <button class="modal-btn" id="login-btn">Login</button>
        <p class="modal-link" id="forgot-password">Forgot Password?</p>
        <p class="modal-switch">Don't have an account? <span class="switch-link" data-switch="signup">Sign Up</span></p>`;
      case 'signup': return `
        <h2>Create Account</h2>
        <div class="auth-field-wrap"><input type="text" placeholder="First Name" class="modal-input" id="signup-fname" autocomplete="given-name"></div>
        <div class="auth-field-wrap"><input type="text" placeholder="Last Name" class="modal-input" id="signup-lname" autocomplete="family-name"></div>
        <div class="auth-field-wrap"><input type="email" placeholder="Email" class="modal-input" id="signup-email" autocomplete="email"></div>
        <div class="auth-field-wrap" id="signup-phone-wrap"></div>
        <div class="auth-field-wrap" id="signup-pass-wrap"><div class="password-wrap">
          <input type="password" placeholder="Password" class="modal-input" id="signup-password" autocomplete="new-password">
          <button type="button" class="toggle-pw" data-target="signup-password" aria-label="Show password"></button>
        </div></div>
        <button class="modal-btn" id="signup-btn">Create Account</button>
        <p class="modal-switch">Already have an account? <span class="switch-link" data-switch="login">Login</span></p>`;
      case 'profile': {
        return currentUser ? `
          <h2>Profile</h2>
          <div class="profile-info">
            <p><strong>Name:</strong> ${Validator.sanitizeText(currentUser.name)}</p>
            <p><strong>Email:</strong> ${Validator.sanitizeText(currentUser.email)}</p>
            <p><strong>Contact:</strong> ${Validator.sanitizeText(currentUser.contact || '—')}</p>
          </div>
          <div class="profile-orders-section">
            <h4 class="profile-orders-title">Order History</h4>
            <div class="profile-orders-list" id="profile-orders-list">
              <p class="profile-no-orders">Loading orders…</p>
            </div>
          </div>
          <button class="modal-btn" id="logout-btn" style="margin-top:16px;">Logout</button>
        ` : `<h2>Profile</h2><p>You are not logged in.</p><button class="modal-btn" id="go-login-btn">Login</button>`;
      }
      default: return '';
    }
  }

  // Maps the REAL order_status your admin dashboard sets (via the
  // Confirm/Cancel/Ship buttons) to what the shopper sees in their profile.
  function getOrderStatusMeta(status) {
    const map = {
      pending:   { icon: '⏳', label: 'Awaiting Confirmation', cls: 'status-pending'   },
      confirmed: { icon: '✓',  label: 'Approved',              cls: 'status-approved'  },
      shipped:   { icon: '🚚', label: 'Shipped',                cls: 'status-shipped'   },
      delivered: { icon: '📦', label: 'Delivered',              cls: 'status-delivered' },
      cancelled: { icon: '✕',  label: 'Rejected',               cls: 'status-rejected'  },
      refunded:  { icon: '↺',  label: 'Refunded',               cls: 'status-refunded'  },
    };
    return map[status] || map.pending;
  }

  function safeParseOrderItems(val) {
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val || '[]'); } catch { return []; }
  }

  function renderProfileOrderRow(o) {
    const items     = safeParseOrderItems(o.items);
    const meta      = getOrderStatusMeta(o.order_status);
    const canCancel = ['pending', 'confirmed'].includes(o.order_status);
    const date      = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const itemsLine = items.map(i => `${Validator.sanitizeText(i.name || i.product_name || 'Item')} ×${i.qty}`).join(', ');
    return `
      <div class="profile-order-row">
        <div class="profile-order-meta">
          <span class="profile-order-ref">#${Validator.sanitizeText(o.order_ref || '')}</span>
          <span class="profile-order-date">${date}</span>
          ${canCancel ? `<button class="profile-cancel-btn" data-cancel-order-id="${o.id}" title="Cancel order">✕</button>` : ''}
        </div>
        <div class="profile-order-items">${itemsLine}</div>
        <div class="profile-order-footer">
          <span class="profile-order-total">K${parseFloat(o.total_zmw).toFixed(2)}</span>
          <span class="profile-order-status ${meta.cls}">${meta.icon} ${meta.label}</span>
        </div>
        ${o.payment_status === 'paid' ? `<button class="profile-invoice-btn" data-order-id="${o.id}" style="margin-top:8px;">⬇ Invoice</button>` : ''}
      </div>`;
  }

  async function loadProfileOrders() {
    const listEl = document.getElementById('profile-orders-list');
    if (!listEl || !currentUser) return;
    try {
      const res  = await fetch(`${API}/orders`, { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load orders.');
      const orders = data.data || [];
      listEl.innerHTML = orders.length === 0
        ? `<p class="profile-no-orders">No orders placed yet.</p>`
        : orders.map(renderProfileOrderRow).join('');
    } catch (err) {
      listEl.innerHTML = `<p class="profile-no-orders">Couldn't load your orders: ${Validator.sanitizeText(err.message)}</p>`;
    }
  }

  function openGlobalModal(type) {
    if (currentUser && (type === 'login' || type === 'signup')) {
      showToast(`You're already logged in as ${Validator.sanitizeText(currentUser.name)}.`, 'info'); type = 'profile';
    }
    globalContent.innerHTML = getModalContent(type);
    globalModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const box = globalModal.querySelector('.global-modal-box');
    if (box) box.classList.toggle('signup-modal', type === 'signup');
    if (type === 'signup') setupSignupValidation();
    if (type === 'login')  setupLoginValidation();
    if (type === 'profile') loadProfileOrders();
    setupPasswordToggles();
    injectAdminButton();
  }

  function closeGlobal() {
    globalModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  if (closeGlobalBtn) closeGlobalBtn.addEventListener('click', closeGlobal);
  if (globalModal) globalModal.addEventListener('click', e => { if (e.target === globalModal) closeGlobal(); });

  document.querySelectorAll('[data-modal]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('side-menu').classList.remove('active');
      document.getElementById('overlay').classList.remove('active');
      openGlobalModal(link.dataset.modal);
    });
  });

  // ============================================================
  //  PASSWORD & VALIDATION UI
  // ============================================================

  function setupPasswordToggles() {
    const EYE_OPEN   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const EYE_CLOSED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    document.querySelectorAll('.toggle-pw').forEach(btn => {
      btn.innerHTML = EYE_OPEN;
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target); if (!input) return;
        const isHidden = input.type === 'password'; input.type = isHidden ? 'text' : 'password';
        btn.innerHTML = isHidden ? EYE_CLOSED : EYE_OPEN;
      });
    });
  }

  function setupSignupValidation() {
    Validator.buildPhoneField(document.getElementById('signup-phone-wrap'), 'signup-contact');
    const fnameEl = document.getElementById('signup-fname'), lnameEl = document.getElementById('signup-lname');
    const emailEl = document.getElementById('signup-email'), passEl = document.getElementById('signup-password'), passWrap = document.getElementById('signup-pass-wrap');
    fnameEl?.addEventListener('input', () => { const r = Validator.validateName(fnameEl.value, 'First name'); r.ok ? Validator.showValid(fnameEl) : Validator.showError(fnameEl, r.error); });
    lnameEl?.addEventListener('input', () => { const r = Validator.validateName(lnameEl.value, 'Last name'); r.ok ? Validator.showValid(lnameEl) : Validator.showError(lnameEl, r.error); });
    emailEl?.addEventListener('input', () => { emailEl.value = emailEl.value.toLowerCase(); const r = Validator.validateEmail(emailEl.value); r.ok ? Validator.showValid(emailEl) : Validator.showError(emailEl, r.error); });
        passEl?.addEventListener('input', () => {
      const isValid = passEl.value.length >= 6;
      if (passEl.value.length === 0) { Validator.clearState(passEl); } 
      else { passEl.classList.toggle('input-valid', isValid); passEl.classList.toggle('input-invalid', !isValid); }
      let hint = passWrap.querySelector('.pw-requirements');
      if (!hint) { hint = document.createElement('p'); hint.className = 'pw-requirements'; passWrap.appendChild(hint); }
      hint.innerHTML = passEl.value.length === 0 ? '' : `<span class="${isValid ? 'pw-req-pass' : 'pw-req-fail'}">${isValid ? '✓' : '✗'}</span> Must be at least 6 characters`;
    });
  }

  function setupLoginValidation() {
    const emailEl = document.getElementById('login-email'), passEl = document.getElementById('login-password');
    emailEl?.addEventListener('input', () => { emailEl.value = emailEl.value.toLowerCase(); if (emailEl.value) { const r = Validator.validateEmail(emailEl.value); r.ok ? Validator.showValid(emailEl) : Validator.showError(emailEl, r.error); } });
    passEl?.addEventListener('input', () => {
      const wrap = passEl?.closest('.auth-field-wrap'); let errEl = wrap?.querySelector('.pass-login-hint');
      if (!errEl && wrap) { errEl = document.createElement('span'); errEl.className = 'field-error pass-login-hint'; wrap.appendChild(errEl); }
      if (passEl.value.length > 0 && passEl.value.length < 8) { passEl.classList.add('input-invalid'); passEl.classList.remove('input-valid'); if (errEl) errEl.textContent = 'Password must be at least 8 characters.'; }
      else if (passEl.value.length >= 8) { passEl.classList.add('input-valid'); passEl.classList.remove('input-invalid'); if (errEl) errEl.textContent = ''; }
      else { Validator.clearState(passEl); if (errEl) errEl.textContent = ''; }
    });
  }

  // ============================================================
  //  DELEGATED CLICK HANDLER (AUTH, CART, ORDERS, ADMIN)
  // ============================================================

  document.addEventListener('click', async e => {

    if (e.target.classList.contains('switch-link')) { openGlobalModal(e.target.dataset.switch); return; }
    if (e.target.id === 'go-login-btn') { openGlobalModal('login'); return; }

    if (e.target.classList.contains('profile-cancel-btn')) {
      const orderId = e.target.dataset.cancelOrderId;
      if (!orderId) return;
      if (!confirm('Cancel this order?')) return;
      try {
        const res  = await fetch(`${API}/orders/${orderId}/cancel`, {
          method: 'PATCH',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to cancel order.');
        showToast('Order cancelled.', 'success');
        await loadProfileOrders();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    if (e.target.classList.contains('profile-invoice-btn')) {
      const orderId = e.target.dataset.orderId;
      if (!orderId) return;
      try {
        const res  = await fetch(`${API}/orders/${orderId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load order.');
        const o     = data.data.order;
        const items = data.data.items || [];
        const rows  = items.map(i => `<tr><td>${Validator.sanitizeText(i.name || i.product_name || 'Item')}</td><td>${Validator.sanitizeText(i.size || '')} / ${Validator.sanitizeText(i.color || '')}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">K${(parseFloat(i.price || 0) * i.qty).toFixed(2)}</td></tr>`).join('');
        const date    = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
        const billTo  = `${o.first_name || ''} ${o.last_name || ''}`.trim() || '—';
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ILLSTAR Invoice #${o.order_ref}</title><style>body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:40px;max-width:680px;margin:0 auto}h1{font-size:28px;letter-spacing:2px;margin-bottom:4px}.sub{color:#888;font-size:13px;margin-bottom:32px}table{width:100%;border-collapse:collapse;margin-bottom:24px}th{background:#111;color:#fff;padding:10px 12px;font-size:12px;text-align:left;letter-spacing:.06em;text-transform:uppercase}td{padding:10px 12px;border-bottom:1px solid #eee;font-size:14px}.totals td{border:none;font-size:14px}.totals tr:last-child td{font-weight:700;font-size:16px;border-top:2px solid #111;padding-top:14px}.footer{font-size:12px;color:#aaa;text-align:center;margin-top:40px}.info{display:flex;gap:40px;margin-bottom:28px;font-size:13px}.info div{flex:1}.info strong{display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#888}</style></head><body><h1>ILLSTAR</h1><div class="sub">STUDIOS — Invoice</div><div class="info"><div><strong>Order Ref</strong>#${o.order_ref}</div><div><strong>Date</strong>${date}</div><div><strong>Bill To</strong>${billTo}</div><div><strong>Email</strong>${o.email || '—'}</div></div><table><thead><tr><th>Item</th><th>Variant</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table><table class="totals"><tr><td>Subtotal</td><td style="text-align:right">K${parseFloat(o.subtotal_zmw || 0).toFixed(2)}</td></tr><tr><td>Shipping</td><td style="text-align:right">K${parseFloat(o.shipping_zmw || 0).toFixed(2)}</td></tr><tr><td>Total</td><td style="text-align:right">K${parseFloat(o.total_zmw || 0).toFixed(2)}</td></tr></table><div class="footer">Thank you for shopping with ILLSTAR STUDIOS</div></body></html>`;
        const blob = new Blob([html], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `ILLSTAR-Invoice-${o.order_ref}.html`; a.click(); URL.revokeObjectURL(url);
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    // ---- SIGN UP ----
    if (e.target.id === 'signup-btn') {
      const fnameEl = document.getElementById('signup-fname'), lnameEl = document.getElementById('signup-lname');
      const emailEl = document.getElementById('signup-email'), codeEl = document.getElementById('signup-contact-code');
      const phoneEl = document.getElementById('signup-contact'), passEl = document.getElementById('signup-password'), passWrap = document.getElementById('signup-pass-wrap');
      let valid = true;
      const fnameR = Validator.validateName(fnameEl?.value || '', 'First name'); if (!fnameR.ok) { Validator.showError(fnameEl, fnameR.error); valid = false; } else Validator.showValid(fnameEl);
      const lnameR = Validator.validateName(lnameEl?.value || '', 'Last name'); if (!lnameR.ok) { Validator.showError(lnameEl, lnameR.error); valid = false; } else Validator.showValid(lnameEl);
      const emailR = Validator.validateEmail(emailEl?.value || ''); if (emailEl) emailEl.value = emailR.value; if (!emailR.ok) { Validator.showError(emailEl, emailR.error); valid = false; } else Validator.showValid(emailEl);
      const phoneR = Validator.validatePhone(phoneEl?.value || '', codeEl?.value || '+260'); if (!phoneR.ok) { Validator.showError(phoneEl, phoneR.error); valid = false; } else Validator.showValid(phoneEl);
            const isPassValid = (passEl?.value || '').length >= 6;
      if (!isPassValid) { 
        let passErrEl = passWrap.querySelector('.pass-submit-error'); 
        if (!passErrEl) { passErrEl = document.createElement('span'); passErrEl.className = 'field-error pass-submit-error'; passWrap.appendChild(passErrEl); } 
        passErrEl.textContent = 'Password must be at least 6 characters.'; 
        if (passEl) { passEl.classList.add('input-invalid'); passEl.classList.remove('input-valid'); } valid = false; 
      }
      else { Validator.showValid(passEl); const passErrEl = passWrap.querySelector('.pass-submit-error'); if (passErrEl) passErrEl.textContent = ''; }
      if (!valid) return;
      const fullName = [fnameR.value, lnameR.value].filter(Boolean).join(' ');
      fetch(API + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: fnameR.value, last_name: lnameR.value, email: emailR.value, password: passEl.value, phone: phoneR.value }) })
      .then(res => res.json()).then(data => {
        if (!data.success) { Validator.showError(emailEl, data.errors ? data.errors[0].message : data.message); return; }
        token = data.data.accessToken; localStorage.setItem('token', token);
        currentUser = { name: fullName, email: emailR.value, role: data.data.user.role };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast('Account created successfully!', 'success'); openGlobalModal('profile');
      }).catch(() => showToast('Network error', 'error')); return;
    }

    // ---- LOGIN ----
    if (e.target.id === 'login-btn') {
      const emailEl = document.getElementById('login-email'), passEl = document.getElementById('login-password'); let valid = true;
      const emailR = Validator.validateEmail(emailEl?.value || ''); if (emailEl) emailEl.value = emailR.value; if (!emailR.ok) { Validator.showError(emailEl, emailR.error); valid = false; } else Validator.showValid(emailEl);
      if (!passEl?.value) { const wrap = passEl?.closest('.auth-field-wrap'); let err = wrap?.querySelector('.pass-login-error'); if (!err && wrap) { err = document.createElement('span'); err.className = 'field-error pass-login-error'; wrap.appendChild(err); } if (err) err.textContent = 'Password is required.'; if (passEl) passEl.classList.add('input-invalid'); valid = false; }
      else { const wrap = passEl?.closest('.auth-field-wrap'); const err = wrap?.querySelector('.pass-login-error'); if (err) err.textContent = ''; if (passEl) passEl.classList.remove('input-invalid'); }
      if (!valid) return;
      fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailR.value, password: passEl.value }) })
      .then(res => res.json()).then(data => {
        if (!data.success) { Validator.showError(emailEl, data.message || 'Invalid credentials'); return; }
        token = data.data.accessToken; localStorage.setItem('token', token);
        currentUser = { name: data.data.user.email.split('@')[0], email: data.data.user.email, role: data.data.user.role };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast('Login successful!', 'success'); openGlobalModal('profile');
      }).catch(() => showToast('Network error', 'error')); return;
    }

        // ---- LOGOUT ----
    if (e.target.id === 'logout-btn' || e.target.id === 'admin-logout-btn') {
      localStorage.removeItem('currentUser'); 
      localStorage.removeItem('token'); 
      localStorage.removeItem('cart'); // Clear old user's cart
      cart = []; // Reset cart memory
      renderCart(); // Update cart UI
      token = null; currentUser = null;
      showToast('You have been logged out.'); closeGlobal();
      document.getElementById('admin-dashboard')?.classList.add('hidden');
      document.body.style.overflow = ''; return;
    }
    

    if (e.target.id === 'forgot-password') {
      const email = prompt('Enter your account email:'); if (!email) return;
      const r = Validator.validateEmail(email); if (!r.ok) { showToast(r.error, 'error'); return; }
      showToast('Password reset is not available yet.'); return;
    }

    // ---- ADMIN DASHBOARD ACTIONS ----
    if (e.target.id === 'admin-back-store') { document.getElementById('admin-dashboard').classList.add('hidden'); document.body.style.overflow = ''; return; }
    if (e.target.id === 'go-admin-btn') { window.openAdminDashboard(); return; }

    // ---- EDIT PRODUCT ----
    if (e.target.dataset.editProduct) {
      openEditProductModal(e.target.dataset.editProduct);
      return;
    }

    if (e.target.classList.contains('admin-action-btn')) {
      const orderId = e.target.dataset.orderId, newStatus = e.target.dataset.status;
      if (!newStatus || !orderId) return; if (!confirm(`Update order to ${newStatus.toUpperCase()}?`)) return;
      try {
        const res = await fetch(`${API}/orders/${orderId}/status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json(); if (!res.ok) throw new Error(data.message);
        showToast(`Order updated to ${newStatus.toUpperCase()}`, 'success');
        await loadAdminStats(); await loadAdminOrders();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    // ---- CART CONTROLS ----
    const cartKey = e.target.dataset.cartkey;
    if (e.target.classList.contains('remove-btn'))    { cart = cart.filter(item => item.cartKey !== cartKey); saveCart(); renderCart(); }
    if (e.target.dataset.action === 'increase') { const item = cart.find(i => i.cartKey === cartKey); if (item) { if (item.qty >= 15) { showToast('Maximum quantity is 15.', 'error'); return; } item.qty++; saveCart(); renderCart(); } }
    if (e.target.dataset.action === 'decrease') { const item = cart.find(i => i.cartKey === cartKey); if (item && item.qty > 1) { item.qty--; saveCart(); renderCart(); } }
  });

  // ============================================================
  //  PRODUCTS
  // ============================================================

  async function loadProducts(attempt = 1) {
    const container = document.getElementById('products');
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 10000;

    if (attempt === 1) {
      container.innerHTML = '<p class="muted">Loading products…</p>';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res  = await fetch(API + '/products', { signal: controller.signal });
      clearTimeout(timer);
      const json = await res.json();
      products = json.data.map(p => ({
        id: p.id, name: p.name, image: p.image_url, backImage: p.back_image_url, images: p.extra_images || [],
        description: p.description, details: p.details, sizes: p.sizes || [], colors: p.colors || [],
        prices: { ZMW: p.price_zmw, USD: p.price_usd, GBP: p.price_gbp, EUR: p.price_eur },
        price:    p.price_zmw,
        soldOut:  p.is_sold_out === 1 || p.is_sold_out === true,
        disabled: p.is_disabled === 1 || p.is_disabled === true,
        stock:    p.stock,
      }));
      renderProducts();
    } catch (err) {
      clearTimeout(timer);
      console.error(err);
      // Connection to the backend can be intermittently slow — retry a
      // couple of times with a short delay before giving up, so a brief
      // hiccup doesn't show the shopper a scary permanent error.
      if (attempt < MAX_ATTEMPTS) {
        container.innerHTML = `<p class="muted">Connection is slow, retrying…</p>`;
        setTimeout(() => loadProducts(attempt + 1), attempt * 1500);
      } else {
        container.innerHTML = `
          <div style="text-align:center;padding:40px 20px;">
            <p class="muted" style="margin-bottom:16px;">Couldn't load products. Please check your connection.</p>
            <button id="retry-products-btn" class="modal-btn" style="max-width:200px;margin:0 auto;">Retry</button>
          </div>`;
        document.getElementById('retry-products-btn')?.addEventListener('click', () => loadProducts(1));
      }
    }
  }

  function renderProducts() {
    const container = document.getElementById('products'); container.innerHTML = '';
    products.forEach(p => {
      const displayPrice = getProductDisplayPrice(p).toFixed(2);
      const isSoldOut  = p.soldOut  === true;
      const isDisabled = p.disabled === true;
      const unavailable = isSoldOut || isDisabled;
      const card = document.createElement('article');
      card.className = 'card' + (unavailable ? ' card--unavailable' : '');
      card.innerHTML = `
        ${isSoldOut  ? '<div class="card-badge card-badge--soldout">Sold Out</div>'    : ''}
        ${isDisabled ? '<div class="card-badge card-badge--disabled">Unavailable</div>' : ''}
        <img src="${p.image}" alt="${p.name}">
        <div class="card-body">
          <h3 class="card-title">${p.name}</h3>
          <div class="card-price">${currentCurrency.symbol}${displayPrice}</div>
          <div class="card-actions">
            <a href="#" class="btn${unavailable ? ' btn--disabled' : ''}" data-id="${p.id}"${unavailable ? ' aria-disabled="true"' : ''}>
              ${isSoldOut ? 'Sold Out' : isDisabled ? 'Unavailable' : 'View'}
            </a>
          </div>
        </div>`;
      container.appendChild(card);
    });
    document.querySelectorAll('[data-id]').forEach(btn => {
      btn.onclick = ev => {
        ev.preventDefault();
        const prod = products.find(p => p.id === btn.dataset.id);
        if (!prod || prod.soldOut || prod.disabled) return;
        openModal(prod);
      };
    });
  }

  // ============================================================
  //  PRODUCT MODAL
  // ============================================================

  function openModal(prod) {
    const modal = document.getElementById('modal');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const IMG_EXT  = /\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?$/i;
    const consumed = new Set(['image', 'backImage', 'images']);
    const images   = [prod.image, prod.backImage].filter(Boolean);
    if (Array.isArray(prod.images)) { prod.images.forEach(src => { if (src && !images.includes(src)) images.push(src); }); }
    Object.entries(prod).forEach(([key, val]) => { if (consumed.has(key)) return; if (typeof val === 'string' && IMG_EXT.test(val) && !images.includes(val)) images.push(val); });
    let currentIndex = 0, qty = 1;
    const colors = Array.isArray(prod.colors) ? prod.colors : (prod.color ? [prod.color] : ['Standard']);
    let selectedColor = colors.length === 1 ? colors[0] : null;

    modal.innerHTML = `<div class="modal-content modal-product"><button class="close" id="close-modal">×</button><div class="modal-left"><div class="image-wrapper"><button class="expand-btn" id="expand-img">🔍︎</button><button class="arrow left" id="prev-img">‹</button><img src="${images[0]}" class="main-img" id="main-img"><button class="arrow right" id="next-img">›</button></div>${images.length > 1 ? `<div class="img-dots">${images.map((_, i) => `<span class="img-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div><div class="thumbs">${images.map((img, i) => `<img src="${img}" class="thumb${i === 0 ? ' active' : ''}" data-img="${img}">`).join('')}</div>` : ''}</div><div class="modal-right"><h2 class="product-title">${prod.name}</h2><p class="price">${currentCurrency.symbol}${getProductDisplayPrice(prod).toFixed(2)}</p><p class="product-desc">${prod.description || ''}</p>${prod.details ? `<p class="product-extra">${prod.details}</p>` : ''}<div class="section"><h4>Size</h4><div class="size-options">${(prod.sizes || []).map(s => `<button class="size-btn">${s}</button>`).join('')}</div></div><div class="section"><h4>Color</h4><div class="color-options-text">${colors.map(c => `<button class="color-text-btn${colors.length === 1 ? ' active' : ''}" data-color="${c}">${c}</button>`).join('')}</div></div><div class="section"><h4>Quantity</h4><div class="quantity-box"><button class="qty-btn" id="minus">−</button><span id="qty">1</span><button class="qty-btn" id="plus">+</button></div></div><div class="section"><button class="modal-add-btn${prod.soldOut ? ' modal-add-btn--soldout' : prod.disabled ? ' modal-add-btn--disabled' : ''}" id="add-to-cart-btn" ${prod.soldOut || prod.disabled ? 'disabled' : ''}>${prod.soldOut ? 'Sold Out' : prod.disabled ? 'Currently Unavailable' : 'Add to Cart'}</button></div></div></div>`;

    const mainImg  = modal.querySelector('#main-img');
    const thumbEls = modal.querySelectorAll('.thumb');
    function updateImage(index) {
      currentIndex = ((index % images.length) + images.length) % images.length;
      mainImg.style.opacity = 0;
      setTimeout(() => { mainImg.src = images[currentIndex]; mainImg.style.opacity = 1; }, 120);
      thumbEls.forEach((t, i) => t.classList.toggle('active', i === currentIndex));
      modal.querySelectorAll('.img-dot').forEach((d, i) => d.classList.toggle('active', i === currentIndex));
    }
    thumbEls.forEach((thumb, i) => { thumb.onclick = () => updateImage(i); });
    modal.querySelector('#next-img').onclick = () => updateImage(currentIndex + 1);
    modal.querySelector('#prev-img').onclick = () => updateImage(currentIndex - 1);
    modal.querySelectorAll('.size-btn').forEach(btn => { btn.onclick = () => { modal.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }; });
    modal.querySelectorAll('.color-text-btn').forEach(btn => { btn.onclick = () => { modal.querySelectorAll('.color-text-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); selectedColor = btn.dataset.color; }; });
    const MAX_QTY = 15, qtyEl = modal.querySelector('#qty');
    modal.querySelector('#plus').onclick  = () => { if (qty >= MAX_QTY) { showToast('Maximum quantity is 15.', 'error'); return; } qty++; qtyEl.textContent = qty; };
    modal.querySelector('#minus').onclick = () => { if (qty > 1) { qty--; qtyEl.textContent = qty; } };
    modal.querySelector('#expand-img').onclick = ev => {
      ev.stopPropagation();
      let viewer = document.querySelector('.image-viewer');
      if (!viewer) {
        viewer = document.createElement('div'); viewer.className = 'image-viewer';
        viewer.innerHTML = `<span class="close-viewer">×</span><img id="viewer-img">`;
        document.body.appendChild(viewer);
        viewer.querySelector('.close-viewer').onclick = () => { viewer.style.display = 'none'; };
        viewer.onclick = e => { if (e.target === viewer) viewer.style.display = 'none'; };
      }
      viewer.querySelector('#viewer-img').src = mainImg.src; viewer.style.display = 'flex';
    };
    modal.querySelector('#add-to-cart-btn').onclick = () => {
      if (prod.soldOut || prod.disabled) return;
      const selectedSizeEl = modal.querySelector('.size-btn.active');
      if (!selectedSizeEl) { showToast('Please select a size before adding to cart.', 'error'); return; }
      if (!selectedColor)  { showToast('Please select a color before adding to cart.', 'error'); return; }
      const cartKey  = `${prod.id}-${selectedSizeEl.textContent}-${selectedColor}`;
      const existing = cart.find(item => item.cartKey === cartKey);
      if (existing) { existing.qty = Math.min(existing.qty + qty, 15); }
      else { cart.push({ cartKey, id: prod.id, name: prod.name, price: getProductDisplayPrice(prod), baseZMW: getProductPriceZMW(prod), prices: prod.prices || null, image: prod.image, size: selectedSizeEl.textContent, color: selectedColor, qty }); }
      saveCart(); renderCart(); closeModal();
      setTimeout(() => { document.getElementById('cart-panel').classList.add('active'); }, 300);
    };
    modal.querySelector('#close-modal').onclick = closeModal;
    modal.onclick = e => { if (e.target === modal) closeModal(); };
  }

  function closeModal() {
    const modal = document.getElementById('modal');
    modal.setAttribute('aria-hidden', 'true'); modal.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  // ============================================================
  //  POLICY MODAL
  // ============================================================

      const policyContents = {
    contact: `
      <p><strong>Sales & Marketing</strong></p>
      <p>Derrick Zulu<br>0764490255 | derrickzulu28@gmail.com | <a href="https://www.instagram.com/derrick_zulu_" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">@derrick_zulu_</a></p>
      <p>Darell Sean Mukalati<br>0955017844 | mukalatidarell@gmail.com | <a href="https://www.instagram.com/youngdebronsky" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">@youngdebronski</a></p>
      <br>
      <p><strong>CEO & Founder</strong></p>
      <p>Anthony Mushumba<br>+260 971 467 772 | anthonymush21@gmail.com | <a href="https://www.instagram.com/yungchryst_" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">@yungchryst_</a></p>`,

    refund: `
      <p><strong>Eligibility for Returns</strong></p>
      <p>We accept returns and exchanges within 14 days of the delivery date. To be eligible, items must meet the following conditions:</p>
      <ul>
        <li>Item is unworn, unwashed, and in original condition</li>
        <li>All original tags are still attached</li>
        <li>Item is in its original packaging</li>
        <li>Proof of purchase (order confirmation) is provided</li>
      </ul>
      
      <p><strong>Non-Returnable Items</strong></p>
      <ul>
        <li>Sale or discounted items (final sale)</li>
        <li>Underwear, socks, or any intimate apparel</li>
        <li>Custom or personalised orders</li>
        <li>Items showing signs of wear, damage, or alteration</li>
      </ul>

      <p><strong>How to Initiate a Return</strong></p>
      <p>To start a return, contact our team via the details listed in the Contact Us section. Include your order number, the item(s) you wish to return, and the reason for return. Our team will respond within 2-3 business days with return instructions.</p>
      <p><em>Note: Customers are responsible for return shipping costs unless the item received was defective or incorrect.</em></p>

      <p><strong>Refund Processing</strong></p>
      <p>Once we receive and inspect your return, we will notify you of the approval or rejection of your refund. Approved refunds are processed within 5-7 business days to your original payment method. Please note that your bank or payment provider may take additional time to reflect the credit.</p>

      <p><strong>Exchanges</strong></p>
      <p>We offer exchanges for different sizes or colours of the same item, subject to availability. If the item you want is out of stock, a refund will be issued instead.</p>

      <p><strong>Defective or Incorrect Items</strong></p>
      <p>If you received a defective or wrong item, contact us immediately. We will cover all return shipping costs and prioritise a replacement or full refund at no extra charge to you.</p>`,

    shipping: `
      <p><strong>Order Processing</strong></p>
      <p>All orders are processed within 1-3 business days after payment confirmation (excluding weekends and public holidays). During high-demand periods or sales, processing may take slightly longer. You will receive a confirmation via WhatsApp or email once your order has been dispatched.</p>

      <p><strong>Domestic Shipping (Zambia)</strong></p>
      <ul>
        <li>Standard Delivery (Lusaka): 1-3 business days — ZMW 50</li>
        <li>Standard Delivery (Other Provinces): 3-7 business days — ZMW 80-120</li>
        <li>Express Delivery (Lusaka): Same day / Next day — ZMW 120</li>
      </ul>
      <p>Free standard shipping on all domestic orders over ZMW 800.</p>

      <p><strong>International Shipping</strong></p>
      <ul>
        <li>Africa (SADC Region): 7-14 business days — From USD 15</li>
        <li>Rest of Africa: 10-21 business days — From USD 25</li>
        <li>Europe & North America: 14-28 business days — From USD 35</li>
        <li>Rest of World: 14-35 business days — Calculated at checkout</li>
      </ul>

      <p><strong>Customs & Import Duties</strong></p>
      <p>International orders may be subject to customs duties, taxes, or import fees imposed by the destination country. These charges are the responsibility of the customer and are not included in our pricing. ILLSTAR is not liable for delays caused by customs processing.</p>

      <p><strong>Tracking Your Order</strong></p>
      <p>Once your order is shipped, you will receive a tracking number via WhatsApp or email. You can use this to monitor your delivery status in real time.</p>

      <p><strong>Lost or Delayed Packages</strong></p>
      <p>If your order has not arrived within the expected timeframe, please contact our team. We will investigate and, where applicable, arrange a replacement or refund for confirmed lost shipments.</p>`,

    stockists: `
      <p>ILLSTAR is currently available through our official online channels. We are actively growing our retail presence across Zambia and the region.</p>

      <p><strong>Official Channels</strong></p>
      <ul>
        <li>Our website (primary store)</li>
        <li>Instagram DMs — <a href="https://www.instagram.com/illstarstudios" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">@illstar</a> (orders & enquiries)</li>
        <li>WhatsApp — contact our sales team directly</li>
      </ul>

      <p><strong>Wholesale & Retail Partnerships</strong></p>
      <p>We welcome partnerships with fashion-forward retailers who align with the ILLSTAR aesthetic and values. To enquire about stocking our brand, contact Derrick Zulu or Darell Sean Mukalati via the details in the Contact Us section. Please include your store name, location, and a brief description of your concept.</p>

      <p><strong>Pop-Ups & Events</strong></p>
      <p>ILLSTAR regularly participates in pop-up markets and fashion events across Lusaka. Follow us on Instagram to stay updated on our next appearance near you.</p>`,

    privacy: `
      <p><strong>Information We Collect</strong></p>
      <p>When you place an order or contact us, we may collect the following:</p>
      <ul>
        <li>Full name and contact details (phone number, email address)</li>
        <li>Delivery address and billing information</li>
        <li>Order history and purchase preferences</li>
        <li>Device and browsing data (when visiting our website)</li>
        <li>Social media profile information (if you interact with us on Instagram)</li>
      </ul>

      <p><strong>How We Use Your Information</strong></p>
      <ul>
        <li>To process and fulfil your orders</li>
        <li>To communicate order updates and shipping notifications</li>
        <li>To respond to customer service enquiries</li>
        <li>To send promotional content (only with your consent)</li>
        <li>To improve our products and shopping experience</li>
      </ul>

      <p><strong>Data Sharing</strong></p>
      <p>ILLSTAR does not sell, rent, or trade your personal information to third parties. We may share your data with trusted service providers (e.g. delivery couriers, payment processors) solely to fulfil your order. All partners are required to handle your data responsibly and in accordance with applicable laws.</p>

      <p><strong>Data Security</strong></p>
      <p>We take reasonable steps to protect your personal information from unauthorised access, loss, or misuse. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>

      <p><strong>Your Rights</strong></p>
      <p>You have the right to:</p>
      <ul>
        <li>Request access to the personal data we hold about you</li>
        <li>Request correction or deletion of your data</li>
        <li>Opt out of marketing communications at any time</li>
        <li>Lodge a complaint with a relevant data authority</li>
      </ul>

      <p><strong>Cookies</strong></p>
      <p>Our website may use cookies to enhance your browsing experience and analyse site traffic. You can disable cookies in your browser settings at any time, though this may affect certain website features.</p>

      <p><strong>Updates to This Policy</strong></p>
      <p>We may update this privacy policy from time to time. Changes will be reflected on this page with an updated effective date. Continued use of our services following changes constitutes acceptance of the revised policy.</p>
      <p>This policy is effective as of 2025. For any privacy-related concerns, reach out to our team directly via the contact details in the Contact Us section.</p>`
  };

  function openPolicy(type = 'shipping') {
    const modal = document.getElementById('policy-modal');
    modal.querySelector('.modal-info').innerHTML = policyContents[type] || policyContents.shipping;
    modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open');
  }
  function closePolicy() { document.getElementById('policy-modal').setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); }
  document.getElementById('close-policy').onclick = closePolicy;
  document.getElementById('co-policy-link')?.addEventListener('click', e => {
    e.preventDefault(); closeCheckoutPage();
    setTimeout(() => { const footer = document.getElementById('footer'); if (footer) { footer.scrollIntoView({ behavior: 'smooth' }); footer.classList.add('footer-glow'); setTimeout(() => footer.classList.remove('footer-glow'), 1600); } }, 300);
  });
  document.querySelectorAll('.footer-policy').forEach(link => { link.addEventListener('click', e => { e.preventDefault(); openPolicy(link.dataset.policy); }); });

  // ============================================================
  //  HEADER & CURRENCY
  // ============================================================

  const currencyBtn  = document.getElementById('currency-btn');
  const currencyList = document.getElementById('currency-list');
  if (currencyBtn && currencyList) {
    currencyBtn.addEventListener('click', () => { currencyList.style.display = currencyList.style.display === 'block' ? 'none' : 'block'; });
    currencyList.querySelectorAll('li').forEach(item => { item.addEventListener('click', () => { setCurrency(item.dataset.symbol, parseFloat(item.dataset.rate)); currencyList.style.display = 'none'; }); });
    document.addEventListener('click', e => { if (!currencyBtn.contains(e.target) && !currencyList.contains(e.target)) currencyList.style.display = 'none'; });

  // Physically relocate the currency selector between the header (desktop)
  // and the footer (mobile) — same DOM node moved, not duplicated, so all
  // the click handlers above keep working no matter where it currently sits.
  const currencySelectorEl = document.querySelector('.currency-selector');
  const footerCurrencySlot = document.getElementById('footer-currency-slot');
  const headerRightEl = document.querySelector('.header-right');
  const cartBoxEl = document.querySelector('.cart-box');

  function relocateCurrencySelector(e) {
    if (!currencySelectorEl || !footerCurrencySlot || !headerRightEl) return;
    if (e.matches) {
      footerCurrencySlot.appendChild(currencySelectorEl);
    } else {
      headerRightEl.insertBefore(currencySelectorEl, cartBoxEl);
    }
  }

  const mobileMediaQuery = window.matchMedia('(max-width: 640px)');
  relocateCurrencySelector(mobileMediaQuery);
  mobileMediaQuery.addEventListener('change', relocateCurrencySelector);
  }

  const menuBtn     = document.getElementById('menu-btn');
  const sideMenu    = document.getElementById('side-menu');
  const closeMenu   = document.getElementById('close-menu');
  const overlay     = document.getElementById('overlay');
  const themeToggle = document.getElementById('theme-toggle');
  if (menuBtn && sideMenu && closeMenu && overlay) {
    menuBtn.addEventListener('click', () => { sideMenu.classList.add('active'); overlay.classList.add('active'); });
    const closeAll = () => { sideMenu.classList.remove('active'); overlay.classList.remove('active'); };
    closeMenu.addEventListener('click', closeAll); overlay.addEventListener('click', closeAll);
  }
  if (themeToggle) {
    if (localStorage.getItem('theme') !== 'dark') { document.body.classList.add('light-mode'); themeToggle.checked = true; }
    themeToggle.addEventListener('change', () => {
      if (themeToggle.checked) { document.body.classList.add('light-mode'); localStorage.setItem('theme', 'light'); }
      else { document.body.classList.remove('light-mode'); localStorage.setItem('theme', 'dark'); }
    });
  }

  // ============================================================
  //  CART
  // ============================================================

  const cartBox     = document.querySelector('.cart-box');
  const cartPanel   = document.getElementById('cart-panel');
  const closeCart   = document.getElementById('close-cart');
  const cartItemsEl = document.getElementById('cart-items');
  const cartTotalEl = document.getElementById('cart-total');
  const cartCount   = document.getElementById('cart-count') || { textContent: '' };

  if (cartBox)   cartBox.addEventListener('click', () => { cartPanel.classList.add('active'); renderCart(); });
  if (closeCart) closeCart.addEventListener('click', () => { cartPanel?.classList.remove('active'); });

  document.getElementById('checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) { showToast('Your cart is empty.', 'error'); return; }
    if (!currentUser) { showToast('Please log in or create an account to checkout.', 'error'); cartPanel.classList.remove('active'); setTimeout(() => openGlobalModal('login'), 300); return; }
    cartPanel.classList.remove('active'); openCheckoutPage();
  });

  function renderCart() {
    cartItemsEl.innerHTML = ''; let total = 0, count = 0;
    cart.forEach(item => { total += getCartItemDisplayPrice(item) * item.qty; count += item.qty; });
    if (cart.length === 0) {
      cartItemsEl.innerHTML = `<div class="empty-cart"><p>Your cart is currently empty (0 items)</p><button id="shop-now-btn">Shop Now</button></div>`;
      cartTotalEl.textContent = currentCurrency.symbol + '0.00'; cartCount.textContent = '0';
      document.getElementById('checkout-btn').textContent = `CHECKOUT • ${currentCurrency.symbol}0.00 ${currencyMap[currentCurrency.symbol]}`;
      document.getElementById('shop-now-btn')?.addEventListener('click', () => { cartPanel.classList.remove('active'); setTimeout(() => { document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }, 350); });
      return;
    }
    cart.forEach(item => {
      const lineTotal = getCartItemDisplayPrice(item) * item.qty;
      const div = document.createElement('div'); div.className = 'cart-item';
      div.innerHTML = `<img src="${item.image}" class="cart-img-item"><div class="cart-item-info"><p class="cart-name">${item.name}</p><p class="cart-meta">Size: ${item.size} | Color: ${item.color}</p><div class="cart-controls"><button class="qty-btn" data-action="decrease" data-cartkey="${item.cartKey}">−</button><span>${item.qty}</span><button class="qty-btn" data-action="increase" data-cartkey="${item.cartKey}">+</button></div></div><div class="cart-item-right"><p>${currentCurrency.symbol}${lineTotal.toFixed(2)}</p><button class="remove-btn" data-cartkey="${item.cartKey}">✕</button></div>`;
      cartItemsEl.appendChild(div);
    });
    cartTotalEl.textContent = currentCurrency.symbol + total.toFixed(2); cartCount.textContent = count;
    document.getElementById('checkout-btn').textContent = `CHECKOUT • ${currentCurrency.symbol}${total.toFixed(2)} ${currencyMap[currentCurrency.symbol]}`;
  }

  // ============================================================
  //  CHECKOUT
  // ============================================================

  function openCheckoutPage() {
    const page = document.getElementById('checkout-page');
    page.classList.remove('hidden'); page.classList.add('active');
    document.body.classList.add('checkout-open');
    document.getElementById('co-main-form').style.display = '';
    document.getElementById('co-confirm-screen')?.classList.add('hidden');
    updateProvinceVisibility(); coRenderItems(); setupCheckoutValidation(); refreshMmPanel();
    if (currentUser) {
      const parts = (currentUser.name || '').split(' ');
      const f = document.getElementById('co-fname'), l = document.getElementById('co-lname'), em = document.getElementById('co-email');
      if (f) f.value = parts[0] || ''; if (l) l.value = parts[1] || ''; if (em) em.value = currentUser.email || '';
    }
  }

  window.closeCheckoutPage = function () {
    const page = document.getElementById('checkout-page'); if (!page) return;
    page.classList.add('hidden'); page.classList.remove('active');
    document.body.classList.remove('checkout-open');
  };

  document.getElementById('co-country')?.addEventListener('change', e => { updateCurrencyByCountry(e.target.value); updateProvinceVisibility(); });
  document.getElementById('co-back-to-store')?.addEventListener('click', e => { e.preventDefault(); closeCheckoutPage(); });

  function validateCheckoutForm() {
    const emailEl    = document.getElementById('co-email');
    const fnameEl    = document.getElementById('co-fname');
    const lnameEl    = document.getElementById('co-lname');
    const addressEl  = document.getElementById('co-address');
    const contactEl  = document.getElementById('co-contact');
    const policyCheck= document.getElementById('co-policy-checkbox');
    let valid = true;
    if (emailEl)   { const r = Validator.validateEmail(emailEl.value); emailEl.value = r.value; if (!r.ok) { Validator.showError(emailEl, r.error); valid = false; } else Validator.showValid(emailEl); }
    if (fnameEl)   { const r = Validator.validateName(fnameEl.value, 'First name'); if (!r.ok) { Validator.showError(fnameEl, r.error); valid = false; } else Validator.showValid(fnameEl); }
    if (lnameEl)   { const r = Validator.validateName(lnameEl.value, 'Last name');  if (!r.ok) { Validator.showError(lnameEl, r.error); valid = false; } else Validator.showValid(lnameEl); }
    if (addressEl) { const v = Validator.sanitizeText(addressEl.value); if (!v) { Validator.showError(addressEl, 'Address is required.'); valid = false; } else { addressEl.value = v; Validator.showValid(addressEl); } }
    if (contactEl) { const codeEl = document.getElementById('co-contact-code'); const r = Validator.validatePhone(contactEl.value, codeEl?.value || '+260'); if (!r.ok) { Validator.showError(contactEl, r.error); valid = false; } else Validator.showValid(contactEl); }
    if (policyCheck && !policyCheck.checked) { showToast('Please agree to the store policies.', 'error'); valid = false; }
    return valid;
  }

  function setupCheckoutValidation() {
    Validator.buildPhoneField(document.getElementById('co-contact-wrap'), 'co-contact');
    const emailEl      = document.getElementById('co-email');
    const fnameEl      = document.getElementById('co-fname');
    const lnameEl      = document.getElementById('co-lname');
    const contactCodeEl= document.getElementById('co-contact-code');
    const contactInputEl=document.getElementById('co-contact');
    emailEl?.addEventListener('input',  () => { emailEl.value = emailEl.value.toLowerCase(); if (emailEl.value) { const r = Validator.validateEmail(emailEl.value); r.ok ? Validator.showValid(emailEl) : Validator.showError(emailEl, r.error); } });
    fnameEl?.addEventListener('input',  () => { if (fnameEl.value) { const r = Validator.validateName(fnameEl.value, 'First name'); r.ok ? Validator.showValid(fnameEl) : Validator.showError(fnameEl, r.error); } });
    lnameEl?.addEventListener('input',  () => { if (lnameEl.value) { const r = Validator.validateName(lnameEl.value, 'Last name');  r.ok ? Validator.showValid(lnameEl) : Validator.showError(lnameEl, r.error); } });
    contactInputEl?.addEventListener('input',  () => { if (contactInputEl.value) { const r = Validator.validatePhone(contactInputEl.value, contactCodeEl?.value || '+260'); r.ok ? Validator.showValid(contactInputEl) : Validator.showError(contactInputEl, r.error); } });
    contactCodeEl?.addEventListener('change',  () => { if (contactInputEl?.value) { const r = Validator.validatePhone(contactInputEl.value, contactCodeEl.value); r.ok ? Validator.showValid(contactInputEl) : Validator.showError(contactInputEl, r.error); } });
  }

  async function processOrder(method) {
    if (!validateCheckoutForm()) { showToast('Please fix the highlighted fields.', 'error'); return; }
    const fname   = document.getElementById('co-fname')?.value || '';
    const lname   = document.getElementById('co-lname')?.value || '';
    const email   = document.getElementById('co-email')?.value || '';
    const address = document.getElementById('co-address')?.value || '';
    const contact = document.getElementById('co-contact-input')?.value || document.getElementById('co-contact')?.value || '';
    const contactCode = document.getElementById('co-contact-code')?.value || '';
    const province    = document.getElementById('co-province')?.value || '';
    const country     = document.getElementById('co-country')?.value  || '';
    const subtotal       = getSubtotalDisplay();
    const shippingDisplay= calculateShipping();
    const total          = subtotal + shippingDisplay;
    const locationLine   = [address, province, country].filter(Boolean).join(', ');
    const fullContact    = contactCode ? `${contactCode}${contact}` : contact;

    try {
      const res = await fetch(API + '/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          items: cart.map(i => ({ product_id: i.id, product_name: i.name, name: i.name, price: i.baseZMW, size: i.size, color: i.color, qty: i.qty })),
          ship_first_name: fname, ship_last_name: lname, ship_email: email, ship_phone: fullContact,
          ship_address: address, ship_province: province, ship_country: country,
          currency: currencyMap[currentCurrency.symbol], currency_symbol: currentCurrency.symbol,
          subtotal, shipping_cost: shippingDisplay, grand_total: total,
          is_pickup: pickupMode ? 1 : 0, payment_method: method,
        })
      });
      const data = await res.json(); if (!res.ok) throw new Error(data.message);
      const realRef = data.data.order.ref;

      if (method === 'whatsapp') {
        const itemLines = cart.map(i => `• ${i.name} x${i.qty} (${i.size} / ${i.color}) — ${currentCurrency.symbol}${(getCartItemDisplayPrice(i) * i.qty).toFixed(2)}`).join('%0A');
        const msg = `Hello ILLSTAR! I'd like to place an order 🛒%0A%0A*Items:*%0A${itemLines}%0A%0A*Subtotal:* ${currentCurrency.symbol}${subtotal.toFixed(2)}%0A*Shipping:* ${pickupMode ? 'Physical Pickup (Lusaka)' : currentCurrency.symbol + shippingDisplay.toFixed(2)}%0A*Total:* ${currentCurrency.symbol}${total.toFixed(2)} ${currencyMap[currentCurrency.symbol]}%0A%0A*Order Ref:* #${realRef}%0A*Name:* ${fname} ${lname}%0A*Email:* ${email}%0A*Contact:* ${fullContact}%0A*Address:* ${pickupMode ? 'PHYSICAL PICKUP — Lusaka' : locationLine}`;
        window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank');
      } else {
        const itemText = cart.map(i => `• ${i.name} x${i.qty} (${i.size} / ${i.color}) — ${currentCurrency.symbol}${(getCartItemDisplayPrice(i) * i.qty).toFixed(2)}`).join('\n');
        const igMsg = `Hello ILLSTAR! I'd like to place an order 🛒\n\nItems:\n${itemText}\n\nSubtotal: ${currentCurrency.symbol}${subtotal.toFixed(2)}\nShipping: ${currentCurrency.symbol}${shippingDisplay.toFixed(2)}\nTotal: ${currentCurrency.symbol}${total.toFixed(2)} ${currencyMap[currentCurrency.symbol]}\n\nName: ${fname} ${lname}\nEmail: ${email}\nContact: ${fullContact}\nAddress: ${locationLine}`;
        navigator.clipboard.writeText(igMsg).then(() => showToast('Order details copied!', 'info')).catch(() => {});
        window.open('https://www.instagram.com/illstarstudios', '_blank');
      }
      coShowConfirmation(realRef, { name: `${fname} ${lname}`, email, address: locationLine });
    } catch (err) { showToast('Order failed: ' + err.message, 'error'); }
  }

  document.getElementById('co-pay-whatsapp')?.addEventListener('click', () => processOrder('whatsapp'));
  document.getElementById('co-pay-instagram')?.addEventListener('click', () => processOrder('instagram'));

  function coRenderItems() {
    const container = document.getElementById('co-items'); if (!container) return;
    container.innerHTML = ''; let subtotal = 0;
    cart.forEach(item => {
      const lineTotal = getCartItemDisplayPrice(item) * item.qty; subtotal += lineTotal;
      const div = document.createElement('div'); div.className = 'co-item';
      div.innerHTML = `<div class="co-item-img"><span class="co-item-badge">${item.qty}</span><img src="${item.image}" alt="${item.name}"></div><div class="co-item-details"><p class="co-item-name">${item.name}</p><p class="co-item-variant">${item.color} / ${item.size}</p><p class="co-item-qty">Qty: ${item.qty}</p></div><div class="co-item-price">${currentCurrency.symbol}${lineTotal.toFixed(2)}</div>`;
      container.appendChild(div);
    });
    const shippingDisplay = calculateShipping(), total = subtotal + shippingDisplay;
    const subEl   = document.getElementById('co-subtotal');
    const shipEl  = document.getElementById('co-shipping-display');
    const grandEl = document.getElementById('co-grand-total');
    if (subEl)   subEl.textContent   = currentCurrency.symbol + subtotal.toFixed(2);
    if (shipEl)  shipEl.textContent  = shippingDisplay === 0 ? 'FREE' : currentCurrency.symbol + shippingDisplay.toFixed(2);
    if (grandEl) grandEl.textContent = currentCurrency.symbol + total.toFixed(2);
  }

  function coShowConfirmation(backendRef, orderMeta) {
    const screen = document.getElementById('co-confirm-screen');
    const refEl  = document.getElementById('co-order-ref');
    const form   = document.getElementById('co-main-form');
    const subtotal = getSubtotalDisplay(), shippingDisplay = calculateShipping(), total = subtotal + shippingDisplay;
    // Order status is now read live from the backend in the profile modal
    // (loadProfileOrders), so there's no need to keep a separate localStorage
    // snapshot here anymore — it would only ever go stale.
    const toEmail     = orderMeta?.email || currentUser?.email || '';
    const emailSubject= encodeURIComponent(`ILLSTAR Order Confirmation — #${backendRef}`);
    const emailBody   = encodeURIComponent(`Hi ${orderMeta?.name || 'there'},%0A%0AThank you for your order!%0AOrder Reference: #${backendRef}%0ATotal: ${currentCurrency.symbol}${total.toFixed(2)}`);
    if (toEmail) setTimeout(() => { window.location.href = `mailto:${toEmail}?subject=${emailSubject}&body=${emailBody}`; }, 800);
    if (form)   form.style.display = 'none';
    if (refEl)  refEl.textContent  = 'ORDER #' + backendRef;
    if (screen) screen.classList.remove('hidden');
    cart = []; saveCart(); renderCart();
  }

  // ============================================================
  //  CARD INPUT FORMATTING
  // ============================================================

  function buildCardIcon(v) {
    if (/^4/.test(v))         return `<svg width="38" height="24" viewBox="0 0 780 500" fill="none"><rect width="780" height="500" rx="40" fill="#1A1F71"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica,Arial" font-weight="700" font-size="240" fill="#fff" letter-spacing="-6">VISA</text></svg>`;
    if (/^5[1-5]|^2[2-7]/.test(v)) return `<svg width="44" height="28" viewBox="0 0 152 108" fill="none"><circle cx="54" cy="54" r="54" fill="#EB001B"/><circle cx="98" cy="54" r="54" fill="#F79E1B"/><path d="M76 20.3A54 54 0 0 1 98 54 54 54 0 0 1 76 87.7 54 54 0 0 1 54 54 54 54 0 0 1 76 20.3z" fill="#FF5F00"/></svg>`;
    return '';
  }

  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'co-card-number' || id === 'co-card-number-2') { let v = e.target.value.replace(/\D/g, '').slice(0, 16); e.target.value = v.replace(/(.{4})/g, '$1 ').trim(); const iconId = id === 'co-card-number-2' ? 'card-type-icon-2' : 'card-type-icon'; let icon = document.getElementById(iconId); if (!icon) icon = document.getElementById('card-type-icon'); if (icon) icon.innerHTML = buildCardIcon(v); }
    if (id === 'co-card-expiry' || id === 'co-card-expiry-2') { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; }
    if (id === 'co-card-cvc'   || id === 'co-card-cvc-2' || id === 'co-card-cvv') { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); }
  });

  // ============================================================
  //  SCROLL REVEAL
  // ============================================================

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ============================================================
  //  ADMIN DASHBOARD LOGIC
  // ============================================================

  function injectAdminButton() {
    if (currentUser?.email === 'anthonymush21@gmail.com' && !document.getElementById('go-admin-btn')) {
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'modal-btn'; adminBtn.id = 'go-admin-btn';
        adminBtn.style.cssText = 'background:#111; border:1px solid rgba(255,255,255,0.1); margin-top:10px;';
        adminBtn.textContent = 'ADMIN DASHBOARD';
        logoutBtn.parentNode.insertBefore(adminBtn, logoutBtn);
      }
    }
  }

  // ============================================================
  //  EDIT PRODUCT MODAL
  // ============================================================
  async function openEditProductModal(id) {
    const modal = document.getElementById('admin-product-modal');
    const title = document.getElementById('admin-product-modal-title');
    const body  = document.getElementById('admin-product-form-body');
    
    title.textContent = 'Edit Product';
    body.innerHTML = '<p style="padding:20px;text-align:center;color:var(--muted);">Loading...</p>';
    modal.setAttribute('aria-hidden', 'false');

    try {
      const res = await fetch(`${API}/products/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error('Product not found');
      const p = json.data;

      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;text-align:left;">
          <div><label style="font-size:12px;font-weight:600;color:#777;">NAME</label><input type="text" id="edit-name" value="${p.name}" class="modal-input"></div>
          <div><label style="font-size:12px;font-weight:600;color:#777;">DESCRIPTION</label><textarea id="edit-desc" class="modal-input" rows="3">${p.description || ''}</textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><label style="font-size:12px;font-weight:600;color:#777;">PRICE ZMW</label><input type="number" id="edit-zmw" value="${p.price_zmw}" class="modal-input" step="0.01"></div>
            <div><label style="font-size:12px;font-weight:600;color:#777;">STOCK</label><input type="number" id="edit-stock" value="${p.stock || 0}" class="modal-input"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div><label style="font-size:12px;font-weight:600;color:#777;">PRICE USD</label><input type="number" id="edit-usd" value="${p.price_usd}" class="modal-input" step="0.01"></div>
            <div><label style="font-size:12px;font-weight:600;color:#777;">PRICE GBP</label><input type="number" id="edit-gbp" value="${p.price_gbp}" class="modal-input" step="0.01"></div>
            <div><label style="font-size:12px;font-weight:600;color:#777;">PRICE EUR</label><input type="number" id="edit-eur" value="${p.price_eur}" class="modal-input" step="0.01"></div>
          </div>
          <div style="display:flex;gap:20px;align-items:center;margin-top:5px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;">
              <input type="checkbox" id="edit-soldout" ${p.is_sold_out ? 'checked' : ''}> Mark Sold Out
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;">
              <input type="checkbox" id="edit-disabled" ${p.is_disabled ? 'checked' : ''}> Disable Product
            </label>
          </div>
          <button id="save-product-btn" class="modal-btn" style="margin-top:10px;">Save Changes</button>
        </div>
      `;

      document.getElementById('save-product-btn').onclick = async () => {
        const updateData = {
          name: document.getElementById('edit-name').value,
          description: document.getElementById('edit-desc').value,
          price_zmw: parseFloat(document.getElementById('edit-zmw').value) || 0,
          price_usd: parseFloat(document.getElementById('edit-usd').value) || 0,
          price_gbp: parseFloat(document.getElementById('edit-gbp').value) || 0,
          price_eur: parseFloat(document.getElementById('edit-eur').value) || 0,
          stock: parseInt(document.getElementById('edit-stock').value) || 0,
          is_sold_out: document.getElementById('edit-soldout').checked ? 1 : 0,
          is_disabled: document.getElementById('edit-disabled').checked ? 1 : 0,
        };

        try {
          const saveRes = await fetch(`${API}/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(updateData)
          });
          const saveJson = await saveRes.json();
          if (!saveRes.ok) throw new Error(saveJson.message);
          
          showToast('Product updated successfully!', 'success');
          modal.setAttribute('aria-hidden', 'true');
          window.openAdminDashboard(); // Refresh dashboard tables
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

    } catch (err) {
      body.innerHTML = `<p style="padding:20px;color:red;">Error: ${err.message}</p>`;
    }
  }

  // Close product modal listener
  document.getElementById('close-product-modal')?.addEventListener('click', () => {
    document.getElementById('admin-product-modal').setAttribute('aria-hidden', 'true');
  });

  window.openAdminDashboard = async function () {
  document.getElementById('admin-dashboard').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  closeGlobal();

  try {
    const res = await fetch(`${API}/orders/admin/stats`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const json = await res.json();
    
    if (json.success) {
      const d = json.data;
      document.getElementById('stat-revenue').textContent = `K${parseFloat(d.totalRevenue).toFixed(2)}`;
      document.getElementById('stat-orders').textContent = d.totalOrders;
      document.getElementById('stat-pending').textContent = d.pendingOrders;
      document.getElementById('stat-users').textContent = d.totalUsers;
      document.getElementById('stat-active').textContent = d.activeUsers;
      const currentMonth   = new Date().toISOString().slice(0, 7);
      const visitData      = JSON.parse(localStorage.getItem('illstar_visits') || '{}');
      document.getElementById('stat-visitors').textContent = visitData[currentMonth] || 0;
      
      const orders = d.recentOrders || [];
      const orderTbody = document.getElementById('admin-orders-tbody');
      if (orderTbody) {
        if (orders.length === 0) {
          orderTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No orders yet.</td></tr>';
        } else {
          orderTbody.innerHTML = orders.map(o => {
            const date = new Date(o.created_at).toLocaleDateString();
            const customer = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email;
            const statusMeta  = getOrderStatusMeta(o.order_status);
            const statusBadgeClass = {
              pending: 'badge-pending', confirmed: 'badge-confirmed', shipped: 'badge-shipped',
              delivered: 'badge-delivered', cancelled: 'badge-cancelled', refunded: 'badge-cancelled',
            }[o.order_status] || 'badge-pending';
            const payBadgeClass = o.payment_status === 'paid' ? 'badge-paid' : o.payment_status === 'refunded' ? 'badge-cancelled' : 'badge-unpaid';
            let actionButtons = '—';
            if (o.order_status === 'pending') {
              actionButtons = `
                    <button class="admin-action-btn" data-order-id="${o.id}" data-status="confirmed" style="background:#2ecc71;color:#fff;padding:4px 8px;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Confirm</button>
                    <button class="admin-action-btn" data-order-id="${o.id}" data-status="cancelled" style="background:#e74c3c;color:#fff;padding:4px 8px;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-left:4px;">Cancel</button>`;
            } else if (o.order_status === 'confirmed') {
              actionButtons = `<button class="admin-action-btn" data-order-id="${o.id}" data-status="shipped" style="background:#3498db;color:#fff;padding:4px 8px;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Ship</button>`;
            } else if (o.order_status === 'shipped') {
              actionButtons = `<button class="admin-action-btn" data-order-id="${o.id}" data-status="delivered" style="background:#28a745;color:#fff;padding:4px 8px;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Mark Delivered</button>`;
            }
            return `
              <tr>
                <td>#${o.order_ref}</td>
                <td>${date}</td>
                <td>${customer}</td>
                <td>K${parseFloat(o.total_zmw).toFixed(2)}</td>
                <td><span class="admin-badge ${statusBadgeClass}">${statusMeta.label}</span></td>
                <td>
                  <span class="admin-badge ${payBadgeClass}">${o.payment_status}</span>
                  ${o.proof_of_payment_url ? `<br><a href="${o.proof_of_payment_url}" target="_blank" rel="noopener" title="View payment proof"><img src="${o.proof_of_payment_url}" class="admin-proof-thumb" alt="Payment proof"></a>` : ''}
                </td>
                <td class="admin-actions-cell">
                  <div style="margin-bottom:6px;"><span class="admin-badge ${statusBadgeClass}">${statusMeta.icon} ${statusMeta.label}</span></div>
                  ${actionButtons}
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    }
  } catch(e) {
    console.error("Dashboard stats error:", e);
  }

  // CALL YOUR RICH PRODUCT LOADER
  await loadAdminProducts();
};

  // ============================================================
  //  ADMIN PRODUCT MANAGEMENT
  // ============================================================

  let adminProducts    = [];
  let editingProductId = null;

  // ------------------------------------------------------------
  //  DRAG & DROP REORDERING
  //  Deliberately NOT using the native HTML5 Drag and Drop API here —
  //  it's notoriously unreliable on <tr> elements, gets hijacked by
  //  natively-draggable <img> tags inside the row, and doesn't work at
  //  all on touchscreens. Instead this tracks the pointer directly
  //  (mouse AND touch) and moves the row itself — much more robust.
  // ------------------------------------------------------------
  function enableProductDragDrop() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;

    // loadAdminProducts() re-renders the ROWS every time (edit, toggle,
    // delete, reopen dashboard, etc.) but the <tbody> element itself is
    // never destroyed. Without this guard, every re-render would attach
    // ANOTHER set of drag listeners on top of the previous ones, so after
    // the first re-render you'd get 2+ competing drag sessions firing on
    // every click — which looks exactly like the row getting stuck instead
    // of moving. Bind once, ever, per tbody.
    if (tbody.dataset.dragBound === '1') return;
    tbody.dataset.dragBound = '1';

    let draggedRow = null;

    function getClientY(e) {
      return e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
    }

    function onPointerDown(e) {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const row = handle.closest('tr[data-product-id]');
      if (!row) return;

      e.preventDefault(); // stop touch-scroll / text selection while dragging
      draggedRow = row;
      draggedRow.classList.add('dragging');

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!draggedRow) return;
      e.preventDefault();
      const y = getClientY(e);

      const rows = Array.from(tbody.querySelectorAll('tr[data-product-id]')).filter(r => r !== draggedRow);
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (y < midpoint) {
          if (row.previousElementSibling !== draggedRow) tbody.insertBefore(draggedRow, row);
          return;
        }
      }
      // Past the last row — drop it at the end
      if (tbody.lastElementChild !== draggedRow) tbody.appendChild(draggedRow);
    }

    async function onPointerUp() {
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchend', onPointerUp);

      if (!draggedRow) return;
      draggedRow.classList.remove('dragging');
      draggedRow = null;

      // Backend's reorderProducts controller expects
      // { order: [{ id, sort_order }, ...] }
      const newOrder = Array.from(tbody.querySelectorAll('tr[data-product-id]')).map((r, i) => ({
        id: r.dataset.productId,
        sort_order: i,
      }));

      try {
        const res = await fetch(`${API}/products/reorder/bulk`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ order: newOrder })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to save order');
        showToast('Product order saved.', 'success');
        await loadProducts(); // keep the storefront grid in sync too
      } catch (err) {
        showToast('Failed to save order: ' + err.message, 'error');
      }
    }

    // Delegated on tbody so this keeps working after loadAdminProducts()
    // rewrites the row HTML — no need to re-bind per-row listeners.
    tbody.addEventListener('mousedown', onPointerDown);
    tbody.addEventListener('touchstart', onPointerDown, { passive: false });
  }

  async function loadAdminProducts() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">Loading products...</td></tr>';

    try {
      const res  = await fetch(`${API}/products`, { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json(); if (!res.ok) throw new Error(data.message);
      adminProducts = data.data || [];

      if (adminProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty-products"><p>No products found. Add your first product to get started.</p><button class="admin-add-btn" id="admin-add-product-empty"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Add Product</button></div></td></tr>`;
        document.getElementById('admin-add-product-empty')?.addEventListener('click', () => openProductModal());
        return;
      }

      tbody.innerHTML = adminProducts.map(p => {
        const isSoldOut  = p.is_sold_out  === 1 || p.is_sold_out  === true;
        const isDisabled = p.is_disabled  === 1 || p.is_disabled  === true;
        const sizes  = (p.sizes  || []).map(s => `<span class="admin-size-chip">${s}</span>`).join('');
        const colors = (p.colors || []).map(c => `<span class="admin-color-chip">${c}</span>`).join('');
        let statusBadges = '';
        if      (isDisabled) statusBadges = `<span class="admin-badge badge-disabled">Disabled</span>`;
        else if (isSoldOut)  statusBadges = `<span class="admin-badge badge-soldout">Sold Out</span>`;
        else                 statusBadges = `<span class="admin-badge badge-active">Active</span>`;
        const stockInfo = p.stock != null ? `<span style="font-size:10px; color:var(--muted);">Stock: ${p.stock}</span>` : '';

          return `
          <tr data-product-id="${p.id}">
            <td>
              <div class="drag-handle" title="Drag to reorder">⠿</div>
              <img src="${p.image_url || ''}" alt="${Validator.sanitizeText(p.name)}" class="admin-product-img"
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%23222%22 width=%2250%22 height=%2250%22/><text x=%2225%22 y=%2230%22 fill=%22%23555%22 text-anchor=%22middle%22 font-size=%2210%22>No img</text></svg>'">
            </td>
            <td>
              <span class="admin-product-name">${Validator.sanitizeText(p.name)}</span>
              <span class="admin-product-id">${p.id}</span>
            </td>
            <td style="font-weight:600;">K${parseFloat(p.price_zmw || 0).toFixed(2)}</td>
            <td><div class="admin-product-sizes">${sizes || '<span style="color:#555;">—</span>'}</div></td>
            <td><div class="admin-product-colors">${colors || '<span style="color:#555;">—</span>'}</div></td>
            <td><div class="admin-product-status">${statusBadges}${stockInfo}</div></td>
            <td>
              <div class="admin-product-actions">
                <button class="admin-product-action-btn btn-edit" data-product-id="${p.id}" data-action="edit">Edit</button>
                <button class="admin-product-action-btn ${isSoldOut ? 'btn-soldout btn-restore' : 'btn-soldout'}" data-product-id="${p.id}" data-action="soldout">
                  ${isSoldOut ? '✓ In Stock' : 'Sold Out'}
                </button>
                <button class="admin-product-action-btn ${isDisabled ? 'btn-disable btn-enable' : 'btn-disable'}" data-product-id="${p.id}" data-action="disable">
                  ${isDisabled ? '✓ Enable' : 'Disable'}
                </button>
                <button class="admin-product-action-btn btn-delete" data-product-id="${p.id}" data-action="delete">Delete</button>
              </div>
            </td>
          </tr>`;
      }).join('');

      enableProductDragDrop();

    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ff4757;">Failed to load products: ${err.message}</td></tr>`;
    }
  }

  function openProductModal(productId = null) {
    editingProductId = productId;
    const modal = document.getElementById('admin-product-modal');
    const title = document.getElementById('admin-product-modal-title');
    const body  = document.getElementById('admin-product-form-body');
    if (!modal || !body) return;

    const existingProduct = productId ? adminProducts.find(p => p.id === productId) : null;
    title.textContent = existingProduct ? `Edit: ${existingProduct.name}` : 'Add New Product';

    const sizes       = existingProduct?.sizes        || ['M', 'L', 'XL'];
    const colors      = existingProduct?.colors       || ['Black'];
    const extraImages = existingProduct?.extra_images || [];

    body.innerHTML = `
      <div class="product-form-grid">
        <div class="form-group full-width">
          <label for="pf-name">Product Name *</label>
          <input type="text" id="pf-name" placeholder="e.g. CLASSIC TEE" value="${existingProduct ? Validator.sanitizeText(existingProduct.name) : ''}" required>
        </div>
        <div class="form-group full-width">
          <label>Prices *</label>
          <div class="price-inputs-grid">
            <div class="price-input-col"><label for="pf-price-zmw">ZMW (K)</label><input type="number" id="pf-price-zmw" placeholder="249.99" step="0.01" min="0" value="${existingProduct ? existingProduct.price_zmw : ''}"></div>
            <div class="price-input-col"><label for="pf-price-usd">USD ($)</label><input type="number" id="pf-price-usd" placeholder="49.99"  step="0.01" min="0" value="${existingProduct ? existingProduct.price_usd : ''}"></div>
            <div class="price-input-col"><label for="pf-price-gbp">GBP (£)</label><input type="number" id="pf-price-gbp" placeholder="49.99"  step="0.01" min="0" value="${existingProduct ? existingProduct.price_gbp : ''}"></div>
            <div class="price-input-col"><label for="pf-price-eur">EUR (€)</label><input type="number" id="pf-price-eur" placeholder="49.99"  step="0.01" min="0" value="${existingProduct ? existingProduct.price_eur : ''}"></div>
          </div>
        </div>
        <div class="form-group full-width">
          <label for="pf-desc">Description</label>
          <textarea id="pf-desc" placeholder="Brief product description...">${existingProduct ? Validator.sanitizeText(existingProduct.description || '') : ''}</textarea>
        </div>
        <div class="form-group full-width">
          <label for="pf-details">Extra Details</label>
          <textarea id="pf-details" placeholder="Additional product details, materials, fit info...">${existingProduct ? Validator.sanitizeText(existingProduct.details || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label for="pf-image">Front Image URL *</label>
          <div class="image-input-row">
            <input type="text" id="pf-image" placeholder="images/product-front.jpg" value="${existingProduct ? (existingProduct.image_url || '') : ''}">
            ${existingProduct?.image_url ? `<img src="${existingProduct.image_url}" class="image-preview-thumb" id="pf-image-preview">` : ''}
          </div>
        </div>
        <div class="form-group">
          <label for="pf-back-image">Back Image URL</label>
          <div class="image-input-row">
            <input type="text" id="pf-back-image" placeholder="images/product-back.jpg" value="${existingProduct ? (existingProduct.back_image_url || '') : ''}">
            ${existingProduct?.back_image_url ? `<img src="${existingProduct.back_image_url}" class="image-preview-thumb" id="pf-back-preview">` : ''}
          </div>
        </div>
        <div class="form-group full-width">
          <label>Extra Images</label>
          <div class="multi-value-section" id="pf-extra-images">
            ${extraImages.map((img, i) => `
              <div class="multi-value-row image-input-row" data-index="${i}">
                <input type="text" placeholder="images/extra-${i+1}.jpg" value="${img}" class="pf-extra-img-input">
                ${img ? `<img src="${img}" class="image-preview-thumb">` : ''}
                <button type="button" class="multi-value-remove" data-remove-extra="${i}">✕</button>
              </div>`).join('')}
            <button type="button" class="multi-value-add" id="add-extra-image">+ Add Image</button>
          </div>
        </div>
        <div class="form-group">
          <label>Sizes *</label>
          <div class="multi-value-section" id="pf-sizes">
            ${sizes.map((s, i) => `
              <div class="multi-value-row" data-index="${i}">
                <input type="text" placeholder="Size" value="${s}" class="pf-size-input" maxlength="5">
                <button type="button" class="multi-value-remove" data-remove-size="${i}">✕</button>
              </div>`).join('')}
            <button type="button" class="multi-value-add" id="add-size">+ Add Size</button>
          </div>
        </div>
        <div class="form-group">
          <label>Colors *</label>
          <div class="multi-value-section" id="pf-colors">
            ${colors.map((c, i) => `
              <div class="multi-value-row" data-index="${i}">
                <input type="text" placeholder="Color name" value="${c}" class="pf-color-input">
                <button type="button" class="multi-value-remove" data-remove-color="${i}">✕</button>
              </div>`).join('')}
            <button type="button" class="multi-value-add" id="add-color">+ Add Color</button>
          </div>
        </div>
        <div class="form-group">
          <label for="pf-stock">Stock Quantity</label>
          <input type="number" id="pf-stock" placeholder="e.g. 50" min="0" value="${existingProduct?.stock != null ? existingProduct.stock : ''}">
        </div>
        <div class="form-group">
          <label>Status</label>
          <div class="form-toggles-row">
            <div class="form-toggle-item">
              <span>Sold Out</span>
              <label class="form-toggle-switch">
                <input type="checkbox" id="pf-soldout" ${(existingProduct?.is_sold_out === 1 || existingProduct?.is_sold_out === true) ? 'checked' : ''}>
                <span class="form-toggle-slider"></span>
              </label>
            </div>
            <div class="form-toggle-item">
              <span>Disabled</span>
              <label class="form-toggle-switch">
                <input type="checkbox" id="pf-disabled" ${(existingProduct?.is_disabled === 1 || existingProduct?.is_disabled === true) ? 'checked' : ''}>
                <span class="form-toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="form-btn form-btn-cancel" id="cancel-product-form">Cancel</button>
        <button type="button" class="form-btn form-btn-save" id="save-product-btn">
          ${existingProduct ? 'Save Changes' : 'Create Product'}
        </button>
      </div>`;

    modal.setAttribute('aria-hidden', 'false');
    bindProductFormEvents();
  }

  function bindProductFormEvents() {
    document.getElementById('add-size')?.addEventListener('click', () => {
      const container = document.getElementById('pf-sizes');
      const index = container.querySelectorAll('.multi-value-row').length;
      const row = document.createElement('div'); row.className = 'multi-value-row'; row.dataset.index = index;
      row.innerHTML = `<input type="text" placeholder="Size" value="" class="pf-size-input" maxlength="5"><button type="button" class="multi-value-remove" data-remove-size="${index}">✕</button>`;
      container.insertBefore(row, container.querySelector('.multi-value-add'));
    });

    document.getElementById('add-color')?.addEventListener('click', () => {
      const container = document.getElementById('pf-colors');
      const index = container.querySelectorAll('.multi-value-row').length;
      const row = document.createElement('div'); row.className = 'multi-value-row'; row.dataset.index = index;
      row.innerHTML = `<input type="text" placeholder="Color name" value="" class="pf-color-input"><button type="button" class="multi-value-remove" data-remove-color="${index}">✕</button>`;
      container.insertBefore(row, container.querySelector('.multi-value-add'));
    });

    document.getElementById('add-extra-image')?.addEventListener('click', () => {
      const container = document.getElementById('pf-extra-images');
      const index = container.querySelectorAll('.multi-value-row').length;
      const row = document.createElement('div'); row.className = 'multi-value-row image-input-row'; row.dataset.index = index;
      row.innerHTML = `<input type="text" placeholder="images/extra-${index+1}.jpg" value="" class="pf-extra-img-input"><button type="button" class="multi-value-remove" data-remove-extra="${index}">✕</button>`;
      container.insertBefore(row, container.querySelector('.multi-value-add'));
    });

    document.getElementById('admin-product-form-body')?.addEventListener('click', e => {
      const btn = e.target.closest('.multi-value-remove');
      if (btn) btn.closest('.multi-value-row')?.remove();
    });

    document.getElementById('cancel-product-form')?.addEventListener('click', closeProductModal);
    document.getElementById('save-product-btn')?.addEventListener('click', saveProduct);

    document.getElementById('pf-image')?.addEventListener('blur', function () {
      let preview = document.getElementById('pf-image-preview');
      if (this.value) { if (!preview) { preview = document.createElement('img'); preview.id = 'pf-image-preview'; preview.className = 'image-preview-thumb'; this.parentElement.appendChild(preview); } preview.src = this.value; }
      else if (preview) preview.remove();
    });

    document.getElementById('pf-back-image')?.addEventListener('blur', function () {
      let preview = document.getElementById('pf-back-preview');
      if (this.value) { if (!preview) { preview = document.createElement('img'); preview.id = 'pf-back-preview'; preview.className = 'image-preview-thumb'; this.parentElement.appendChild(preview); } preview.src = this.value; }
      else if (preview) preview.remove();
    });
  }

  function closeProductModal() {
    const modal = document.getElementById('admin-product-modal');
    if (modal) { modal.setAttribute('aria-hidden', 'true'); editingProductId = null; }
  }

  async function saveProduct() {
    const saveBtn = document.getElementById('save-product-btn');
    if (!saveBtn || saveBtn.disabled) return;

    const name        = document.getElementById('pf-name')?.value.trim();
    const priceZmw    = document.getElementById('pf-price-zmw')?.value;
    const priceUsd    = document.getElementById('pf-price-usd')?.value;
    const priceGbp    = document.getElementById('pf-price-gbp')?.value;
    const priceEur    = document.getElementById('pf-price-eur')?.value;
    const description = document.getElementById('pf-desc')?.value.trim();
    const details     = document.getElementById('pf-details')?.value.trim();
    const imageUrl    = document.getElementById('pf-image')?.value.trim();
    const backImageUrl= document.getElementById('pf-back-image')?.value.trim();
    const stock       = document.getElementById('pf-stock')?.value;
    const isSoldOut   = document.getElementById('pf-soldout')?.checked ? 1 : 0;
    const isDisabled  = document.getElementById('pf-disabled')?.checked ? 1 : 0;

    const sizes       = Array.from(document.querySelectorAll('.pf-size-input')).map(el => el.value.trim()).filter(Boolean);
    const colors      = Array.from(document.querySelectorAll('.pf-color-input')).map(el => el.value.trim()).filter(Boolean);
    const extraImages = Array.from(document.querySelectorAll('.pf-extra-img-input')).map(el => el.value.trim()).filter(Boolean);

    if (!name)                              { showToast('Product name is required.', 'error');                            document.getElementById('pf-name')?.focus();      return; }
    if (!priceZmw || parseFloat(priceZmw) <= 0) { showToast('ZMW price is required and must be greater than 0.', 'error'); document.getElementById('pf-price-zmw')?.focus(); return; }
    if (!imageUrl)                          { showToast('Front image URL is required.', 'error');                         document.getElementById('pf-image')?.focus();     return; }
    if (sizes.length === 0)                 { showToast('At least one size is required.', 'error');  return; }
    if (colors.length === 0)                { showToast('At least one color is required.', 'error'); return; }

    const payload = {
      name,
      price_zmw:      parseFloat(priceZmw),
      price_usd:      priceUsd ? parseFloat(priceUsd) : null,
      price_gbp:      priceGbp ? parseFloat(priceGbp) : null,
      price_eur:      priceEur ? parseFloat(priceEur) : null,
      description,
      details,
      image_url:      imageUrl,
      back_image_url: backImageUrl || null,
      extra_images:   extraImages,
      sizes,
      colors,
      stock:          stock ? parseInt(stock) : null,
      is_sold_out:    isSoldOut,
      is_disabled:    isDisabled,
    };

    const originalText = saveBtn.innerHTML;
    saveBtn.disabled   = true;
    saveBtn.innerHTML  = `Saving...`;

    try {
      const isEdit = editingProductId !== null;
      const url    = isEdit ? `${API}/products/${editingProductId}` : `${API}/products/json`;
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.message || data.errors?.[0]?.message || 'Failed to save product');
      showToast(isEdit ? 'Product updated successfully!' : 'Product created successfully!', 'success');
      closeProductModal();
      await loadAdminProducts();
      await loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled  = false;
      saveBtn.innerHTML = originalText;
    }
  }

  async function toggleProductSoldOut(productId) {
    const product = adminProducts.find(p => p.id === productId); if (!product) return;
    const newStatus  = (product.is_sold_out === 1 || product.is_sold_out === true) ? 0 : 1;
    const actionText = newStatus === 1 ? 'mark as SOLD OUT' : 'mark as IN STOCK';
    if (!confirm(`Are you sure you want to ${actionText} "${product.name}"?`)) return;
    try {
      const res  = await fetch(`${API}/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ is_sold_out: newStatus }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.message);
      showToast(`"${product.name}" marked as ${newStatus === 1 ? 'Sold Out' : 'In Stock'}`, 'success');
      await loadAdminProducts(); await loadProducts();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function toggleProductDisabled(productId) {
    const product = adminProducts.find(p => p.id === productId); if (!product) return;
    const newStatus  = (product.is_disabled === 1 || product.is_disabled === true) ? 0 : 1;
    const actionText = newStatus === 1 ? 'DISABLE' : 'ENABLE';
    if (!confirm(`Are you sure you want to ${actionText} "${product.name}"?`)) return;
    try {
      const res  = await fetch(`${API}/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ is_disabled: newStatus }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.message);
      showToast(`"${product.name}" has been ${newStatus === 1 ? 'disabled' : 'enabled'}`, 'success');
      await loadAdminProducts(); await loadProducts();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteProduct(productId) {
    const product = adminProducts.find(p => p.id === productId); if (!product) return;
    if (!confirm(`⚠️ DELETE "${product.name}"?\n\nThis action cannot be undone.`)) return;
    if (!confirm(`Final confirmation: Permanently delete "${product.name}"?`)) return;
    try {
      const res  = await fetch(`${API}/products/${productId}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json(); if (!res.ok) throw new Error(data.message);
      showToast(`"${product.name}" has been deleted.`, 'success');
      await loadAdminProducts(); await loadProducts();
    } catch (err) { showToast(err.message, 'error'); }
  }

  document.getElementById('close-product-modal')?.addEventListener('click', closeProductModal);
  document.getElementById('admin-product-modal')?.addEventListener('click', e => { if (e.target.id === 'admin-product-modal') closeProductModal(); });
  document.getElementById('admin-add-product-btn')?.addEventListener('click', () => openProductModal());

  document.getElementById('admin-products-tbody')?.addEventListener('click', async e => {
    const btn = e.target.closest('.admin-product-action-btn'); if (!btn) return;
    const productId = btn.dataset.productId;
    const action    = btn.dataset.action;
    switch (action) {
      case 'edit':    openProductModal(productId);            break;
      case 'soldout': await toggleProductSoldOut(productId);  break;
      case 'disable': await toggleProductDisabled(productId); break;
      case 'delete':  await deleteProduct(productId);         break;
    }
  });

  // ============================================================
  //  CHECKOUT SUBMIT
  // ============================================================
  window.closeCheckoutPage = function() {
    document.getElementById('checkout-page').classList.add('hidden');
    document.body.classList.remove('checkout-open');
    document.body.style.overflow = '';
  };

  // ============================================================
  //  MOBILE MONEY PANEL — reference code, copy buttons, proof upload
  // ============================================================
  let mmOrderRef = null;
  let mmProofFile = null;

  function generateMmRef() {
    const yr = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ILL-${yr}-${rand}`;
  }

  function refreshMmPanel() {
    mmOrderRef = generateMmRef();
    const refEl = document.getElementById('mm-ref-code');
    if (refEl) refEl.textContent = mmOrderRef;
    const totalEl = document.getElementById('mm-total-amount');
    if (totalEl) {
      const subtotal = getSubtotalDisplay();
      const shipping = calculateShipping();
      totalEl.textContent = currentCurrency.symbol + (subtotal + shipping).toFixed(2);
    }
  }

  // Regenerate whenever the checkout page opens or the mobile money tab is selected
  document.querySelector('.pay-tab[data-tab="mobile_money"]')?.addEventListener('click', refreshMmPanel);

  // Copy-to-clipboard for reference code and phone numbers
  document.addEventListener('click', e => {
    const btn = e.target.closest('.mm-copy-btn');
    if (!btn) return;
    const targetEl = document.getElementById(btn.dataset.copyTarget);
    if (!targetEl) return;
    navigator.clipboard.writeText(targetEl.textContent.trim()).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('mm-copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('mm-copied'); }, 1800);
    }).catch(() => showToast('Could not copy — please copy it manually.', 'error'));
  });

  // Proof of payment file selection + preview
  document.getElementById('mm-proof-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.', 'error'); e.target.value = ''; return; }
    mmProofFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = document.getElementById('mm-proof-preview');
      const wrap = document.getElementById('mm-proof-preview-wrap');
      if (preview) preview.src = ev.target.result;
      if (wrap) wrap.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('mm-proof-remove')?.addEventListener('click', () => {
    mmProofFile = null;
    const input = document.getElementById('mm-proof-input');
    const wrap = document.getElementById('mm-proof-preview-wrap');
    if (input) input.value = '';
    if (wrap) wrap.style.display = 'none';
  });
  
  document.getElementById('co-submit-order')?.addEventListener('click', async () => {
    if (!validateCheckoutForm()) return;

    const activeTab = document.querySelector('.pay-tab.active');
    const paymentMethod = activeTab ? activeTab.dataset.tab : 'cash_on_delivery';

    const submitBtn = document.getElementById('co-submit-order');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Placing Order...';
    submitBtn.disabled = true;

    const currentCode = currencyMap[currentCurrency.symbol];

    // Use the fixed ZMW base prices for everything sent to the backend — this
    // is the true, stable price regardless of which display currency the
    // shopper happened to have selected while browsing.
    const subtotalZmw = cart.reduce((s, i) => s + i.baseZMW * i.qty, 0);
    const shippingZmw = currentCurrency.rate ? calculateShipping() / currentCurrency.rate : calculateShipping();
    
    // If a proof-of-payment screenshot was selected, upload it to Cloudinary
    // first and get back a URL to attach to the order.
    let proofUrl = null;
    if (typeof mmProofFile !== 'undefined' && mmProofFile) {
      try {
        const proofForm = new FormData();
        proofForm.append('proof', mmProofFile);
        const proofRes = await fetch(`${API}/orders/upload-proof`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: proofForm,
        });
        const proofData = await proofRes.json();
        if (proofRes.ok) proofUrl = proofData.data.url;
      } catch (err) {
        console.error('Proof upload failed:', err);
        // Don't block the order over this — it's optional
      }
    }

    const orderPayload = {
      first_name: document.getElementById('co-fname')?.value,
      last_name: document.getElementById('co-lname')?.value,
      email: document.getElementById('co-email')?.value,
      phone: document.getElementById('co-contact')?.value,
      address: document.getElementById('co-address')?.value,
      country: document.getElementById('co-country')?.value,
      province: document.getElementById('co-province')?.value,
      items: cart.map(item => ({
        product_id: item.id,
        name: item.name,
        price: item.baseZMW,
        size: item.size,
        color: item.color,
        qty: item.qty
      })),
      subtotal_zmw: subtotalZmw,
      shipping_zmw: shippingZmw,
      total_zmw: subtotalZmw + shippingZmw,
      currency_used: currentCode,
      payment_method: paymentMethod, 
      is_pickup: pickupMode,
      proof_of_payment_url: proofUrl,
      client_ref: (typeof mmOrderRef !== 'undefined' && mmOrderRef) ? mmOrderRef : null,
    };

    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place order.');

      localStorage.removeItem('cart');
      cart = [];
      renderCart();
      
      document.getElementById('co-main-form').style.display = 'none';
      const confirmScreen = document.getElementById('co-confirm-screen');
      if (confirmScreen) {
        confirmScreen.classList.remove('hidden');
        confirmScreen.innerHTML = `
          <div style="text-align:center; padding:40px 20px;">
            <h2 style="color:#28a745; font-size: 24px;">Order Placed Successfully!</h2>
            <p style="font-size:18px; margin:20px 0;">Thank you for shopping with ILLSTAR.</p>
            ${paymentMethod === 'mobile_money' ? '<p style="color:#666; max-width: 400px; margin: 0 auto;">We have received your order. Once we verify your mobile money payment on our end, we will process your items.</p>' : '<p style="color:#666;">Your order is being prepared.</p>'}
            <button class="modal-btn" onclick="closeCheckoutPage()" style="margin-top:30px; padding: 12px 30px; font-size: 16px; cursor: pointer;">Continue Shopping</button>
          </div>
        `;
      }
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // ============================================================
  //  INIT
  // ============================================================
  loadProducts();
  renderCart();

});