import { supabase } from './supabase.js';
import { toast, fmtDate, fmtMoney, escapeHtml } from './app.js';

const _adminInit = async ({ detail: { profile } }) => {
  if (!profile || profile.role !== 'admin') {
    window.location.href = 'index.html';
    return;
  }
  initTabs();
  loadUsers();
  loadSponsors();
  loadPointConfig();
  loadContactInfo();
  loadSubmissions();
  loadAnnouncements();
};
if (window._appReady) _adminInit({ detail: window._appReady });
else window.addEventListener('app:ready', _adminInit);

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.panel)?.classList.add('active');
    });
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────
let allUsers = [];

async function loadUsers() {
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  allUsers = data || [];
  renderUsers();
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  const q     = document.getElementById('user-search')?.value.toLowerCase().trim() || '';
  if (!tbody) return;
  const filtered = q ? allUsers.filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)) : allUsers;
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No users found.</td></tr>'; return; }
  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>${escapeHtml(u.full_name || '—')}</td>
      <td>${escapeHtml(u.email || '—')}</td>
      <td>
        <select class="input input-sm" onchange="window._adminSetRole('${escapeHtml(u.id)}', this.value)">
          ${['player','organizer_l1','organizer_l2','admin'].map(r =>
            `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`
          ).join('')}
        </select>
      </td>
      <td>${u.gender || '—'}</td>
      <td class="row-actions">
        <span class="badge ${u.is_restricted ? 'badge-red' : 'badge-green'}">${u.is_restricted ? 'Restricted' : 'Active'}</span>
        <button class="btn btn-outline btn-sm" onclick="window._adminToggleRestrict('${escapeHtml(u.id)}', ${!u.is_restricted})">
          ${u.is_restricted ? 'Unrestrict' : 'Restrict'}
        </button>
      </td>
    </tr>`).join('');
}

document.getElementById('user-search')?.addEventListener('input', renderUsers);

window._adminSetRole = async (id, role) => {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Role updated.', 'success');
  const user = allUsers.find(u => u.id === id);
  if (user) user.role = role;
};
window._adminToggleRestrict = async (id, val) => {
  await supabase.from('profiles').update({ is_restricted: val }).eq('id', id);
  toast(val ? 'User restricted.' : 'User unrestricted.', 'success');
  loadUsers();
};

// ─── Sponsors ─────────────────────────────────────────────────────────────────
async function loadSponsors() {
  const { data } = await supabase.from('sponsors').select('*').order('sort_order');
  const wrap = document.getElementById('sponsors-list');
  if (!wrap) return;
  if (!data?.length) { wrap.innerHTML = '<p class="text-muted">No sponsors yet.</p>'; return; }
  wrap.innerHTML = data.map(s => `
    <div class="org-t-row">
      <div>
        <strong>${escapeHtml(s.name)}</strong> — ${escapeHtml(s.sponsor_type)}
        ${s.logo_url ? `<img src="${escapeHtml(s.logo_url)}" style="height:28px;margin-left:10px;vertical-align:middle" alt="${escapeHtml(s.name)}">` : ''}
      </div>
      <div class="row-actions">
        <span class="badge ${s.is_active ? 'badge-green' : 'badge-gray'}">${s.is_active ? 'Active' : 'Inactive'}</span>
        <button class="btn btn-outline btn-sm" onclick="window._adminToggleSponsor('${escapeHtml(s.id)}', ${!s.is_active})">${s.is_active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-outline btn-sm" onclick="window._adminDeleteSponsor('${escapeHtml(s.id)}')">Delete</button>
      </div>
    </div>`).join('');
}

document.getElementById('add-sponsor-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const obj  = Object.fromEntries(fd.entries());
  obj.sort_order = parseInt(obj.sort_order) || 0;
  const { error } = await supabase.from('sponsors').insert(obj);
  if (error) { toast(error.message, 'error'); return; }
  toast('Sponsor added.', 'success'); e.target.reset(); loadSponsors();
});

window._adminToggleSponsor = async (id, val) => {
  await supabase.from('sponsors').update({ is_active: val }).eq('id', id);
  loadSponsors();
};
window._adminDeleteSponsor = async (id) => {
  if (!confirm('Delete this sponsor?')) return;
  await supabase.from('sponsors').delete().eq('id', id);
  loadSponsors();
};

// ─── Point config ─────────────────────────────────────────────────────────────
async function loadPointConfig() {
  const { data } = await supabase.from('point_config').select('*').eq('id', 1).single();
  if (!data) return;
  document.getElementById('pc-win').value    = data.match_win_points;
  document.getElementById('pc-title').value  = data.title_bonus_points;
  document.getElementById('pc-runner').value = data.runner_up_bonus_points;
}

document.getElementById('point-config-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const win    = parseInt(document.getElementById('pc-win').value);
  const title  = parseInt(document.getElementById('pc-title').value);
  const runner = parseInt(document.getElementById('pc-runner').value);
  if ([win, title, runner].some(isNaN)) { toast('Enter valid numbers.', 'error'); return; }
  const { error } = await supabase.from('point_config').update({
    match_win_points: win, title_bonus_points: title, runner_up_bonus_points: runner,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) { toast(error.message, 'error'); return; }
  toast('Point config saved.', 'success');
});

// ─── Contact info ─────────────────────────────────────────────────────────────
async function loadContactInfo() {
  const { data } = await supabase.from('contact_info').select('*').eq('id', 1).single();
  if (!data) return;
  ['whatsapp','instagram','facebook','email','location'].forEach(f => {
    const el = document.getElementById(`ci-${f}`);
    if (el) el.value = data[f] || '';
  });
}

document.getElementById('contact-info-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const obj = { updated_at: new Date().toISOString() };
  ['whatsapp','instagram','facebook','email','location'].forEach(f => {
    obj[f] = document.getElementById(`ci-${f}`)?.value.trim() || null;
  });
  const { error } = await supabase.from('contact_info').update(obj).eq('id', 1);
  if (error) { toast(error.message, 'error'); return; }
  toast('Contact info saved.', 'success');
});

// ─── Contact submissions ──────────────────────────────────────────────────────
async function loadSubmissions() {
  const { data } = await supabase.from('contact_submissions').select('*').order('created_at', { ascending: false });
  const wrap = document.getElementById('submissions-wrap');
  if (!wrap) return;
  if (!data?.length) { wrap.innerHTML = '<p class="text-muted">No submissions yet.</p>'; return; }
  wrap.innerHTML = data.map(s => `
    <div class="card mb-4 ${s.is_read ? '' : 'card-unread'}">
      <div class="card-hdr">
        <span>${escapeHtml(s.name)} — <em>${escapeHtml(s.subject)}</em></span>
        <span class="text-muted" style="font-size:12px">${fmtDate(s.created_at)}</span>
      </div>
      <div class="card-body">
        <p style="font-size:14px;margin-bottom:10px">${escapeHtml(s.message)}</p>
        <div class="text-muted" style="font-size:13px">Email: ${escapeHtml(s.email)}${s.phone ? ' | Phone: ' + escapeHtml(s.phone) : ''}</div>
        ${!s.is_read ? `<button class="btn btn-outline btn-sm mt-2" onclick="window._adminMarkRead('${escapeHtml(s.id)}')">Mark as Read</button>` : ''}
      </div>
    </div>`).join('');
}

window._adminMarkRead = async (id) => {
  await supabase.from('contact_submissions').update({ is_read: true }).eq('id', id);
  loadSubmissions();
};

// ─── Announcements ────────────────────────────────────────────────────────────
async function loadAnnouncements() {
  const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
  const wrap = document.getElementById('announcements-admin-list');
  if (!wrap) return;
  if (!data?.length) { wrap.innerHTML = '<p class="text-muted">No announcements yet.</p>'; return; }
  wrap.innerHTML = data.map(a => `
    <div class="org-t-row">
      <div>
        <strong>${escapeHtml(a.title)}</strong>
        <span class="badge ${a.is_published ? 'badge-green' : 'badge-gray'}" style="margin-left:8px">${a.is_published ? 'Published' : 'Draft'}</span>
        <div class="text-muted" style="font-size:12px">${fmtDate(a.created_at)}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-outline btn-sm" onclick="window._adminToggleAnnounce('${escapeHtml(a.id)}', ${!a.is_published})">${a.is_published ? 'Unpublish' : 'Publish'}</button>
        <button class="btn btn-outline btn-sm" onclick="window._adminDeleteAnnounce('${escapeHtml(a.id)}')">Delete</button>
      </div>
    </div>`).join('');
}

document.getElementById('add-announce-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('announcements').insert({
    title: fd.get('title'), body: fd.get('body'),
    is_published: fd.get('is_published') === 'on',
    created_by: user?.id,
  });
  if (error) { toast(error.message, 'error'); return; }
  toast('Announcement created.', 'success'); e.target.reset(); loadAnnouncements();
});

window._adminToggleAnnounce = async (id, val) => {
  await supabase.from('announcements').update({ is_published: val }).eq('id', id);
  loadAnnouncements();
};
window._adminDeleteAnnounce = async (id) => {
  if (!confirm('Delete this announcement?')) return;
  await supabase.from('announcements').delete().eq('id', id);
  loadAnnouncements();
};
