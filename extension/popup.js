const SESSION_KEY = 'sijuang-operator-session';
const $ = (id) => document.getElementById(id);
let isSubmitting = false;

function setMessage(text, type = '') {
  const message = $('message');
  message.textContent = text;
  message.className = `message${type ? ` ${type}` : ''}`;
}

function showLogin() {
  $('loginForm').classList.remove('hidden');
  $('submissionForm').classList.add('hidden');
  $('historyPanel').classList.add('hidden');
}

function showSubmission(profile, email) {
  $('operatorIdentity').textContent = `${email} · ${profile.gampong}`;
  $('loginForm').classList.add('hidden');
  $('submissionForm').classList.remove('hidden');
  $('historyPanel').classList.remove('hidden');
}

function getServerError(response, payload, fallback) {
  const message = typeof payload.message === 'string' ? payload.message : '';
  const details = typeof payload.details === 'string' ? payload.details : '';
  const hint = typeof payload.hint === 'string' ? payload.hint : '';
  const code = typeof payload.code === 'string' ? payload.code : '';
  const description = [message, details, hint].filter(Boolean).join(' ');

  if (code === 'PGRST202') {
    return 'Fungsi database SI-JUANG belum ditemukan. Jalankan ulang operator-submissions.sql di Supabase, lalu muat ulang skema API.';
  }
  if (code === 'PGRST205' || (response.status === 404 && fallback.includes('Riwayat'))) {
    return 'Tabel riwayat belum ditemukan. Jalankan operator-submissions.sql di Supabase.';
  }
  if (response.status === 404) {
    return `Endpoint database tidak ditemukan (HTTP 404). Jalankan operator-submissions.sql di Supabase dan periksa kembali skema API.${description ? ` ${description}` : ''}`;
  }
  if (code === '23514') {
    return `Jenis surat belum diizinkan database. Jalankan ulang operator-submissions.sql. ${description}`.trim();
  }
  if (code === '42501' || response.status === 403) {
    return `Database menolak akses akun ini. Periksa profil operator dan kebijakan RLS. ${description}`.trim();
  }
  return description
    ? `Server SI-JUANG menolak pengajuan (HTTP ${response.status}${code ? `, ${code}` : ''}): ${description}`
    : `${fallback} (HTTP ${response.status}${code ? `, ${code}` : ''}).`;
}

function renderSubmissionHistory(submissions) {
  const list = $('historyList');
  list.replaceChildren();

  if (submissions.length === 0) {
    $('historyMessage').textContent = 'Belum ada pengajuan dari akun ini.';
    return;
  }

  $('historyMessage').textContent = '';
  submissions.forEach((submission) => {
    const item = document.createElement('li');
    item.className = 'history-item';

    const header = document.createElement('div');
    header.className = 'history-item-header';
    const code = document.createElement('span');
    code.className = 'history-code';
    code.textContent = submission.request_code;
    const status = document.createElement('span');
    status.className = 'history-status';
    status.textContent = submission.status;
    header.append(code, status);

    const type = document.createElement('p');
    type.className = 'history-type';
    type.textContent = submission.jenis_surat;
    const meta = document.createElement('p');
    meta.className = 'history-meta';
    meta.textContent = `${submission.nama_pemohon} · ${new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(submission.created_at))}`;

    const driveLink = document.createElement('a');
    driveLink.className = 'history-link';
    driveLink.href = submission.drive_url;
    driveLink.target = '_blank';
    driveLink.rel = 'noopener noreferrer';
    driveLink.textContent = 'Buka tautan Drive';

    item.append(header, type, meta, driveLink);
    list.append(item);
  });
}

async function loadSubmissionHistory(session) {
  const list = $('historyList');
  const message = $('historyMessage');
  const button = $('refreshHistoryButton');
  button.disabled = true;
  message.textContent = 'Memuat riwayat...';

  try {
    const query = new URLSearchParams({
      select: 'request_code,jenis_surat,nama_pemohon,status,created_at,drive_url',
      order: 'created_at.desc',
      limit: '10'
    });
    let { response, payload } = await request(
      `/rest/v1/submissions?${query}`,
      { method: 'GET' },
      session.access_token
    );

    if (response.status === 401) {
      const refreshedSession = await refreshSession(session);
      ({ response, payload } = await request(
        `/rest/v1/submissions?${query}`,
        { method: 'GET' },
        refreshedSession.access_token
      ));
    }

    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(getServerError(response, payload, 'Riwayat tidak dapat dimuat'));
    }
    renderSubmissionHistory(payload);
  } catch (error) {
    list.replaceChildren();
    message.textContent = error.message || 'Riwayat tidak dapat dimuat. Periksa koneksi lalu coba lagi.';
  } finally {
    button.disabled = false;
  }
}

function populateLetterTypes() {
  const select = $('jenisSurat');
  select.replaceChildren(new Option('Pilih jenis surat', ''));
  SIJUANG_SURAT_TYPES.forEach((type) => select.add(new Option(type, type)));
}

function ensureStorageSession() {
  if (!chrome.storage || !chrome.storage.session) {
    throw new Error('Browser tidak mendukung penyimpanan sesi extension. Perbarui Chrome ke versi terbaru.');
  }
}

async function request(path, options = {}, accessToken = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIJUANG_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SIJUANG_SUPABASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: SIJUANG_SUPABASE_PUBLISHABLE_KEY,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('Server mengirim respons yang tidak dapat dibaca.');
      }
    }
    return { response, payload };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Permintaan ke server terlalu lama. Periksa koneksi lalu coba lagi.');
    }
    if (error instanceof TypeError) {
      throw new Error('Tidak dapat terhubung ke server SI-JUANG. Periksa koneksi internet.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readOperatorProfile(accessToken, expectedUserId) {
  const userResult = await request('/auth/v1/user', { method: 'GET' }, accessToken);
  if (!userResult.response.ok) {
    throw new Error('Sesi login tidak valid. Silakan masuk kembali.');
  }

  const user = userResult.payload;
  if (!user.id || user.id !== expectedUserId) {
    throw new Error('Identitas akun tidak cocok. Silakan masuk kembali.');
  }

  const query = new URLSearchParams({
    id: `eq.${user.id}`,
    select: 'role,gampong',
    limit: '1'
  });
  const profileResult = await request(`/rest/v1/profiles?${query}`, { method: 'GET' }, accessToken);
  if (!profileResult.response.ok) {
    throw new Error('Tidak dapat memeriksa profil operator. Pastikan kebijakan Supabase sudah dipasang.');
  }

  const profile = Array.isArray(profileResult.payload) ? profileResult.payload[0] : null;
  if (!profile || profile.role !== 'operator' || !profile.gampong) {
    throw new Error('Akun ini belum diizinkan sebagai operator gampong. Hubungi admin kecamatan.');
  }

  return { profile, email: user.email || '' };
}

async function refreshSession(session) {
  if (!session.refresh_token) {
    await chrome.storage.session.remove(SESSION_KEY);
    throw new Error('Sesi Anda telah berakhir. Silakan masuk kembali.');
  }

  const { response, payload } = await request('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    await chrome.storage.session.remove(SESSION_KEY);
    throw new Error('Sesi Anda telah berakhir. Silakan masuk kembali.');
  }

  const updatedSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user_id: payload.user && payload.user.id ? payload.user.id : session.user_id,
    email: payload.user && payload.user.email ? payload.user.email : session.email
  };
  await chrome.storage.session.set({ [SESSION_KEY]: updatedSession });
  return updatedSession;
}

async function getAuthorizedSession() {
  ensureStorageSession();
  let { [SESSION_KEY]: session } = await chrome.storage.session.get(SESSION_KEY);
  if (!session || !session.access_token || !session.user_id) {
    return null;
  }

  let identity;
  try {
    identity = await readOperatorProfile(session.access_token, session.user_id);
  } catch (error) {
    if (!error.message.startsWith('Sesi login tidak valid')) {
      throw error;
    }
    session = await refreshSession(session);
    identity = await readOperatorProfile(session.access_token, session.user_id);
  }

  return { session, ...identity };
}

function validateDriveLink(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Masukkan tautan Google Drive yang valid.');
  }

  if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) {
    throw new Error('Tautan harus berasal dari drive.google.com atau docs.google.com dan memakai HTTPS.');
  }
  return url.href;
}

async function handleLogin(event) {
  event.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || !password) {
    setMessage('Email dan kata sandi wajib diisi.', 'error');
    return;
  }

  const button = $('loginButton');
  button.disabled = true;
  button.textContent = 'Memeriksa akun...';
  setMessage('Memeriksa akun operator...');

  try {
    ensureStorageSession();
    const { response, payload } = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.user || !payload.user.id) {
      throw new Error(response.status === 400 || response.status === 401
        ? 'Email atau kata sandi tidak sesuai.'
        : 'Layanan login sedang tidak tersedia. Periksa konfigurasi Supabase atau coba lagi nanti.');
    }

    const identity = await readOperatorProfile(payload.access_token, payload.user.id);
    const session = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      user_id: payload.user.id,
      email: identity.email
    };
    await chrome.storage.session.set({ [SESSION_KEY]: session });
    $('password').value = '';
    showSubmission(identity.profile, identity.email);
    await loadSubmissionHistory(session);
    setMessage('Berhasil masuk. Silakan isi data pengajuan.', 'success');
  } catch (error) {
    setMessage(error.message || 'Login gagal. Periksa koneksi dan pengaturan Supabase.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Masuk';
  }
}

async function handleSubmission(event) {
  event.preventDefault();
  if (isSubmitting) return;

  const jenisSurat = $('jenisSurat').value;
  const namaPemohon = $('namaPemohon').value.trim();
  const keterangan = $('keterangan').value.trim();
  let driveUrl;

  if (!SIJUANG_SURAT_TYPES.includes(jenisSurat)) {
    setMessage('Pilih jenis surat yang tersedia.', 'error');
    return;
  }
  if (!namaPemohon || namaPemohon.length > 120) {
    setMessage('Nama pemohon wajib diisi dan maksimal 120 karakter.', 'error');
    return;
  }
  if (keterangan.length > 1000) {
    setMessage('Keterangan maksimal 1.000 karakter.', 'error');
    return;
  }
  try {
    driveUrl = validateDriveLink($('driveUrl').value.trim());
  } catch (error) {
    setMessage(error.message, 'error');
    return;
  }

  isSubmitting = true;
  const button = $('submitButton');
  button.disabled = true;
  button.textContent = 'Mengirim...';
  setMessage('Mengirim pengajuan ke SI-JUANG...');

  try {
    let auth = await getAuthorizedSession();
    if (!auth) {
      showLogin();
      throw new Error('Sesi Anda telah berakhir. Silakan masuk kembali.');
    }

    let result = await request('/rest/v1/rpc/submit_document', {
      method: 'POST',
      body: JSON.stringify({
        p_jenis_surat: jenisSurat,
        p_nama_pemohon: namaPemohon,
        p_keterangan: keterangan || null,
        p_drive_url: driveUrl
      })
    }, auth.session.access_token);

    if (result.response.status === 401) {
      auth.session = await refreshSession(auth.session);
      result = await request('/rest/v1/rpc/submit_document', {
        method: 'POST',
        body: JSON.stringify({
          p_jenis_surat: jenisSurat,
          p_nama_pemohon: namaPemohon,
          p_keterangan: keterangan || null,
          p_drive_url: driveUrl
        })
      }, auth.session.access_token);
    }

    if (!result.response.ok) {
      if (result.response.status === 401) {
        await chrome.storage.session.remove(SESSION_KEY);
        showLogin();
        throw new Error('Sesi Anda telah berakhir. Silakan masuk kembali.');
      }
      throw new Error(getServerError(result.response, result.payload, 'Pengajuan gagal disimpan'));
    }

    const code = result.payload.request_code;
    $('submissionForm').reset();
    $('jenisSurat').value = '';
    await loadSubmissionHistory(auth.session);
    setMessage(
      code
        ? `Pengajuan berhasil dikirim. Kode referensi: ${code}`
        : 'Pengajuan berhasil dikirim.',
      'success'
    );
  } catch (error) {
    setMessage(error.message || 'Pengajuan gagal dikirim. Silakan coba lagi.', 'error');
  } finally {
    isSubmitting = false;
    button.disabled = false;
    button.textContent = 'Kirim pengajuan';
  }
}

async function handleLogout() {
  const { [SESSION_KEY]: session } = await chrome.storage.session.get(SESSION_KEY);
  let logoutMessage = 'Anda sudah keluar.';
  let messageType = 'success';
  if (session && session.access_token) {
    try {
      const { response } = await request('/auth/v1/logout', { method: 'POST' }, session.access_token);
      if (!response.ok) {
        logoutMessage = 'Sesi lokal sudah dihapus, tetapi server belum dapat menutup sesi. Silakan coba lagi saat online.';
        messageType = 'error';
      }
    } catch (error) {
      logoutMessage = 'Sesi lokal sudah dihapus, tetapi server tidak dapat dihubungi untuk menutup sesi.';
      messageType = 'error';
      console.warn('Permintaan logout Supabase gagal.', error);
    }
  }
  await chrome.storage.session.remove(SESSION_KEY);
  $('password').value = '';
  $('submissionForm').reset();
  showLogin();
  setMessage(logoutMessage, messageType);
}

async function restoreSession() {
  try {
    const identity = await getAuthorizedSession();
    if (identity) {
      showSubmission(identity.profile, identity.email);
      await loadSubmissionHistory(identity.session);
    } else {
      showLogin();
    }
  } catch (error) {
    await chrome.storage.session.remove(SESSION_KEY);
    showLogin();
    setMessage(error.message || 'Tidak dapat memeriksa sesi. Silakan masuk kembali.', 'error');
  }
}

populateLetterTypes();
$('loginForm').addEventListener('submit', handleLogin);
$('submissionForm').addEventListener('submit', handleSubmission);
$('logoutButton').addEventListener('click', handleLogout);
$('refreshHistoryButton').addEventListener('click', async () => {
  try {
    const auth = await getAuthorizedSession();
    if (auth) {
      await loadSubmissionHistory(auth.session);
    } else {
      showLogin();
      setMessage('Sesi Anda telah berakhir. Silakan masuk kembali.', 'error');
    }
  } catch (error) {
    $('historyMessage').textContent = error.message || 'Riwayat tidak dapat dimuat.';
  }
});
restoreSession();
