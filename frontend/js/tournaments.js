import { supabase } from './supabase.js';
import { tCardHTML } from './app.js';

let allTournaments = [];
let activeStatus   = 'all';

async function load() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) { console.error('Tournaments load error:', error.message); return; }
  allTournaments = data || [];
  updateCounts();
  render();
}

function updateCounts() {
  const statuses = ['upcoming','registration_open','ongoing','completed'];
  statuses.forEach(s => {
    const el = document.getElementById(`count-${s}`);
    if (el) el.textContent = allTournaments.filter(t => t.status === s).length;
  });
  const allEl = document.getElementById('count-all');
  if (allEl) allEl.textContent = allTournaments.length;
}

function render() {
  const grid = document.getElementById('tournaments-grid');
  if (!grid) return;

  const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const filtered = allTournaments.filter(t => {
    if (activeStatus !== 'all' && t.status !== activeStatus) return false;
    if (q && !t.name.toLowerCase().includes(q)) return false;
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>No tournaments found.</p></div>`;
    return;
  }

  grid.classList.add('stagger');
  grid.innerHTML = filtered.map(t => tCardHTML(t, false)).join('');
  // Re-trigger stagger by cloning
  grid.classList.remove('stagger');
  void grid.offsetWidth;
  grid.classList.add('stagger');
}

document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    render();
  });
});

document.getElementById('search-input')?.addEventListener('input', render);

if (window._appReady) load(); else window.addEventListener('app:ready', load);
