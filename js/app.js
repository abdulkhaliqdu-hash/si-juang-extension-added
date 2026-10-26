const SESSION_KEY = 'sijuang-admin-session';
const PAGE_SIZE = 500;
const SUBMISSION_STATUSES = ['Verifikasi', 'Srikandi', 'Selesai TTE', 'Ditolak', 'Batal'];
const state = { documents: [], isLoading: false, loadError: '' };

const statsGrid = document.getElementById('statsGrid');
const tableBody = document.getElementById('tableBody');
const statusForm = document.getElementById('statusForm');
const nomorSuratInput = document.getElementById('nomorSurat');
const statusResult = document.getElementById('statusResult');
const whatsappForm = document.getElementById('whatsappForm');
const waMessage = document.getElementById('waMessage');
const waDocCode = document.getElementById('waDocCode');
const waSubmission = document.getElementById('waSubmission');
const waDriveLink = document.getElementById('waDriveLink');
const leaderboardBody = document.getElementById('leaderboardBody');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const submissionLoadMessage = document.getElementById('submissionLoadMessage');
const refreshSubmissionsButton = document.getElementById('refreshSubmissions');

const views = {
  dashboard: {
    title: 'Dashboard Analitik',
    subtitle: 'Ringkasan statistik dan pencarian status surat.'
  },
  pelayanan: {
    title: 'Pelayanan & Surat',
    subtitle: 'Pantau pengajuan operator, tautan Drive, dan siapkan pesan WhatsApp.'
  },
  operator: {
    title: 'Manajemen Akun Kecamatan',
    subtitle: 'Pengelolaan akun staf kecamatan akan tersedia setelah backend aktif.'
  },
  leaderboard: {
    title: 'Leaderboard Pengajuan',
    subtitle: 'Peringkat per gampong dihitung hanya dari naskah yang selesai TTE.'
  }
};

function getAdminSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!session || typeof session.access_token !== 'string' || !session.access_token) {
      throw new Error('Sesi admin berakhir. Silakan masuk kembali.');
    }
    return session;
  } catch (error) {
    if (error instanceof SyntaxError) {
      sessionStorage.removeItem(SESSION_KEY);
      throw new Error('Sesi admin tidak terbaca. Silakan masuk kembali.');
    }
    throw error;
  }
}

async function requestSupabase(path, options = {}) {
  let session = getAdminSession();
  let response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: getSupabaseHeaders(session.access_token, options)
  });

  if (response.status === 401 && session.refresh_token) {
    const refreshResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const refreshed = await refreshResponse.json().catch(() => ({}));
    if (!refreshResponse.ok || !refreshed.access_token || !refreshed.refresh_token) {
      sessionStorage.removeItem(SESSION_KEY);
      throw new Error('Sesi admin berakhir. Silakan masuk kembali.');
    }
    session = {
      ...session,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: getSupabaseHeaders(session.access_token, options)
    });
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('Supabase mengirim respons yang tidak dapat dibaca.');
    }
  }
  return { response, payload, session };
}

function getSupabaseHeaders(accessToken, options) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };
}

function formatSupabaseError(response, payload) {
  const code = payload && typeof payload.code === 'string' ? payload.code : '';
  const message = payload && typeof payload.message === 'string'
    ? payload.message
    : 'Permintaan database gagal.';
  if (response.status === 401) return 'Sesi admin berakhir. Silakan masuk kembali.';
  if (response.status === 403 || code === '42501') {
    return `Akun admin tidak memiliki izin membaca atau mengubah pengajuan. Periksa role kecamatan_admin dan kebijakan RLS. ${message}`;
  }
  if (response.status === 404 || code.startsWith('PGRST')) {
    return `Tabel submissions belum tersedia di API Supabase. Jalankan supabase/operator-submissions.sql. ${message}`;
  }
  return `Supabase menolak permintaan (HTTP ${response.status}${code ? `, ${code}` : ''}): ${message}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function getStatusClass(status) {
  const map = {
    'Verifikasi': 'status-verifikasi',
    'Srikandi': 'status-srikandi',
    'Selesai TTE': 'status-selesai',
    'Ditolak': 'status-ditolak',
    'Batal': 'status-batal'
  };
  return map[status] || 'status-verifikasi';
}

function computeStats() {
  const activeDocuments = state.documents.filter((document) => document.status !== 'Batal');
  return [
    { label: 'Pengajuan Aktif', value: activeDocuments.length, trend: 'Tidak termasuk pengajuan batal' },
    { label: 'Menunggu Verifikasi', value: state.documents.filter((document) => document.status === 'Verifikasi').length, trend: 'Butuh review', variant: 'warning' },
    { label: 'Selesai', value: state.documents.filter((document) => document.status === 'Selesai TTE').length, trend: 'Dokumen valid', variant: 'success' },
    { label: 'Ditolak', value: state.documents.filter((document) => document.status === 'Ditolak').length, trend: 'Perlu tindak lanjut', variant: 'danger' }
  ];
}

function renderStats() {
  statsGrid.innerHTML = computeStats().map((item) => `
    <div class="stat-card ${item.variant || ''}">
      <div class="stat-label">${escapeHtml(item.label)}</div>
      <div class="stat-value">${state.loadError ? '—' : item.value}</div>
      <div class="stat-trend">${escapeHtml(item.trend)}</div>
    </div>
  `).join('');
}

function getDriveUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function formatSubmissionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak valid';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function renderTable() {
  if (state.isLoading) {
    tableBody.innerHTML = '<tr><td colspan="7" class="muted">Memuat pengajuan dari Supabase...</td></tr>';
    return;
  }

  if (state.loadError) {
    tableBody.innerHTML = `<tr><td colspan="7" class="muted">${escapeHtml(state.loadError)}</td></tr>`;
    return;
  }

  if (!state.documents.length) {
    tableBody.innerHTML = '<tr><td colspan="7" class="muted">Belum ada pengajuan di database.</td></tr>';
    return;
  }

  tableBody.innerHTML = state.documents.map((document) => {
    const safeLink = getDriveUrl(document.drive_url);
    const driveCell = safeLink
      ? `<a class="link-btn" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">Buka Drive</a>`
      : '<span class="muted">Tautan tidak valid</span>';
    const statusOptions = SUBMISSION_STATUSES.map((status) => `
      <option value="${escapeHtml(status)}"${document.status === status ? ' selected' : ''}>${escapeHtml(status)}</option>
    `).join('');
    const action = `
      <div class="status-control">
        <select class="status-select" aria-label="Status ${escapeHtml(document.request_code)}">
          ${statusOptions}
        </select>
        <button class="secondary-btn status-save" type="button" data-action="update-status" data-id="${escapeHtml(document.id)}" aria-label="Simpan status ${escapeHtml(document.request_code)}">Simpan</button>
      </div>
    `;

    return `
      <tr>
        <td><strong>${escapeHtml(document.request_code)}</strong></td>
        <td>${escapeHtml(formatSubmissionDate(document.created_at))}</td>
        <td>${escapeHtml(document.gampong)}</td>
        <td>${escapeHtml(document.jenis_surat)}</td>
        <td>${driveCell}</td>
        <td><span class="status-pill ${getStatusClass(document.status)}">${escapeHtml(document.status)}</span></td>
        <td>${action}</td>
      </tr>
    `;
  }).join('');
}

function renderLeaderboard() {
  if (state.loadError) {
    leaderboardBody.innerHTML = `<tr><td colspan="3" class="muted">${escapeHtml(state.loadError)}</td></tr>`;
    return;
  }

  const counts = new Map();
  state.documents.forEach((document) => {
    if (document.status !== 'Selesai TTE') return;
    counts.set(document.gampong, (counts.get(document.gampong) || 0) + 1);
  });

  const rows = Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], 'id'))
    .map(([gampong, total], index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(gampong)}</strong></td>
        <td>${total}</td>
      </tr>
    `);

  leaderboardBody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="3" class="muted">Belum ada naskah yang selesai TTE.</td></tr>';
}

function renderDashboard() {
  renderStats();
  renderTable();
  renderLeaderboard();
  renderWhatsAppSubmissions();
}

function renderWhatsAppSubmissions() {
  const selectedId = waSubmission.value;
  waSubmission.replaceChildren(new Option('Pilih pengajuan untuk mengisi tautan Drive', ''));
  state.documents.forEach((document) => {
    const option = new Option(
      `${document.request_code} · ${document.nama_pemohon} · ${document.gampong}`,
      document.id
    );
    waSubmission.add(option);
  });

  if (state.documents.some((document) => document.id === selectedId)) {
    waSubmission.value = selectedId;
  } else if (selectedId) {
    waSubmission.value = '';
    waDriveLink.value = '';
  }
}

async function loadSubmissions() {
  if (state.isLoading) return;
  state.isLoading = true;
  state.loadError = '';
  refreshSubmissionsButton.disabled = true;
  submissionLoadMessage.textContent = 'Memuat pengajuan dari Supabase...';
  submissionLoadMessage.className = 'result-box info';
  renderDashboard();

  try {
    const submissions = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query = new URLSearchParams({
        select: 'id,request_code,created_at,gampong,jenis_surat,drive_url,status,nama_pemohon,keterangan',
        order: 'created_at.desc',
        limit: String(PAGE_SIZE),
        offset: String(offset)
      });
      const { response, payload } = await requestSupabase(`/rest/v1/submissions?${query}`);
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(formatSupabaseError(response, payload));
      }
      submissions.push(...payload);
      if (payload.length < PAGE_SIZE) break;
    }

    state.documents = submissions;
    submissionLoadMessage.textContent = `${submissions.length} pengajuan dimuat dari database Supabase.`;
    submissionLoadMessage.className = 'result-box success';
    renderDashboard();
  } catch (error) {
    state.documents = [];
    state.loadError = error.message || 'Pengajuan tidak dapat dimuat. Periksa koneksi dan kebijakan Supabase.';
    submissionLoadMessage.textContent = state.loadError;
    submissionLoadMessage.className = 'result-box error';
    renderDashboard();
    showStatusResult(state.loadError, 'error');
    console.error('Gagal memuat pengajuan SI-JUANG dari Supabase.', error);
  } finally {
    state.isLoading = false;
    refreshSubmissionsButton.disabled = false;
    renderTable();
  }
}

function showView(viewName) {
  if (!views[viewName]) return;

  document.querySelectorAll('.view-page').forEach((view) => {
    view.classList.toggle('hidden', view.id !== `view-${viewName}`);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  pageTitle.textContent = views[viewName].title;
  pageSubtitle.textContent = views[viewName].subtitle;
}

function showStatusResult(message, type = 'info') {
  statusResult.textContent = message;
  statusResult.className = `result-box ${type}`;
}

function handleStatusCheck(event) {
  event.preventDefault();
  const query = nomorSuratInput.value.trim();
  if (!query) {
    showStatusResult('Nomor surat harus diisi.', 'error');
    return;
  }

  const found = state.documents.find((document) => document.request_code.toLowerCase() === query.toLowerCase());
  if (!found) {
    showStatusResult('Nomor surat tidak ditemukan. Silakan cek kembali data yang dimasukkan.', 'error');
    return;
  }
  showStatusResult(`Nomor ${found.request_code} berstatus: ${found.status}. Gampong: ${found.gampong}.`, 'success');
}

async function updateSubmissionStatus(id, status, button) {
  if (!id || button.disabled) return;
  if (!SUBMISSION_STATUSES.includes(status)) {
    showStatusResult('Pilih status surat yang tersedia.', 'error');
    return;
  }

  const submission = state.documents.find((document) => document.id === id);
  if (!submission) {
    showStatusResult('Pengajuan tidak ditemukan. Muat ulang daftar pengajuan.', 'error');
    return;
  }

  const previousStatus = submission.status;
  if (status === previousStatus) {
    showStatusResult(`Status ${submission.request_code} tidak berubah.`, 'info');
    return;
  }

  const select = button.closest('tr').querySelector('.status-select');
  button.disabled = true;
  select.disabled = true;
  button.textContent = 'Menyimpan...';

  try {
    const query = new URLSearchParams({ id: `eq.${id}`, status: `eq.${previousStatus}` });
    const { response, payload } = await requestSupabase(`/rest/v1/submissions?${query}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status })
    });

    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(formatSupabaseError(response, payload));
    }
    if (!payload.length) {
      throw new Error('Status tidak berubah. Data mungkin sudah diperbarui admin lain; muat ulang pengajuan dan coba lagi.');
    }

    state.documents = state.documents.map((document) => (
      document.id === id ? { ...document, status: payload[0].status } : document
    ));
    renderDashboard();
    showStatusResult(`Status ${payload[0].request_code} diubah menjadi ${payload[0].status}. Riwayat ekstensi akan diperbarui otomatis.`, 'success');
    submissionLoadMessage.textContent = 'Status pengajuan telah diperbarui di Supabase.';
    submissionLoadMessage.className = 'result-box success';
  } catch (error) {
    showStatusResult(error.message || 'Status pengajuan tidak dapat diperbarui.', 'error');
    console.error('Gagal mengubah status pengajuan SI-JUANG.', error);
    button.disabled = false;
    select.disabled = false;
    select.value = previousStatus;
    button.textContent = 'Simpan';
  }
}

function selectWhatsAppSubmission() {
  const submission = state.documents.find((document) => document.id === waSubmission.value);
  if (!submission) return;
  waDocCode.value = submission.request_code;
  waDriveLink.value = submission.drive_url;
  refreshWhatsAppMessage();
}

function matchWhatsAppSubmissionByCode() {
  const code = waDocCode.value.trim().toLowerCase();
  const submission = state.documents.find((document) => document.request_code.toLowerCase() === code);
  const previousSubmission = state.documents.find((document) => document.id === waSubmission.value);

  if (submission) {
    waSubmission.value = submission.id;
    waDriveLink.value = submission.drive_url;
  } else {
    waSubmission.value = '';
    if (previousSubmission && waDriveLink.value === previousSubmission.drive_url) {
      waDriveLink.value = '';
    }
  }
}

function buildWhatsAppMessage() {
  const recipient = document.getElementById('waRecipient').value.trim() || 'Bapak/Ibu';
  const code = waDocCode.value.trim();
  const driveLink = getDriveUrl(waDriveLink.value.trim());
  return [
    `Yth. ${recipient},`,
    '',
    'Bersama pesan ini kami sampaikan berkas administrasi SI-JUANG yang telah diproses.',
    'Silakan periksa berkas melalui tautan Google Drive berikut. Jika ada koreksi, mohon balas pesan ini:',
    driveLink,
    '',
    'Terima kasih.',
    ...(code ? ['', `Kode referensi: ${code}`] : [])
  ].join('\n');
}

function refreshWhatsAppMessage() {
  waMessage.value = buildWhatsAppMessage();
}

function handleWhatsAppSubmit(event) {
  event.preventDefault();
  const rawPhone = document.getElementById('waPhone').value.trim();
  const phone = rawPhone.replace(/[^\d]/g, '');
  const result = document.getElementById('waResult');

  if (!phone || phone.length < 8 || phone.length > 15) {
    result.textContent = 'Masukkan nomor WhatsApp dengan kode negara, misalnya 6281234567890.';
    result.className = 'result-box error';
    return;
  }
  const driveLink = getDriveUrl(waDriveLink.value.trim());
  if (!driveLink) {
    result.textContent = 'Pilih pengajuan atau masukkan tautan Google Drive yang valid. Tautan tersebut akan disertakan dalam pesan WhatsApp.';
    result.className = 'result-box error';
    return;
  }

  waDriveLink.value = driveLink;
  const text = waMessage.value.trim();
  const requiredMessageLines = [
    ...(!text.includes(driveLink) ? ['Tautan berkas Google Drive:', driveLink] : []),
    ...(waDocCode.value.trim() && !text.includes(`Kode referensi: ${waDocCode.value.trim()}`)
      ? [`Kode referensi: ${waDocCode.value.trim()}`]
      : [])
  ];
  if (requiredMessageLines.length) {
    waMessage.value = `${text}\n\n${requiredMessageLines.join('\n')}`.trim();
  }
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage.value)}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  result.textContent = `WhatsApp Web dibuka untuk ${phone}. Tautan Google Drive sudah disertakan dalam pesan. Pastikan penerima memiliki izin akses sebelum mengirim.`;
  result.className = 'result-box success';
}

let dashboardInitialized = false;

function initializeDashboard() {
  if (dashboardInitialized) return;
  dashboardInitialized = true;

  statusForm.addEventListener('submit', handleStatusCheck);
  document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });
  refreshSubmissionsButton.addEventListener('click', loadSubmissions);
  whatsappForm.addEventListener('submit', handleWhatsAppSubmit);
  waSubmission.addEventListener('change', selectWhatsAppSubmission);
  waDriveLink.addEventListener('input', refreshWhatsAppMessage);
  waDocCode.addEventListener('input', () => {
    matchWhatsAppSubmissionByCode();
    refreshWhatsAppMessage();
  });
  document.getElementById('waRecipient').addEventListener('input', refreshWhatsAppMessage);
  tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="update-status"]');
    if (button) {
      const select = button.closest('tr').querySelector('.status-select');
      updateSubmissionStatus(button.dataset.id, select.value, button);
    }
  });

  refreshWhatsAppMessage();
  showView('dashboard');
  showStatusResult('Silakan masukkan nomor surat untuk mengecek status.', 'info');
  loadSubmissions();
}

document.addEventListener('sijuang:authenticated', initializeDashboard);
