import { supabase } from './supabase.js';
import { toast, fmtDate, fmtRange, statusBadge, avatarEl, escapeHtml } from './app.js';
import { generateBracket } from './bracket.js';

let profile = null;

const _orgInit = async ({ detail: { profile: p } }) => {
  profile = p;
  if (!profile || !['organizer_l1','organizer_l2','admin'].includes(profile.role)) {
    window.location.href = 'index.html';
    return;
  }

  const isL2 = ['organizer_l2','admin'].includes(profile.role);

  // Show/hide L2-only elements
  document.querySelectorAll('.l2-only').forEach(el => {
    el.style.display = isL2 ? '' : 'none';
  });

  initTabs();
  loadTournaments();
  loadRegistrations();
  loadPlayers();
  if (isL2) loadAnnouncements();
};
if (window._appReady) _orgInit({ detail: window._appReady });
else window.addEventListener('app:ready', _orgInit);

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.org-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.org-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.org-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.panel)?.classList.add('active');
    });
  });
}

// ─── Tournaments ──────────────────────────────────────────────────────────────
async function loadTournaments() {
  const { data } = await supabase.from('tournaments').select('*').order('start_date', { ascending: false });
  const wrap = document.getElementById('org-tournaments');
  if (!wrap) return;
  if (!data?.length) { wrap.innerHTML = '<p class="text-muted">No tournaments yet.</p>'; return; }

  wrap.innerHTML = data.map(t => `
    <div class="org-t-row">
      <div>
        <div class="org-t-name">${escapeHtml(t.name)}</div>
        <div class="text-muted" style="font-size:13px">${fmtRange(t.start_date, t.end_date)} — ${escapeHtml(t.location)}</div>
      </div>
      <div class="org-t-actions">
        ${statusBadge(t.status)}
        <a href="tournament.html?id=${escapeHtml(t.id)}" class="btn btn-outline btn-sm">View</a>
        <button class="btn btn-outline btn-sm l2-only" onclick="window._orgGenerateBracket('${escapeHtml(t.id)}')">Generate Bracket</button>
      </div>
    </div>`).join('');

  // Apply L2 visibility again inside dynamic content
  const isL2 = ['organizer_l2','admin'].includes(profile?.role);
  wrap.querySelectorAll('.l2-only').forEach(el => { el.style.display = isL2 ? '' : 'none'; });
}

window._orgGenerateBracket = async (tid) => {
  if (!confirm('Generate bracket? Existing matches for this tournament will be deleted.')) return;
  const ok = await generateBracket(tid);
  if (ok) { toast('Bracket generated!', 'success'); loadTournaments(); }
};

// ─── Tournament creation form ──────────────────────────────────────────────────
document.getElementById('create-t-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!['organizer_l2','admin'].includes(profile?.role)) { toast('No permission.', 'error'); return; }
  const fd   = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  data.created_by  = profile.id;
  data.max_teams   = parseInt(data.max_teams) || 16;
  data.prize_pool  = parseFloat(data.prize_pool) || 0;
  data.entry_fee   = parseFloat(data.entry_fee) || 0;
  data.num_courts  = parseInt(data.num_courts) || 4;
  if (!data.registration_deadline) delete data.registration_deadline;
  const { error } = await supabase.from('tournaments').insert(data);
  if (error) { toast(error.message, 'error'); return; }
  toast('Tournament created!', 'success');
  e.target.reset();
  loadTournaments();
});

// ─── Registrations ────────────────────────────────────────────────────────────
let allRegs = [];

async function loadRegistrations() {
  const { data } = await supabase
    .from('registrations')
    .select('*, tournaments(name)')
    .order('created_at', { ascending: false });
  allRegs = data || [];
  populateTournamentFilter(allRegs);
  renderRegistrations();
}

function populateTournamentFilter(regs) {
  const sel = document.getElementById('reg-t-filter');
  if (!sel) return;
  const ids = [...new Set(regs.map(r => r.tournament_id))];
  sel.innerHTML = '<option value="">All Tournaments</option>' +
    regs.filter((r, i, arr) => arr.findIndex(x => x.tournament_id === r.tournament_id) === i)
        .map(r => `<option value="${escapeHtml(r.tournament_id)}">${escapeHtml(r.tournaments?.name || r.tournament_id)}</option>`)
        .join('');
}

function renderRegistrations() {
  const tbody  = document.getElementById('regs-tbody');
  const filter = document.getElementById('reg-t-filter')?.value;
  if (!tbody) return;

  const filtered = filter ? allRegs.filter(r => r.tournament_id === filter) : allRegs;
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No registrations found.</td></tr>'; return; }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${escapeHtml(r.player1_name)}${r.player2_name ? ' / ' + escapeHtml(r.player2_name) : ''}</td>
      <td>${escapeHtml(r.tournaments?.name || '—')}</td>
      <td>${escapeHtml(r.phone || '—')}</td>
      <td><span class="badge ${r.status === 'approved' ? 'badge-green' : r.status === 'rejected' ? 'badge-red' : 'badge-yellow'}">${r.status}</span></td>
      <td class="row-actions">
        ${r.status !== 'approved' ? `<button class="btn btn-green btn-sm" onclick="window._orgApprove('${escapeHtml(r.id)}')">Approve</button>` : ''}
        ${r.status !== 'rejected' ? `<button class="btn btn-outline btn-sm" onclick="window._orgReject('${escapeHtml(r.id)}')">Reject</button>` : ''}
        ${r.payment_receipt_url  ? `<a href="${escapeHtml(r.payment_receipt_url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Receipt</a>` : ''}
      </td>
    </tr>`).join('');
}

document.getElementById('reg-t-filter')?.addEventListener('change', renderRegistrations);

window._orgApprove = async (id) => {
  const { error } = await supabase.from('registrations').update({ status:'approved' }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Approved.', 'success'); loadRegistrations();
};
window._orgReject = async (id) => {
  const { error } = await supabase.from('registrations').update({ status:'rejected' }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Rejected.', 'success'); loadRegistrations();
};

// ─── Matches ──────────────────────────────────────────────────────────────────
document.getElementById('match-t-filter')?.addEventListener('change', loadMatchesForTournament);

async function loadMatchesForTournament() {
  const tid  = document.getElementById('match-t-filter')?.value;
  const wrap = document.getElementById('matches-wrap');
  if (!wrap) return;
  if (!tid) { wrap.innerHTML = '<p class="text-muted">Select a tournament above.</p>'; return; }

  const { data } = await supabase
    .from('matches')
    .select(`
      id, phase, round, match_number, score, status, team1_reg_id, team2_reg_id, winner_reg_id,
      team1:registrations!matches_team1_reg_id_fkey(player1_name, player2_name),
      team2:registrations!matches_team2_reg_id_fkey(player1_name, player2_name)
    `)
    .eq('tournament_id', tid)
    .neq('status', 'bye')
    .order('phase').order('round').order('match_number');

  if (!data?.length) { wrap.innerHTML = '<p class="text-muted">No matches yet. Generate the bracket first.</p>'; return; }

  const phaseLabel = { group:'Group', quarter_final:'Quarter-Final', semi_final:'Semi-Final', final:'Final', third_place:'3rd Place' };
  wrap.innerHTML = `<table class="org-table">
    <thead><tr><th>Phase</th><th>Team 1</th><th>Team 2</th><th>Score</th><th>Winner</th><th></th></tr></thead>
    <tbody>${data.map(m => {
      const t1 = m.team1 ? escapeHtml(m.team1.player1_name + (m.team1.player2_name ? ' / ' + m.team1.player2_name : '')) : 'TBD';
      const t2 = m.team2 ? escapeHtml(m.team2.player1_name + (m.team2.player2_name ? ' / ' + m.team2.player2_name : '')) : 'TBD';
      return `<tr>
        <td>${phaseLabel[m.phase] || m.phase}</td>
        <td>${t1}</td><td>${t2}</td>
        <td><input class="input input-sm" id="score-${escapeHtml(m.id)}" value="${escapeHtml(m.score||'')}" placeholder="6-4 6-3" style="width:90px"></td>
        <td><select class="input input-sm" id="winner-${escapeHtml(m.id)}" style="width:90px">
          <option value="">—</option>
          ${m.team1_reg_id ? `<option value="${escapeHtml(m.team1_reg_id)}" ${m.winner_reg_id===m.team1_reg_id?'selected':''}>Team 1</option>` : ''}
          ${m.team2_reg_id ? `<option value="${escapeHtml(m.team2_reg_id)}" ${m.winner_reg_id===m.team2_reg_id?'selected':''}>Team 2</option>` : ''}
        </select></td>
        <td><button class="btn btn-green btn-sm" onclick="window._orgSaveMatch('${escapeHtml(m.id)}')">Save</button></td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

// Populate match tournament filter
supabase.from('tournaments').select('id, name').order('start_date', { ascending: false }).then(({ data }) => {
  const sel = document.getElementById('match-t-filter');
  if (!sel || !data) return;
  sel.innerHTML = '<option value="">Select tournament…</option>' +
    data.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
});

window._orgSaveMatch = async (mid) => {
  const score  = document.getElementById(`score-${mid}`)?.value.trim() || null;
  const winner = document.getElementById(`winner-${mid}`)?.value || null;
  const { error } = await supabase.from('matches').update({
    score,
    winner_reg_id: winner || null,
    status:    winner ? 'completed' : 'ongoing',
    played_at: winner ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', mid);
  if (error) { toast(error.message, 'error'); return; }
  toast('Match saved.', 'success');
};

// ─── Players ──────────────────────────────────────────────────────────────────
let allPlayers = [];

async function loadPlayers() {
  const { data } = await supabase.from('profiles')
    .select('id, full_name, avatar_url, origin, gender, is_restricted')
    .eq('role','player').order('full_name');
  allPlayers = data || [];
  renderPlayers();
}

function renderPlayers() {
  const tbody = document.getElementById('players-tbody');
  const q     = document.getElementById('player-search')?.value.toLowerCase().trim() || '';
  if (!tbody) return;
  const filtered = q ? allPlayers.filter(p => p.full_name?.toLowerCase().includes(q) || p.origin?.toLowerCase().includes(q)) : allPlayers;
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No players found.</td></tr>'; return; }
  const isL2 = ['organizer_l2','admin'].includes(profile?.role);
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><div class="player-cell">${avatarEl(p, 32)}<span>${escapeHtml(p.full_name)}</span></div></td>
      <td>${escapeHtml(p.origin || '—')}</td>
      <td>${p.gender === 'male' ? 'Men' : p.gender === 'female' ? 'Women' : '—'}</td>
      <td class="row-actions">
        <span class="badge ${p.is_restricted ? 'badge-red' : 'badge-green'}">${p.is_restricted ? 'Restricted' : 'Active'}</span>
        ${isL2 ? `<button class="btn btn-outline btn-sm" onclick="window._orgToggleRestrict('${escapeHtml(p.id)}', ${!p.is_restricted})">
          ${p.is_restricted ? 'Unrestrict' : 'Restrict'}
        </button>` : ''}
      </td>
    </tr>`).join('');
}

document.getElementById('player-search')?.addEventListener('input', renderPlayers);

window._orgToggleRestrict = async (id, restrict) => {
  await supabase.from('profiles').update({ is_restricted: restrict }).eq('id', id);
  toast(restrict ? 'Player restricted.' : 'Player unrestricted.', 'success');
  loadPlayers();
};

// ─── Announcements ────────────────────────────────────────────────────────────
async function loadAnnouncements() {
  const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
  const wrap = document.getElementById('announcements-list');
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
        <button class="btn btn-outline btn-sm" onclick="window._orgToggleAnnounce('${escapeHtml(a.id)}', ${!a.is_published})">${a.is_published ? 'Unpublish' : 'Publish'}</button>
        <button class="btn btn-outline btn-sm" onclick="window._orgDeleteAnnounce('${escapeHtml(a.id)}')">Delete</button>
      </div>
    </div>`).join('');
}

document.getElementById('add-announce-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from('announcements').insert({
    title: fd.get('title'), body: fd.get('body'),
    is_published: fd.get('is_published') === 'on',
    created_by: profile.id,
  });
  if (error) { toast(error.message, 'error'); return; }
  toast('Announcement saved.', 'success');
  e.target.reset(); loadAnnouncements();
});

window._orgToggleAnnounce = async (id, val) => {
  await supabase.from('announcements').update({ is_published: val }).eq('id', id);
  loadAnnouncements();
};
window._orgDeleteAnnounce = async (id) => {
  if (!confirm('Delete this announcement?')) return;
  await supabase.from('announcements').delete().eq('id', id);
  loadAnnouncements();
};

// ─── Rule Templates ───────────────────────────────────────────────────────────
async function loadRuleTemplates() {
  const { data } = await supabase.from('rule_templates').select('*').order('created_at', { ascending: false });
  const wrap = document.getElementById('rule-templates-list');
  if (!wrap) return;
  if (!data?.length) { wrap.innerHTML = '<p class="text-muted">No templates yet.</p>'; return; }
  wrap.innerHTML = data.map(r => `
    <div class="rule-template-row">
      <div><strong>${escapeHtml(r.title)}</strong><div class="text-muted" style="font-size:13px">${escapeHtml(r.rule_text)}</div></div>
      <button class="btn btn-outline btn-sm" onclick="window._orgDeleteTemplate('${escapeHtml(r.id)}')">Delete</button>
    </div>`).join('');
}

document.getElementById('add-template-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from('rule_templates').insert({
    title: fd.get('title_field'), rule_text: fd.get('rule_text'), created_by: profile.id,
  });
  if (error) { toast(error.message, 'error'); return; }
  toast('Template added.', 'success'); e.target.reset(); loadRuleTemplates();
});

window._orgDeleteTemplate = async (id) => {
  if (!confirm('Delete template?')) return;
  await supabase.from('rule_templates').delete().eq('id', id);
  loadRuleTemplates();
};

// Load rule templates when that panel tab is clicked
document.querySelector('[data-panel="panel-rules"]')?.addEventListener('click', loadRuleTemplates);
