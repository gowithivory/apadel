import { supabase } from './supabase.js';
import { toast } from './app.js';

async function loadContactInfo() {
  const { data } = await supabase.from('contact_info').select('*').eq('id', 1).single();
  if (!data) return;

  const fields = [
    ['whatsapp',  'WhatsApp'],
    ['instagram', 'Instagram'],
    ['email',     'Email'],
    ['location',  'Location'],
    ['facebook',  'Facebook'],
  ];

  const list = document.getElementById('contact-info-list');
  if (list) {
    const items = fields.filter(([k]) => data[k]);
    if (items.length) {
      list.innerHTML = items.map(([k, label]) => `
        <div class="contact-panel-item">
          <span class="contact-panel-label">${label}</span>
          <span class="contact-panel-val">${data[k]}</span>
        </div>`).join('');
    }
  }
}

const form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const fd      = new FormData(form);
    const name    = fd.get('name')?.trim();
    const email   = fd.get('email')?.trim();
    const subject = fd.get('subject')?.trim();
    const message = fd.get('message')?.trim();

    if (!name || !email || !subject || !message) {
      toast('Please fill in all required fields.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Message';
      return;
    }

    const { error } = await supabase.from('contact_submissions').insert({
      name, email,
      phone:   fd.get('phone')?.trim() || null,
      subject, message,
    });

    if (error) {
      toast('Failed to send. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Message';
      return;
    }

    toast("Message sent! We'll be in touch soon.", 'success');
    form.reset();
    btn.disabled = false;
    btn.textContent = 'Send Message';
  });
}

if (window._appReady) loadContactInfo(); else window.addEventListener('app:ready', loadContactInfo);
