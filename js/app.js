const initialDocuments = [
  { id: 1, noSurat: 'SJ-2026-000101', tgl: '05 Aug 2026', gampong: 'Cot Gapu', tipe: 'SKU', status: 'Verifikasi', linkDrive: 'https://drive.google.com/' },
  { id: 2, noSurat: 'SJ-2026-000102', tgl: '06 Aug 2026', gampong: 'Geudong-geudong', tipe: 'Surat Pengantar Nikah', status: 'Srikandi', linkDrive: 'https://drive.google.com/' },
  { id: 3, noSurat: 'SJ-2026-000103', tgl: '08 Aug 2026', gampong: 'Buket Teukueh', tipe: 'Surat Rekomendasi', status: 'Selesai TTE', linkDrive: 'https://drive.google.com/' },
  { id: 4, noSurat: 'SJ-2026-000104', tgl: '09 Aug 2026', gampong: 'Pulo Kiton', tipe: 'Surat Keterangan Domisili', status: 'Ditolak', linkDrive: 'https://drive.google.com/' }
];

const STORAGE_KEY = 'sijuang-dashboard-documents-v1';
const state = { documents: loadDocuments() };

const statsGrid = document.getElementById('statsGrid');
const tableBody = document.getElementById('tableBody');
const statusForm = document.getElementById('statusForm');
const nomorSuratInput = document.getElementById('nomorSurat');
const statusResult = document.getElementById('statusResult');
const addSampleDocBtn = document.getElementById('addSampleDoc');
const cancelLastDocBtn = document.getElementById('cancelLastDoc');
const documentForm = document.getElementById('documentForm');
const whatsappForm = document.getElementById('whatsappForm');
const waMessage = document.getElementById('waMessage');
const waDocCode = document.getElementById('waDocCode');
const waFile = document.getElementById('waFile');
const leaderboardBody = document.getElementById('leaderboardBody');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');

const views = {
  dashboard: {
    title: 'Dashboard Analitik',
    subtitle: 'Ringkasan statistik dan pencarian status surat.'
  },
  pelayanan: {
    title: 'Pelayanan & Surat',
    subtitle: 'Catat pengajuan, lihat tautan Drive, dan siapkan pesan WhatsApp.'
  },
  operator: {
    title: 'Manajemen Akun Kecamatan',
    subtitle: 'Pengelolaan akun staf kecamatan akan tersedia setelah backend aktif.'
  },
  leaderboard: {
    title: 'Leaderboard Pengajuan',
    subtitle: 'Ringkasan jumlah pengajuan per gampong dari data browser ini.'
  }
};

function loadDocuments() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [...initialDocuments];
    const documents = JSON.parse(saved);
    return Array.isArray(documents) ? documents : [...initialDocuments];
  } catch (error) {
    console.error('Tidak dapat membaca data dokumen tersimpan.', error);
    return [...initialDocuments];
  }
}

function saveDocuments() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.documents));
  } catch (error) {
    showStatusResult('Data berubah di halaman ini, tetapi tidak dapat disimpan di browser.', 'error');
    console.error('Tidak dapat menyimpan data dokumen.', error);
  }
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
  return [
    { label: 'Total Dokumen', value: state.documents.length, trend: 'Data pada browser ini' },
    { label: 'Menunggu Verifikasi', value: state.documents.filter((doc) => doc.status === 'Verifikasi').length, trend: 'Butuh review', variant: 'warning' },
    { label: 'Selesai', value: state.documents.filter((doc) => doc.status === 'Selesai TTE').length, trend: 'Dokumen valid', variant: 'success' },
    { label: 'Ditolak', value: state.documents.filter((doc) => doc.status === 'Ditolak').length, trend: 'Perlu revisi', variant: 'danger' }
  ];
}

function renderStats() {
  statsGrid.innerHTML = computeStats().map((item) => `
    <div class="stat-card ${item.variant || ''}">
      <div class="stat-label">${escapeHtml(item.label)}</div>
      <div class="stat-value">${item.value}</div>
      <div class="stat-trend">${escapeHtml(item.trend)}</div>
    </div>
  `).join('');
}

function renderTable() {
  tableBody.innerHTML = state.documents.map((doc) => {
    const safeLink = getDriveUrl(doc.linkDrive);
    const driveCell = safeLink
      ? `<a class="link-btn" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">Buka Drive</a>`
      : '<span class="muted">Tautan tidak valid</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(doc.noSurat)}</strong></td>
        <td>${escapeHtml(doc.tgl)}</td>
        <td>${escapeHtml(doc.gampong)}</td>
        <td>${escapeHtml(doc.tipe)}</td>
        <td>${driveCell}</td>
        <td><span class="status-pill ${getStatusClass(doc.status)}">${escapeHtml(doc.status)}</span></td>
        <td><button class="danger-btn" type="button" data-action="cancel" data-id="${Number(doc.id)}">Batalkan</button></td>
      </tr>
    `;
  }).join('');
}

function renderLeaderboard() {
  const counts = new Map();
  state.documents.forEach((doc) => {
    if (doc.status === 'Batal') return;
    counts.set(doc.gampong, (counts.get(doc.gampong) || 0) + 1);
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
    : '<tr><td colspan="3" class="muted">Belum ada pengajuan.</td></tr>';
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

function getDriveUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) return '';
    return url.href;
  } catch {
    return '';
  }
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

  const found = state.documents.find((doc) => doc.noSurat.toLowerCase() === query.toLowerCase());
  if (!found) {
    showStatusResult('Nomor surat tidak ditemukan. Silakan cek kembali data yang dimasukkan.', 'error');
    return;
  }
  showStatusResult(`Nomor ${found.noSurat} berstatus: ${found.status}. Gampong: ${found.gampong}.`, 'success');
}

function refreshDocuments() {
  saveDocuments();
  renderStats();
  renderTable();
  renderLeaderboard();
}

function createReferenceCode() {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const randomPart = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
  return `SJ-${datePart}-${randomPart}`;
}

function buildWhatsAppMessage() {
  const recipient = document.getElementById('waRecipient').value.trim() || 'Bapak/Ibu';
  const code = waDocCode.value.trim();
  return [
    `Yth. ${recipient},`,
    '',
    'Bersama pesan ini kami sampaikan berkas administrasi SI-JUANG yang telah diproses.',
    'Mohon berkenan memeriksa berkas terlampir. Jika ada koreksi, silakan membalas pesan ini.',
    '',
    'Terima kasih.',
    '',
    `Kode referensi: ${code}`
  ].join('\n');
}

function refreshWhatsAppMessage() {
  const message = buildWhatsAppMessage();
  waMessage.value = message;
}

function handleDocumentSubmit(event) {
  event.preventDefault();
  const noSurat = document.getElementById('docNo').value.trim();
  const gampong = document.getElementById('docGampong').value.trim();
  const tipe = document.getElementById('docType').value.trim();
  const linkDrive = getDriveUrl(document.getElementById('docDriveLink').value.trim());

  if (!linkDrive) {
    showStatusResult('Masukkan tautan berbagi Google Drive yang valid (https://drive.google.com atau https://docs.google.com).', 'error');
    return;
  }
  if (state.documents.some((doc) => doc.noSurat.toLowerCase() === noSurat.toLowerCase())) {
    showStatusResult('Nomor surat tersebut sudah tercatat.', 'error');
    return;
  }

  const nextId = state.documents.reduce((highest, doc) => Math.max(highest, Number(doc.id) || 0), 0) + 1;
  state.documents.unshift({
    id: nextId,
    noSurat,
    tgl: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    gampong,
    tipe,
    status: 'Verifikasi',
    linkDrive
  });
  refreshDocuments();
  showStatusResult(`Pengajuan ${noSurat} dicatat pada browser ini. Pastikan akses tautan Drive diberikan kepada admin.`, 'success');
  documentForm.reset();
}

function addSampleDocument() {
  const code = createReferenceCode();
  const nextId = state.documents.reduce((highest, doc) => Math.max(highest, Number(doc.id) || 0), 0) + 1;
  state.documents.unshift({
    id: nextId,
    noSurat: code,
    tgl: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    gampong: 'Cot Gapu',
    tipe: 'SKU',
    status: 'Verifikasi',
    linkDrive: 'https://drive.google.com/'
  });
  refreshDocuments();
  showStatusResult(`Data contoh ${code} ditambahkan pada browser ini.`, 'success');
}

function cancelDocument(docId) {
  const before = state.documents.length;
  state.documents = state.documents.filter((doc) => doc.id !== Number(docId));
  if (state.documents.length === before) return;
  refreshDocuments();
  showStatusResult('Pengajuan dibatalkan dan dikeluarkan dari statistik pada browser ini.', 'info');
}

function handleWhatsAppSubmit(event) {
  event.preventDefault();
  const rawPhone = document.getElementById('waPhone').value.trim();
  const phone = rawPhone.replace(/[^\d]/g, '');
  const file = waFile.files[0];

  if (!phone || phone.length < 8 || phone.length > 15) {
    document.getElementById('waResult').textContent = 'Masukkan nomor WhatsApp dengan kode negara, misalnya 6281234567890.';
    document.getElementById('waResult').className = 'result-box error';
    return;
  }
  if (!waDocCode.value.trim()) {
    waDocCode.value = createReferenceCode();
    refreshWhatsAppMessage();
  }
  if (!file) {
    document.getElementById('waResult').textContent = 'Pilih berkas yang sudah diunduh. Anda tetap perlu melampirkannya secara manual setelah WhatsApp Web terbuka.';
    document.getElementById('waResult').className = 'result-box error';
    return;
  }

  const text = waMessage.value.trim();
  if (!text.endsWith(`Kode referensi: ${waDocCode.value.trim()}`)) {
    waMessage.value = `${text.replace(/\n*Kode referensi:.*$/s, '').trim()}\n\nKode referensi: ${waDocCode.value.trim()}`;
  }
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage.value)}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  const result = document.getElementById('waResult');
  result.textContent = `WhatsApp Web dibuka untuk ${phone}. Tambahkan "${file.name}" sebagai lampiran lalu tekan Kirim. Kode referensi ada di baris terakhir pesan.`;
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
  documentForm.addEventListener('submit', handleDocumentSubmit);
  whatsappForm.addEventListener('submit', handleWhatsAppSubmit);
  addSampleDocBtn.addEventListener('click', addSampleDocument);
  cancelLastDocBtn.addEventListener('click', () => {
    if (!state.documents.length) {
      showStatusResult('Belum ada data yang bisa dibatalkan.', 'error');
      return;
    }
    cancelDocument(state.documents[0].id);
  });
  waFile.addEventListener('change', () => {
    document.getElementById('waFileName').textContent = waFile.files[0]
      ? `Berkas dipilih: ${waFile.files[0].name}. WhatsApp Web tidak dapat menerima lampiran otomatis dari halaman ini.`
      : 'Berkas belum dipilih. Lampirkan berkas lagi di WhatsApp Web.';
  });
  document.getElementById('waRecipient').addEventListener('input', refreshWhatsAppMessage);
  waDocCode.addEventListener('input', refreshWhatsAppMessage);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="cancel"]');
    if (button) cancelDocument(button.dataset.id);
  });

  waDocCode.value = createReferenceCode();
  refreshWhatsAppMessage();
  renderStats();
  renderTable();
  renderLeaderboard();
  showView('dashboard');
  showStatusResult('Silakan masukkan nomor surat untuk mengecek status.', 'info');
}

document.addEventListener('sijuang:authenticated', initializeDashboard);
