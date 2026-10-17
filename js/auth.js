(() => {
  const SESSION_KEY = 'sijuang-admin-session';
  const loginView = document.getElementById('loginView');
  const appShell = document.getElementById('appShell');
  const loginForm = document.getElementById('adminLoginForm');
  const loginMessage = document.getElementById('loginMessage');
  const loginButton = document.getElementById('adminLoginButton');
  const emailInput = document.getElementById('adminEmail');
  const passwordInput = document.getElementById('adminPassword');
  const signedInUser = document.getElementById('signedInUser');

  function configIsReady() {
    return SUPABASE_URL.startsWith('https://') &&
      !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
      Boolean(SUPABASE_PUBLISHABLE_KEY) &&
      !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE_PUBLISHABLE_KEY');
  }

  function showMessage(text, type = 'info') {
    loginMessage.textContent = text;
    loginMessage.className = `result-box ${type}`;
  }

  function readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return session && typeof session.access_token === 'string' ? session : null;
    } catch (error) {
      console.error('Sesi login yang tersimpan tidak dapat dibaca.', error);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  async function request(path, options = {}, token = '') {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  async function isDistrictAdmin(session) {
    const { response, payload } = await request(
      `/auth/v1/user`,
      { method: 'GET' },
      session.access_token
    );
    if (!response.ok || !payload.id) return false;

    const query = new URLSearchParams({
      id: `eq.${payload.id}`,
      select: 'role',
      limit: '1'
    });
    const profile = await request(
      `/rest/v1/profiles?${query.toString()}`,
      { method: 'GET' },
      session.access_token
    );
    return profile.response.ok &&
      Array.isArray(profile.payload) &&
      profile.payload.some((row) => row.role === 'kecamatan_admin');
  }

  function showDashboard(email) {
    loginView.classList.add('hidden');
    appShell.classList.remove('hidden');
    signedInUser.textContent = email || 'Staf Kecamatan';
    document.dispatchEvent(new CustomEvent('sijuang:authenticated'));
  }

  function showLogin() {
    appShell.classList.add('hidden');
    loginView.classList.remove('hidden');
  }

  async function restoreSession() {
    if (!configIsReady()) {
      showLogin();
      showMessage('Supabase belum dikonfigurasi. Isi Project URL dan Publishable Key pada config.js untuk mengaktifkan login.', 'info');
      return;
    }

    const session = readSession();
    if (!session) {
      showLogin();
      return;
    }

    try {
      if (await isDistrictAdmin(session)) {
        showDashboard(session.email);
        return;
      }
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
      showMessage('Sesi berakhir atau akun ini tidak memiliki akses staf kecamatan. Silakan masuk kembali.', 'error');
    } catch (error) {
      console.error('Pemeriksaan sesi Supabase gagal.', error);
      showLogin();
      showMessage('Tidak dapat memeriksa sesi ke Supabase. Periksa koneksi dan konfigurasi project.', 'error');
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!configIsReady()) {
      showMessage('Supabase belum dikonfigurasi. Isi Project URL dan Publishable Key pada config.js terlebih dahulu.', 'error');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      showMessage('Email dan kata sandi wajib diisi.', 'error');
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Memeriksa akun...';
    showMessage('Memeriksa akun staf kecamatan...');

    try {
      const { response, payload } = await request(
        '/auth/v1/token?grant_type=password',
        {
          method: 'POST',
          body: JSON.stringify({ email, password })
        }
      );

      if (response.status === 400 || response.status === 401) {
        showMessage('Email atau kata sandi tidak sesuai.', 'error');
        return;
      }
      if (!response.ok || !payload.access_token) {
        showMessage('Login gagal. Periksa status Supabase Auth dan coba lagi.', 'error');
        return;
      }

      const session = {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        email: payload.user && payload.user.email ? payload.user.email : email
      };
      if (!(await isDistrictAdmin(session))) {
        showMessage('Akun berhasil dikenali, tetapi belum diizinkan sebagai staf kecamatan. Hubungi pengelola SI-JUANG.', 'error');
        return;
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      passwordInput.value = '';
      showDashboard(session.email);
    } catch (error) {
      console.error('Permintaan login Supabase gagal.', error);
      showMessage('Tidak dapat terhubung ke Supabase. Periksa koneksi dan konfigurasi project.', 'error');
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Masuk';
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    passwordInput.value = '';
    showLogin();
    showMessage('Anda sudah keluar dari SI-JUANG.', 'info');
  }

  loginForm.addEventListener('submit', handleLogin);
  document.getElementById('logoutButton').addEventListener('click', logout);
  restoreSession();
})();
