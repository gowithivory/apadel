import { supabase } from './supabase.js';
import { fmtDate, escapeHtml } from './app.js';

async function load() {
  const wrap = document.getElementById('announcements-wrap');
  if (!wrap) return;

  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) { wrap.innerHTML = '<div class="empty-state"><p>Failed to load announcements.</p></div>'; return; }
  if (!data?.length) { wrap.innerHTML = '<div class="empty-state"><p>No announcements at this time.</p></div>'; return; }

  wrap.innerHTML = data.map(a => `
    <div class="card mb-4 reveal">
      <div class="card-hdr">
        <span class="card-hdr-title">${escapeHtml(a.title)}</span>
        <span class="text-muted" style="font-size:12px">${fmtDate(a.created_at)}</span>
      </div>
      <div class="card-body">
        <p style="white-space:pre-wrap;font-size:14px;color:var(--text-muted)">${escapeHtml(a.body)}</p>
      </div>
    </div>`).join('');
}

if (window._appReady) load(); else window.addEventListener('app:ready', load);
