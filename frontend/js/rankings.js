import { supabase } from './supabase.js';
import { avatarEl, escapeHtml } from './app.js';

let allStats = [];
let activeGender = 'male';

async function load() {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*, profiles(id, full_name, avatar_url, origin, gender)')
    .order('total_points', { ascending: false });

  if (error) { console.error('Rankings load error:', error.message); return; }
  allStats = data || [];
  render();
}

function render() {
  const tbody = document.getElementById('rankings-body');
  if (!tbody) return;

  const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const filtered = allStats.filter(r => {
    const p = r.profiles;
    if (!p) return false;
    // Only filter by gender if the player has gender set
    if (p.gender && p.gender !== activeGender) return false;
    if (q && !p.full_name?.toLowerCase().includes(q)) return false;
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No ${activeGender === 'male' ? "men's" : "women's"} players found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((r, i) => {
    const p = r.profiles;
    return `
      <tr onclick="window.location.href='player.html?id=${escapeHtml(p.id)}'" style="cursor:pointer">
        <td><div class="rank-cell">
          <span class="rank-num ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
        </div></td>
        <td><div class="player-cell">
          ${avatarEl(p, 38)}
          <div>
            <div class="p-name">${escapeHtml(p.full_name)}</div>
            <div class="p-origin">${escapeHtml(p.origin || '—')}</div>
          </div>
        </div></td>
        <td><span class="pts-cell">${r.total_points}</span></td>
        <td>${r.wins}</td>
        <td>${r.losses}</td>
        <td><strong>${r.titles}</strong></td>
      </tr>`;
  }).join('');
}

// Tab switching
document.querySelectorAll('.gender-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeGender = btn.dataset.gender;
    render();
  });
});

document.getElementById('search-input')?.addEventListener('input', render);

if (window._appReady) load(); else window.addEventListener('app:ready', load);
