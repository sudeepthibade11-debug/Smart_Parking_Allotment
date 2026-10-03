/* ============================================================
   SmartPark — main.js
   Core utilities: API, toasts, modals, stats, health check,
   animated counters, card navigation.
   All original function signatures preserved.
   ============================================================ */

// ── API wrapper ───────────────────────────────────────────────────────────────
const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  },
};

// ── Toast Notifications ───────────────────────────────────────────────────────
function showToast(type, title, msg, duration = 4200) {
  const iconSVGs = {
    success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type} slide-up`;
  toast.innerHTML = `
    <span class="toast-icon">${iconSVGs[type] || iconSVGs.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('show');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop') &&
      e.target.id !== 'map-selector-modal') {
    e.target.classList.remove('show');
  }
});

// ── Animated counter ──────────────────────────────────────────────────────────
function animateCount(el, to, duration = 550) {
  if (!el) return;
  const raw = el.textContent.replace(/[^0-9.]/g, '');
  const from = parseFloat(raw) || 0;
  if (from === to) return;
  const start = performance.now();
  const isFloat = String(to).includes('.');
  const update = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const val = from + (to - from) * ease;
    el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Stats refresh — reads /api/stats and updates all 6 cards ─────────────────
let _lastStats = null;

async function refreshStats() {
  try {
    const stats = await API.get('/api/stats');
    _lastStats = stats;

    // Animate numeric cards
    const animEl = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      const num = parseFloat(val);
      if (!isNaN(num)) animateCount(el, num);
      else el.textContent = val;
    };

    animEl('stat-total',     stats.total);
    animEl('stat-available', stats.available);
    animEl('stat-occupied',  stats.occupied);
    animEl('stat-reserved',  stats.reserved);
    animEl('stat-today',     stats.today_vehicles);

    // Avg park time: show "No data" when zero/null
    const avgEl = document.getElementById('stat-avg-time');
    if (avgEl) {
      if (stats.avg_duration && stats.avg_duration > 0) {
        avgEl.textContent = `${stats.avg_duration}m`;
      } else {
        avgEl.textContent = 'No data';
        avgEl.style.fontSize = '1rem';
      }
    }

    // Utilization
    const utilEl = document.getElementById('stat-utilization');
    if (utilEl) utilEl.textContent = `${stats.utilization}%`;
    const bar = document.getElementById('utilization-bar');
    if (bar) bar.style.width = `${Math.min(stats.utilization, 100)}%`;

  } catch (e) {
    // Backend unreachable — show fallback text, don't crash
    ['stat-total','stat-available','stat-occupied','stat-reserved',
     'stat-today','stat-avg-time'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '—') el.textContent = 'N/A';
    });
    console.warn('Stats refresh failed:', e);
  }
}

// ── System health check ───────────────────────────────────────────────────────
// Updates every element with class "system-status-indicator" on the page.
// States: checking | online | offline

function _applyHealthState(state) {
  // state: 'checking' | 'online' | 'offline'
  const config = {
    checking: { dotClass: 'status-dot checking', text: 'Checking…',     textColor: 'var(--yellow)' },
    online:   { dotClass: 'status-dot',           text: 'System Online', textColor: 'var(--green)'  },
    offline:  { dotClass: 'status-dot offline',   text: 'System Offline',textColor: 'var(--red)'    },
  }[state] || config.checking;

  // navbar indicator (in base.html)
  document.querySelectorAll('.navbar-system-status').forEach(el => {
    const dot = el.querySelector('.status-dot');
    if (dot) dot.className = config.dotClass;
    const txt = el.querySelector('.status-text') || el.lastChild;
    if (txt && txt.nodeType === Node.TEXT_NODE) txt.textContent = ' ' + config.text;
    el.style.color = config.textColor;
  });

  // hero status badge (in index.html)
  document.querySelectorAll('.hero-status').forEach(el => {
    const dot = el.querySelector('.status-dot');
    if (dot) dot.className = config.dotClass;
    const txt = el.querySelector('.hero-status-text');
    if (txt) {
      txt.textContent = config.text;
      txt.style.color = config.textColor;
    }
    el.style.borderColor = config.textColor + '44';
    el.style.background  = config.textColor + '11';
    el.style.color       = config.textColor;
  });
}

async function checkHealth() {
  _applyHealthState('checking');
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _applyHealthState(data.status === 'ok' ? 'online' : 'offline');
  } catch {
    _applyHealthState('offline');
  }
}

// ── Card click navigation ─────────────────────────────────────────────────────
// Called from onclick on each stat card.
// filter param is stored in sessionStorage so parking.html / history.html can read it.

function statCardNav(destination, filter) {
  if (filter) sessionStorage.setItem('sp_filter', filter);
  window.location.href = destination;
}

// ── Vehicle type SVG icon ─────────────────────────────────────────────────────
function vehicleIcon(type) {
  const icons = {
    car:  `<svg class="vehicle-icon" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    bike: `<svg class="vehicle-icon" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17V7l-3 5h7"/><path d="M15 7h2"/></svg>`,
    ev:   `<svg class="vehicle-icon" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  };
  return icons[type] || icons.car;
}

// ── Priority label ────────────────────────────────────────────────────────────
function priorityLabel(p) {
  return { normal:'Normal', senior_citizen:'Senior Citizen',
           accessible:'Accessible', emergency:'Emergency' }[p] || p;
}

// ── Format helpers ────────────────────────────────────────────────────────────
function formatDuration(mins) {
  if (!mins && mins !== 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
           ' · ' + d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

// ── Active nav link ───────────────────────────────────────────────────────────
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.navbar-nav a').forEach(a => {
    a.classList.toggle('active',
      a.getAttribute('href') === path ||
      (path === '/' && a.getAttribute('href') === '/'));
  });
}

// ── Apply sessionStorage filter on parking / history pages ───────────────────
function applyStoredFilter() {
  const filter = sessionStorage.getItem('sp_filter');
  if (!filter) return;
  sessionStorage.removeItem('sp_filter');

  const path = window.location.pathname;

  if (path === '/parking' && filter.startsWith('slot:')) {
    // e.g. "slot:available" or "slot:occupied"
    const status = filter.split(':')[1];
    // Wait for parking lot to render then apply highlight
    window._pendingSlotFilter = status;
  }

  if (path === '/history' && filter.startsWith('hist:')) {
    // e.g. "hist:today"
    window._pendingHistFilter = filter.split(':')[1];
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  applyStoredFilter();
  refreshStats();
  checkHealth();
  setInterval(refreshStats, 15000);
  setInterval(checkHealth,  25000);   // re-check health every 25 s
});
