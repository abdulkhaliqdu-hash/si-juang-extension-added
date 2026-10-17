const msg = (text, type = '') => {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.className = 'msg ' + (type || '');
};

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    msg('Email dan password wajib diisi.', 'error');
    return;
  }

  msg('Memproses login...');

  try {
    if (SIJUANG_API_URL.includes('YOUR-PROJECT')) {
      throw new Error('Backend SI-JUANG belum dikonfigurasi. Selesaikan setup Supabase terlebih dahulu.');
    }

    const response = await fetch(`${SIJUANG_API_URL.replace('/api/public/kirim', '/api/public/masuk')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Login gagal.');
    }

    await chrome.storage.local.set({ token: result.access_token || '', email: result.email || email });
    msg('Login berhasil. Dashboard siap terhubung.', 'success');
    if (SIJUANG_WEB_URL) {
      window.open(SIJUANG_WEB_URL, '_blank');
    }
  } catch (error) {
    msg(error.message || 'Gagal login.', 'error');
  }
});
