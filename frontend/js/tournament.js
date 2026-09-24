import { supabase } from './supabase.js';
import { getProfile, toast, fmtDate, fmtRange, fmtMoney, statusBadge, avatarEl, escapeHtml, iconCal, iconPin, iconTeam, iconTrophy } from './app.js';

const params = new URLSearchParams(location.search);
const tid    = params.get('id');
if (!tid) window.location.href = 'tournaments.html';

let tournament    = null;
let registrations = [];

// ─── Main load ────────────────────────────────────────────────────────────────
async function loadTournament() {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', tid).single();
  if (error || !data) {
    document.getElementById('t-wrap').innerHTML = '<div class="empty-state"><p>Tournament not found.</p></div>';
    return;
  }
  tournament = data;
  renderHero(data);
  // Load the rest in parallel
  await Promise.all([loadRules(), loadRegistrations()]);
  loadBracket();
  checkDeadline();
}

// ─── Hero + page structure ───────────────────────────────────────────────────
function renderHero(t) {
  document.title = `${escapeHtml(t.name)} — APadel`;

  const bgStyle = t.image_url ? `background-image:url(${escapeHtml(t.image_url)})` : '';
  document.getElementById('t-wrap').innerHTML = `
    <div class="t-hero" style="${bgStyle}">
      <div class="t-hero-overlay"></div>
      <div class="t-hero-content container">
        <div>${statusBadge(t.status)}</div>
        <h1 class="t-hero-name">${escapeHtml(t.name)}</h1>
        <div class="t-hero-meta">
          <span>${iconCal()} ${fmtRange(t.start_date, t.end_date)}</span>
          <span>${iconPin()} ${escapeHtml(t.location)}</span>
          ${t.surface ? `<span>${escapeHtml(t.surface)}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="t-body container">
      <div class="t-main-grid">
        <div class="t-left">
          ${t.description ? `<div class="card mb-4"><div class="card-hdr">About</div><div class="card-body"><p>${escapeHtml(t.description)}</p></div></div>` : ''}
          <div class="card mb-4"><div class="card-hdr">Rules</div><div class="card-body" id="rules-body"><div class="spinner"></div></div></div>
          <div>
            <div class="section-hdr" style="margin-bottom:14px"><h2 class="section-title" style="font-size:22px">Bracket</h2></div>
            <div id="bracket-wrap"><div class="spinner"></div></div>
          </div>
        </div>

        <div class="t-right">
          <div class="card mb-4">
            <div class="card-hdr">Tournament Info</div>
            <div class="card-body">
              <div class="info-list">
                <div class="info-row"><span>Format</span><span>${escapeHtml((t.format||'group_knockout').replace('_',' '))}</span></div>
                <div class="info-row"><span>Max Teams</span><span>${t.max_teams}</span></div>
                <div class="info-row"><span>Entry Fee</span><span>${fmtMoney(t.entry_fee)}</span></div>
                <div class="info-row"><span>Prize Pool</span><span>${fmtMoney(t.prize_pool)}</span></div>
                ${t.registration_deadline ? `<div class="info-row"><span>Deadline</span><span>${fmtDate(t.registration_deadline)}</span></div>` : ''}
                ${t.num_courts ? `<div class="info-row"><span>Courts</span><span>${t.num_courts}</span></div>` : ''}
              </div>
            </div>
          </div>
          ${renderPrizes(t)}
          <div class="card" id="reg-card">
            <div class="card-hdr">Register</div>
            <div class="card-body" id="reg-body"><div class="spinner"></div></div>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-hdr">
          Registered Teams
          <span class="badge badge-blue" id="teams-count">0</span>
        </div>
        <div class="card-body" id="teams-body"><div class="spinner"></div></div>
      </div>
    </div>`;
}

// ─── Prize breakdown ──────────────────────────────────────────────────────────
function renderPrizes(t) {
  const rows = [
    ['1st Place', t.first_place_cash, t.first_place_cashback_pct],
    ['2nd Place', t.second_place_cash, t.second_place_cashback_pct],
    ['3rd Place', t.third_place_cash, t.third_place_cashback_pct],
    ['4th Place', t.fourth_place_cash, t.fourth_place_cashback_pct],
  ].filter(([, cash, pct]) => cash || pct);
  if (!rows.length) return '';
  return `
    <div class="card mb-4">
      <div class="card-hdr">Prize Breakdown</div>
      <div class="card-body info-list">
        ${rows.map(([pos, cash, pct]) => `
          <div class="info-row">
            <span>${pos}</span>
            <span>${cash ? fmtMoney(cash) : ''}${pct ? ` (${pct}% cashback)` : ''}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── Rules ───────────────────────────────────────────────────────────────────
async function loadRules() {
  const body = document.getElementById('rules-body');
  if (!body) return;
  const { data } = await supabase
    .from('tournament_rules')
    .select('rule_text, sort_order')
    .eq('tournament_id', tid)
    .order('sort_order');
  if (!data?.length) { body.innerHTML = '<p class="text-muted">No rules specified.</p>'; return; }
  body.innerHTML = `<ol class="rules-list">${data.map(r => `<li>${escapeHtml(r.rule_text)}</li>`).join('')}</ol>`;
}

// ─── Registrations ────────────────────────────────────────────────────────────
async function loadRegistrations() {
  const { data } = await supabase
    .from('registrations')
    .select(`
      id, player1_id, player2_id, player1_name, player2_name, group_name, seed, status,
      player1:profiles!registrations_player1_id_fkey(id, full_name, avatar_url),
      player2:profiles!registrations_player2_id_fkey(id, full_name, avatar_url)
    `)
    .eq('tournament_id', tid)
    .eq('status', 'approved')
    .order('seed', { nullsFirst: false });

  registrations = data || [];
  const countEl = document.getElementById('teams-count');
  if (countEl) countEl.textContent = registrations.length;

  const body = document.getElementById('teams-body');
  if (!body) return;
  if (!registrations.length) { body.innerHTML = '<p class="text-muted">No approved teams yet.</p>'; return; }

  body.innerHTML = `<div class="teams-grid">${registrations.map((r, i) => `
    <div class="team-card">
      <div class="team-seed">#${r.seed || i + 1}</div>
      <div class="team-players">
        <div class="team-player">${avatarEl(r.player1, 26)} <span>${escapeHtml(r.player1_name)}</span></div>
        ${r.player2_name ? `<div class="team-player">${avatarEl(r.player2, 26)} <span>${escapeHtml(r.player2_name)}</span></div>` : ''}
      </div>
      ${r.group_name ? `<div class="team-group">Group ${escapeHtml(r.group_name)}</div>` : ''}
    </div>`).join('')}</div>`;

  renderRegSection();
}

// ─── Registration deadline auto-close ────────────────────────────────────────
function checkDeadline() {
  if (!tournament?.registration_deadline) return;
  const deadline = new Date(tournament.registration_deadline);
  if (new Date() > deadline && tournament.status === 'registration_open') {
    supabase.from('tournaments')
      .update({ status: 'ongoing', updated_at: new Date().toISOString() })
      .eq('id', tid)
      .then(() => { tournament.status = 'ongoing'; renderRegSection(); });
  }
}

// ─── Registration form ────────────────────────────────────────────────────────
function renderRegSection() {
  const body = document.getElementById('reg-body');
  if (!body) return;

  const profile = getProfile();
  if (!profile) {
    body.innerHTML = `<p class="text-muted">Please <a href="login.html" class="link">log in</a> to register.</p>`;
    return;
  }

  if (!['upcoming','registration_open'].includes(tournament?.status)) {
    body.innerHTML = `<p class="text-muted">Registration is closed for this tournament.</p>`;
    return;
  }

  const alreadyIn = registrations.some(r => r.player1_id === profile.id || r.player2_id === profile.id);
  if (alreadyIn) {
    body.innerHTML = `<p class="text-muted">You are already registered for this tournament.</p>`;
    return;
  }

  if (registrations.length >= (tournament?.max_teams || 999)) {
    body.innerHTML = `<p class="text-muted">This tournament is full.</p>`;
    return;
  }

  body.innerHTML = `
    <div class="reg-tabs">
      <button class="reg-tab active" data-tab="tab-register">Register as Player 1</button>
      <button class="reg-tab" data-tab="tab-join">Join with Code</button>
    </div>

    <div id="tab-register" class="reg-tab-panel active">
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Register your team. You'll get a shareable team code your partner can use to link their account.</p>
      <form id="reg-form">
        <div class="form-group">
          <label>Your Name (Player 1)</label>
          <input type="text" name="player1_name" class="input" value="${escapeHtml(profile.full_name)}" required>
        </div>
        <div class="form-group">
          <label>Partner Name (Player 2) — optional</label>
          <input type="text" name="player2_name" class="input" placeholder="You can add later via team code">
        </div>
        <div class="form-group">
          <label>Contact Phone</label>
          <input type="tel" name="phone" class="input" placeholder="+20 ...">
        </div>
        ${tournament.entry_fee > 0 ? `
          <div class="reg-fee-box">
            <div class="reg-fee-label">Entry Fee: ${fmtMoney(tournament.entry_fee)}</div>
            <p class="reg-fee-note">Complete payment before submitting. Your registration will be reviewed after payment confirmation.</p>
            <a href="https://paymob.link/qG1L7" target="_blank" rel="noopener" class="btn btn-green btn-sm w-100" style="justify-content:center;margin-bottom:10px">Pay via Paymob &rarr;</a>
          </div>
          <div class="form-group">
            <label>Payment Receipt / Reference</label>
            <input type="text" name="receipt_url" class="input" placeholder="Paste receipt link or reference number">
          </div>` : ''}
        <button type="submit" class="btn btn-green w-100" style="justify-content:center">Submit Registration</button>
      </form>
    </div>

    <div id="tab-join" class="reg-tab-panel">
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Got a team code from your partner? Enter it here to link your account to their registration.</p>
      <form id="join-form">
        <div class="form-group">
          <label>Team Code</label>
          <input type="text" name="join_code" class="input" placeholder="e.g. APD-4X9Z" maxlength="12" style="font-family:monospace;letter-spacing:2px;font-size:18px;text-transform:uppercase" required>
        </div>
        <button type="submit" class="btn btn-green w-100" style="justify-content:center">Join Team</button>
      </form>
    </div>`;

  // Tab switching
  body.querySelectorAll('.reg-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.reg-tab').forEach(b => b.classList.remove('active'));
      body.querySelectorAll('.reg-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      body.querySelector(`#${btn.dataset.tab}`)?.classList.add('active');
    });
  });

  // Register as Player 1
  document.getElementById('reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Submitting...';
    const fd = new FormData(e.target);

    // Generate a unique team code: APD- + 4 random alphanumeric chars
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = 'APD-' + Array.from({length:4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { data: reg, error } = await supabase.from('registrations').insert({
      tournament_id:       tid,
      player1_id:          profile.id,
      player1_name:        fd.get('player1_name'),
      player2_name:        fd.get('player2_name') || null,
      phone:               fd.get('phone') || null,
      payment_receipt_url: fd.get('receipt_url') || null,
      join_code:           code,
      status:              'pending',
    }).select().single();

    if (error) {
      toast(error.message, 'error');
      btn.disabled = false; btn.textContent = 'Submit Registration';
      return;
    }

    toast('Registration submitted!', 'success');
    body.innerHTML = `
      <div class="reg-success">
        <div class="reg-success-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="reg-success-title">Registration Submitted</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Awaiting organizer approval. Share your team code with your partner:</p>
        <div class="team-code-display">${escapeHtml(code)}</div>
        <p style="font-size:12px;color:var(--text-dim);margin-top:8px">Partner enters this code in "Join with Code" on this tournament page</p>
        ${tournament.entry_fee > 0 ? `<a href="https://paymob.link/qG1L7" target="_blank" rel="noopener" class="btn btn-green btn-sm" style="margin-top:16px">Complete Payment via Paymob &rarr;</a>` : ''}
      </div>`;
  });

  // Join as Player 2
  document.getElementById('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Searching...';
    const code = e.target.join_code.value.trim().toUpperCase();

    const { data: reg, error } = await supabase
      .from('registrations')
      .select('id, player1_name, player2_id, player2_name, tournament_id')
      .eq('join_code', code)
      .eq('tournament_id', tid)
      .single();

    if (error || !reg) {
      toast('Code not found for this tournament. Check with your partner.', 'error');
      btn.disabled = false; btn.textContent = 'Join Team';
      return;
    }
    if (reg.player2_id) {
      toast('This team already has a Player 2.', 'error');
      btn.disabled = false; btn.textContent = 'Join Team';
      return;
    }

    const { error: updateErr } = await supabase
      .from('registrations')
      .update({ player2_id: profile.id, player2_name: profile.full_name })
      .eq('id', reg.id);

    if (updateErr) {
      toast(updateErr.message, 'error');
      btn.disabled = false; btn.textContent = 'Join Team';
      return;
    }

    toast(`Joined team with ${escapeHtml(reg.player1_name)}!`, 'success');
    body.innerHTML = `
      <div class="reg-success">
        <div class="reg-success-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="reg-success-title">Team Joined!</div>
        <p style="font-size:13px;color:var(--text-muted)">You've joined the team with <strong>${escapeHtml(reg.player1_name)}</strong>. Awaiting organizer approval.</p>
      </div>`;
  });
}

// ─── Bracket ─────────────────────────────────────────────────────────────────
async function loadBracket() {
  const wrap = document.getElementById('bracket-wrap');
  if (!wrap) return;

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, phase, round, match_number, status, score, team1_reg_id, team2_reg_id, winner_reg_id, group_name,
      team1:registrations!matches_team1_reg_id_fkey(player1_name, player2_name),
      team2:registrations!matches_team2_reg_id_fkey(player1_name, player2_name)
    `)
    .eq('tournament_id', tid)
    .order('round').order('match_number');

  if (!matches?.length) { wrap.innerHTML = '<p class="text-muted">Bracket not generated yet.</p>'; return; }

  const groups   = {};
  const knockout = [];

  matches.forEach(m => {
    if (m.phase === 'group') {
      const g = m.group_name || 'A';
      if (!groups[g]) groups[g] = [];
      groups[g].push(m);
    } else {
      knockout.push(m);
    }
  });

  let html = '';

  if (Object.keys(groups).length) {
    html += `<div class="bracket-section-title">Group Stage</div><div class="groups-grid">`;
    Object.entries(groups).forEach(([name, gm]) => {
      html += `<div class="group-block"><div class="group-title">Group ${escapeHtml(name)}</div>`;
      gm.forEach(m => { html += matchHTML(m); });
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (knockout.length) {
    const phaseOrder = ['quarter_final','semi_final','final','third_place'];
    const phaseLabel = { quarter_final:'Quarter Finals', semi_final:'Semi Finals', final:'Final', third_place:'3rd Place' };
    html += `<div class="bracket-section-title">Knockout Stage</div><div class="knockout-bracket">`;
    phaseOrder.forEach(ph => {
      const pm = knockout.filter(m => m.phase === ph);
      if (!pm.length) return;
      html += `<div class="knockout-round"><div class="round-label">${phaseLabel[ph]}</div>`;
      pm.forEach(m => { html += matchHTML(m); });
      html += `</div>`;
    });
    html += `</div>`;
  }

  wrap.innerHTML = html;
}

function matchHTML(m) {
  const t1Name = m.team1
    ? `${escapeHtml(m.team1.player1_name)}${m.team1.player2_name ? ' / ' + escapeHtml(m.team1.player2_name) : ''}`
    : 'TBD';
  const t2Name = m.team2
    ? `${escapeHtml(m.team2.player1_name)}${m.team2.player2_name ? ' / ' + escapeHtml(m.team2.player2_name) : ''}`
    : (m.status === 'bye' ? 'BYE' : 'TBD');
  const win1 = m.winner_reg_id && m.winner_reg_id === m.team1_reg_id;
  const win2 = m.winner_reg_id && m.winner_reg_id === m.team2_reg_id;
  return `
    <div class="match-card ${m.status === 'completed' ? 'completed' : ''}">
      <div class="match-team ${win1 ? 'winner' : ''}">${t1Name}</div>
      <div class="match-score">${m.score ? escapeHtml(m.score) : 'vs'}</div>
      <div class="match-team ${win2 ? 'winner' : ''}">${t2Name}</div>
    </div>`;
}

if (window._appReady) loadTournament(window._appReady); else window.addEventListener('app:ready', loadTournament);
