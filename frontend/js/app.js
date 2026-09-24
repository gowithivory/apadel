import { supabase } from './supabase.js';

// ─── Expose supabase globally for legacy/inline script access ────────────────
window.db = supabase;

// ─── Auth state ──────────────────────────────────────────────────────────────
let _session = null;
let _profile  = null;

export function getSession() { return _session; }
export function getProfile()  { return _profile; }
export function isLoggedIn()  { return !!_session; }

export async function loadProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  _session = session;
  if (!session) { _profile = null; return null; }
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  _profile = data;
  return data;
}

// ─── XSS-safe HTML escaping — use on ALL user-supplied content in innerHTML ──
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

// ─── Navigation ───────────────────────────────────────────────────────────────
export function renderNav(profile) {
  const right   = document.getElementById('nav-right');
  const dynamic = document.getElementById('nav-dynamic');
  if (!right) return;

  if (!profile) {
    right.innerHTML = `
      <a href="login.html"    class="btn btn-outline btn-sm">Log In</a>
      <a href="register.html" class="btn btn-green   btn-sm">Register</a>`;
    return;
  }

  if (dynamic) {
    const extras = [];
    if (['organizer_l1','organizer_l2','admin'].includes(profile.role))
      extras.push(`<a href="organiser.html">Organiser</a>`);
    if (profile.role === 'admin')
      extras.push(`<a href="admin.html">Admin</a>`);
    dynamic.innerHTML = extras.join('');
  }

  const avatar = profile.avatar_url
    ? `<img src="${escapeHtml(profile.avatar_url)}" class="nav-avatar" alt="avatar">`
    : `<div class="nav-avatar-placeholder">${escapeHtml(profile.full_name?.[0]?.toUpperCase() || '?')}</div>`;

  right.innerHTML = `
    <div class="nav-user">
      <a href="player.html?id=${escapeHtml(profile.id)}" class="nav-user-link">
        ${avatar}
        <span class="nav-user-name">${escapeHtml(profile.full_name)}</span>
      </a>
      <button class="btn btn-outline btn-sm" id="logout-btn">Log Out</button>
    </div>`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });
}

// ─── Nav scroll effect ────────────────────────────────────────────────────────
function initNavScroll() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const toggle = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  toggle();
  window.addEventListener('scroll', toggle, { passive: true });
}

// ─── Hamburger ────────────────────────────────────────────────────────────────
function initHamburger() {
  const ham   = document.getElementById('nav-ham');
  const links = document.getElementById('nav-links');
  if (!ham || !links) return;
  ham.addEventListener('click', () => {
    links.classList.toggle('open');
    ham.classList.toggle('open');
  });
  // Close when a link is clicked (mobile)
  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      links.classList.remove('open');
      ham.classList.remove('open');
    })
  );
}

// ─── Scroll-reveal ────────────────────────────────────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

// ─── Image fade-in on load ────────────────────────────────────────────────────
function initImageFadeIn() {
  const applyFade = img => {
    if (img.complete && img.naturalWidth) { img.classList.add('loaded'); return; }
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
  };
  document.querySelectorAll('img').forEach(applyFade);
  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeName === 'IMG') { applyFade(n); return; }
      if (n.querySelectorAll) n.querySelectorAll('img').forEach(applyFade);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}

// ─── Animated counter ─────────────────────────────────────────────────────────
export function animateCount(el, target, suffix = '') {
  if (!el || isNaN(target)) return;
  const duration = 1400;
  const start = performance.now();
  const tick = (now) => {
    const p    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * target) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
window.animateCount = animateCount;

// ─── Toast ────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg; // textContent is safe — no XSS risk
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}
window.toast = toast;

// ─── Format helpers ───────────────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
export function fmtRange(a, b) {
  const fa = fmtDate(a), fb = fmtDate(b);
  return fa === fb ? fa : `${fa} – ${fb}`;
}
export function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('en-EG') + ' EGP';
}
export function avatarEl(profile, size = 40) {
  if (profile?.avatar_url)
    return `<img src="${escapeHtml(profile.avatar_url)}" class="avatar" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="avatar">`;
  const letter = escapeHtml(profile?.full_name?.[0]?.toUpperCase() || '?');
  return `<div class="avatar-placeholder" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${letter}</div>`;
}
export function statusBadge(s) {
  const cls   = { upcoming:'badge-blue', registration_open:'badge-green', ongoing:'badge-yellow', completed:'badge-gray', cancelled:'badge-red' };
  const label = { upcoming:'Upcoming', registration_open:'Open', ongoing:'Ongoing', completed:'Completed', cancelled:'Cancelled' };
  return `<span class="badge ${cls[s]||'badge-gray'}">${label[s] || escapeHtml(s)}</span>`;
}

// Expose helpers globally for inline scripts
window.fmtDate   = fmtDate;
window.fmtRange  = fmtRange;
window.fmtMoney  = fmtMoney;
window.avatarEl  = avatarEl;
window.statusBadge = statusBadge;

// ─── SVG icon helpers ─────────────────────────────────────────────────────────
export const iconCal    = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
export const iconPin    = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
export const iconTeam   = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;
export const iconTrophy = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"/></svg>`;
window.iconCal = iconCal; window.iconPin = iconPin;
window.iconTeam = iconTeam; window.iconTrophy = iconTrophy;

// ─── Tournament card HTML ─────────────────────────────────────────────────────
export function tCardHTML(t, stagger = false) {
  return `
    <div class="t-card${stagger ? ' reveal' : ''}" onclick="window.location.href='tournament.html?id=${escapeHtml(t.id)}'">
      <div class="t-card-img">
        ${t.image_url ? `<img src="${escapeHtml(t.image_url)}" alt="${escapeHtml(t.name)}" loading="lazy">` : '<div class="t-card-img-placeholder"></div>'}
      </div>
      <div class="t-card-body">
        <div class="t-card-top">
          ${statusBadge(t.status)}
          <div class="t-card-name">${escapeHtml(t.name)}</div>
          <div class="t-card-meta">
            <span>${iconCal()} ${fmtRange(t.start_date, t.end_date)}</span>
            <span>${iconPin()} ${escapeHtml(t.location)}</span>
          </div>
        </div>
        <div class="t-card-bottom">
          <div class="t-card-stat"><div>${escapeHtml(String(t.max_teams))}</div><div>Teams</div></div>
          <div class="t-card-stat"><div>${fmtMoney(t.prize_pool)}</div><div>Prize</div></div>
          <a href="tournament.html?id=${escapeHtml(t.id)}" class="btn btn-green btn-sm">View</a>
        </div>
      </div>
    </div>`;
}
window.tCardHTML = tCardHTML;

// ─── Auth guards ──────────────────────────────────────────────────────────────
export async function requireAuth(redirectTo = 'login.html') {
  const profile = await loadProfile();
  if (!profile) { window.location.href = redirectTo; return null; }
  return profile;
}
export async function requireRole(roles, redirectTo = 'index.html') {
  const profile = await loadProfile();
  if (!profile || !roles.includes(profile.role)) { window.location.href = redirectTo; return null; }
  return profile;
}

// ─── Boot — fires 'app:ready' once auth + nav are resolved ───────────────────
// Stores detail on window._appReady so late-registering module scripts
// can still pick up the event (ES module load order is not guaranteed).
window._appReady = null;
(async () => {
  const profile = await loadProfile();
  renderNav(profile);
  initHamburger();
  initNavScroll();
  initReveal();
  initImageFadeIn();
  const detail = { profile };
  window._appReady = detail;
  window.dispatchEvent(new CustomEvent('app:ready', { detail }));
})();
