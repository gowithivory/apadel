import { supabase } from './supabase.js';
import { toast, escapeHtml } from './app.js';

const _epInit = async ({ detail: { profile } }) => {
  if (!profile) { window.location.href = 'login.html'; return; }

  // Prefill form fields
  ['full_name','phone','origin','handedness','gender'].forEach(f => {
    const el = document.getElementById(`field-${f}`);
    if (el && profile[f] != null) el.value = profile[f];
  });

  // Show existing avatar preview
  const preview = document.getElementById('avatar-preview');
  if (preview && profile.avatar_url) {
    preview.src = profile.avatar_url;
    preview.style.display = 'block';
  }

  // Live avatar preview on file select
  document.getElementById('avatar-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file || !preview) return;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  });

  document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving...';

    const updates = { updated_at: new Date().toISOString() };
    ['full_name','phone','origin','handedness','gender'].forEach(f => {
      const el = document.getElementById(`field-${f}`);
      if (el) updates[f] = el.value.trim() || null;
    });

    // Avatar upload
    const avatarInput = document.getElementById('avatar-input');
    if (avatarInput?.files?.[0]) {
      const file  = avatarInput.files[0];
      // Validate file type and size (max 5 MB)
      if (!file.type.startsWith('image/')) {
        toast('Please select an image file.', 'error');
        btn.disabled = false; btn.textContent = 'Save Changes';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast('Image must be under 5 MB.', 'error');
        btn.disabled = false; btn.textContent = 'Save Changes';
        return;
      }
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `avatars/${profile.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from('padel-images').upload(path, file, { upsert: true });
      if (upErr) {
        toast('Avatar upload failed: ' + upErr.message, 'error');
      } else {
        const { data: { publicUrl } } = supabase.storage.from('padel-images').getPublicUrl(path);
        updates.avatar_url = publicUrl;
      }
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    if (error) {
      toast(error.message, 'error');
      btn.disabled = false; btn.textContent = 'Save Changes';
      return;
    }
    toast('Profile updated!', 'success');
    setTimeout(() => window.location.href = `player.html?id=${profile.id}`, 1200);
  });
};
if (window._appReady) _epInit({ detail: window._appReady });
else window.addEventListener('app:ready', _epInit);
