import { supabase } from './supabase.js';
import { toast } from './app.js';

// ─── LOGIN ───────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = loginForm.email.value.trim();
    const password = loginForm.password.value;
    const btn      = loginForm.querySelector('[type="submit"]');

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }

    // Role-based redirect
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', (await supabase.auth.getUser()).data.user.id).single();
    const role = profile?.role;
    if (role === 'admin') { window.location.href = 'admin.html'; }
    else if (['organizer_l1','organizer_l2'].includes(role)) { window.location.href = 'organiser.html'; }
    else { window.location.href = 'index.html'; }
  });
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
const regForm = document.getElementById('register-form');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const full_name  = regForm.full_name.value.trim();
    const email      = regForm.email.value.trim();
    const password   = regForm.password.value;
    const confirm    = regForm.confirm_password.value;
    const gender     = regForm.gender.value;
    const handedness = regForm.handedness?.value || null;
    const phone      = regForm.phone?.value.trim() || null;
    const origin     = regForm.origin?.value.trim() || null;
    const btn        = regForm.querySelector('[type="submit"]');

    if (password !== confirm) { toast('Passwords do not match', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Creating account...';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name, gender, handedness, phone, origin } }
    });

    if (error) {
      toast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }

    toast('Account created! Please check your email to confirm.', 'success');
    setTimeout(() => window.location.href = 'login.html', 2000);
  });
}

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
const forgotForm = document.getElementById('forgot-form');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = forgotForm.email.value.trim();
    const btn   = forgotForm.querySelector('[type="submit"]');

    btn.disabled = true;
    btn.textContent = 'Sending...';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password.html'
    });

    if (error) { toast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Send Reset Link'; return; }
    toast('Password reset link sent. Check your email.', 'success');
  });
}

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
const resetForm = document.getElementById('reset-form');
if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = resetForm.password.value;
    const confirm  = resetForm.confirm_password.value;
    const btn      = resetForm.querySelector('[type="submit"]');

    if (password !== confirm) { toast('Passwords do not match', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Updating...';

    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Update Password'; return; }

    toast('Password updated successfully!', 'success');
    setTimeout(() => window.location.href = 'login.html', 1500);
  });
}
