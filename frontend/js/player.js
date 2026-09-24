import { supabase } from './supabase.js';
import { getProfile, toast, fmtDate, avatarEl, escapeHtml } from './app.js';

const params   = new URLSearchParams(location.search);
const playerId = params.get('id');
if (!playerId) window.location.href = 'rankings.html';

async function load() {
  const [
    { data: profile },
    { data: stats },
    { data: allStats },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', playerId).single(),
    supabase.from('player_stats').select('*').eq('player_id', playerId).single(),
    supabase.from('player_stats').select('player_id').order('total_points', { ascending: false }),
  ]);

  if (!profile) {
    document.getElementById('player-wrap').innerHTML = '<div class="empty-state"><p>Player not found.</p></div>';
    return;
  }

  const rank = allStats ? allStats.findIndex(s => s.player_id === playerId) + 1 : null;
  renderProfile(profile, stats, rank);
  loadHistory();
}

function renderProfile(p, s, rank) {
  document.title = `${escapeHtml(p.full_name)} — APadel`;

  const me = getProfile();
  if (me?.id === playerId) {
    document.getElementById('player-actions').innerHTML =
      `<a href="edit-profile.html" class="btn btn-outline btn-sm">Edit Profile</a>`;
  }

  document.getElementById('player-wrap').innerHTML = `
    <div class="player-hero">
      <div>${avatarEl(p, 100)}</div>
      <div class="player-info">
        <div class="player-hero-name">${escapeHtml(p.full_name)}</div>
        <div class="player-hero-meta">
          ${p.origin     ? `<span>${escapeHtml(p.origin)}</span>`     : ''}
          ${p.gender     ? `<span>${p.gender === 'male' ? 'Men' : 'Women'}</span>` : ''}
          ${p.handedness ? `<span>${escapeHtml(p.handedness)}-handed</span>` : ''}
        </div>
        ${rank ? `<div class="player-rank-badge">#${rank} World Ranking</div>` : ''}
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-box-num">${s?.total_points || 0}</div><div class="stat-box-label">Points</div></div>
      <div class="stat-box"><div class="stat-box-num">${s?.wins        || 0}</div><div class="stat-box-label">Wins</div></div>
      <div class="stat-box"><div class="stat-box-num">${s?.losses      || 0}</div><div class="stat-box-label">Losses</div></div>
      <div class="stat-box"><div class="stat-box-num">${s?.titles      || 0}</div><div class="stat-box-label">Titles</div></div>
      <div class="stat-box"><div class="stat-box-num">${s?.tournaments_played || 0}</div><div class="stat-box-label">Tournaments</div></div>
    </div>`;
}

async function loadHistory() {
  const { data: regs } = await supabase
    .from('registrations')
    .select('id, tournament_id, player1_id, player1_name, player2_name, tournaments(name, start_date)')
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const wrap = document.getElementById('history-wrap');
  if (!wrap) return;

  if (!regs?.length) { wrap.innerHTML = '<p class="text-muted">No tournament history yet.</p>'; return; }

  wrap.innerHTML = `<div class="history-list">${regs.map(r => {
    const partnerName = r.player1_id === playerId ? r.player2_name : r.player1_name;
    return `
      <div class="history-item">
        <div>
          <div class="history-t-name">
            <a href="tournament.html?id=${escapeHtml(r.tournament_id)}" class="link">${escapeHtml(r.tournaments?.name || '—')}</a>
          </div>
          <div class="history-t-date text-muted">${fmtDate(r.tournaments?.start_date)}</div>
        </div>
        <div class="partner">Partner: ${escapeHtml(partnerName || '—')}</div>
      </div>`;
  }).join('')}</div>`;
}

if (window._appReady) load(); else window.addEventListener('app:ready', load);
