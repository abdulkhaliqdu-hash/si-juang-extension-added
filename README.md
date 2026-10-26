# SI-JUANG

Proyek ini berisi prototipe dashboard SI-JUANG dan folder ekstensi Chrome operator.

## Struktur

- `index.html` — halaman dashboard.
- `css/styles.css` — tampilan dashboard.
- `js/app.js` — interaksi prototipe.
- `assets/` — aset web.
- `assets/sijuang-logo.png` — logo resmi SI-JUANG; ikon browser dibuat dari simbol pada logo ini.
- `extension/` — ekstensi Chrome operator.

Web dashboard ditujukan untuk staf kecamatan. Operator gampong hanya menggunakan ekstensi browser untuk mengajukan berkas; pemilih peran Admin/Operator/Publik tidak ditampilkan di web. Dashboard muncul setelah Supabase Auth memverifikasi akun terhadap `public.profiles`. Menu Dashboard, Pelayanan & Surat, Manajemen Operator, dan Leaderboard berpindah antar tampilan di halaman yang sama.

## Status saat ini

Dashboard admin membaca pengajuan dan statistik dari tabel Supabase `submissions` menggunakan akun `kecamatan_admin`. Admin dapat mengubah status pengajuan (Verifikasi, Srikandi, Selesai TTE, Ditolak, atau Batal) dari kolom **Ubah status**; perubahan langsung disimpan ke database. Leaderboard hanya menghitung naskah berstatus **Selesai TTE**. Riwayat ekstensi memuat status terbaru saat dibuka dan diperbarui otomatis setiap 30 detik selama popup terbuka. Ekstensi operator memakai Supabase Auth dan RPC `submit_document`; jalankan `supabase/operator-submissions.sql` sebelum menggunakan alur pengajuan.

Alur yang direncanakan:

1. Operator menyimpan berkas di Google Drive operator sendiri.
2. Operator mengatur akses tautan Drive agar admin dapat membuka/unduh, lalu mengirim tautan dan metadata.
3. Admin memproses berkas, lalu memilih pengajuan serta memasukkan nomor tujuan pada menu WhatsApp. Tautan Google Drive pengajuan otomatis dimasukkan ke pesan.
4. Halaman membuka WhatsApp Web dengan teks dan tautan Drive yang sudah disiapkan. Penerima harus memiliki izin membuka tautan; website tidak dapat melampirkan file lokal secara otomatis melalui link WhatsApp.

Data contoh lokal sebelumnya tidak ditampilkan pada dashboard tersambung. Jika Supabase gagal dibaca, dashboard menampilkan pesan error dan tidak mengganti kegagalan dengan angka contoh. Jangan memasukkan data pribadi atau dokumen resmi sebelum kebijakan akses, berbagi Drive, dan retensi disetujui oleh instansi.

## Menyiapkan login admin Supabase

1. Di Supabase, buka **Authentication → Users** dan buat user staf kecamatan. Jangan aktifkan pendaftaran publik.
2. Buka **SQL Editor**, jalankan isi `supabase/admin-access.sql`.
3. Di daftar Authentication Users, salin UUID user staf kecamatan yang dibuat.
4. Di SQL Editor, jalankan perintah berikut dengan UUID user tersebut:

   ```sql
   insert into public.profiles (id, role)
   values ('GANTI_DENGAN_UUID_USER', 'kecamatan_admin');
   ```

5. Buka **Project Settings → API Keys** dan salin Project URL serta publishable key (atau anon key lama).
6. Isi nilai `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` di `config.js`. Publishable key memang dipakai di browser; jangan pernah memakai service-role/secret key di sini.
7. Deploy ulang di Vercel. Login hanya menampilkan dashboard untuk user yang memiliki profil `kecamatan_admin`.

## Membuat akun awal operator dan kecamatan

`scripts/create-initial-accounts.mjs` menyiapkan 23 akun operator (satu per gampong yang terdaftar) dan akun `kec_kotajuang@bireuenkab.go.id`. Nama gampong di alamat email ditulis huruf kecil tanpa spasi atau tanda baca, misalnya `bandarbireuen@bireuenkab.go.id`. Script membuat profil `operator` beserta gampongnya; akun kecamatan mendapat role `kecamatan_admin` dan gampong kosong. Akun yang sudah ada tidak dihapus atau diubah kata sandinya, dan profil dengan role/gampong berbeda dibiarkan apa adanya serta dilaporkan untuk diperiksa.

Pastikan `supabase/operator-submissions.sql` sudah berhasil dijalankan. Di PowerShell pada folder proyek, minta admin Supabase menjalankan:

```powershell
$secureKey = Read-Host "Legacy service_role key Supabase" -AsSecureString
$env:SUPABASE_SERVICE_ROLE_KEY = [System.Net.NetworkCredential]::new("", $secureKey).Password
$securePassword = Read-Host "Password awal akun operator dan kecamatan" -AsSecureString
$env:SIJUANG_INITIAL_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
node .\scripts\create-initial-accounts.mjs --dry-run
node .\scripts\create-initial-accounts.mjs
Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY, Env:\SIJUANG_INITIAL_PASSWORD
```

Periksa daftar email pada langkah simulasi sebelum menjalankan tanpa `--dry-run`. Ambil JWT **legacy `service_role`** dari **Supabase → Project Settings → API Keys** (bukan publishable/anon key), lalu masukkan hanya pada prompt lokal; jangan kirim melalui chat, memasukkannya ke `config.js`, atau commit ke GitHub. Script menggunakan key itu hanya dari environment proses lokal untuk membuat pengguna Auth dan profil, tidak mencetak atau menyimpannya. Semua akun baru memakai password awal yang dimasukkan pada prompt; karena password awal sama untuk semua akun, bagikan secara pribadi kepada pemilik akun dan minta setiap operator serta staf kecamatan menggantinya sebelum mulai menggunakan akun.

SQL memberi user hak baca hanya untuk profil miliknya sendiri; pembuatan/perubahan role tidak diizinkan dari browser. Data aplikasi yang sungguhan tetap perlu tabel dan RLS sendiri sebelum digunakan.

## Deploy dashboard ke Vercel

1. Hubungkan repository ini ke Vercel.
2. Pilih framework **Other** dan root directory repository.
3. Karena ini situs statis tanpa proses build, biarkan Build Command dan Output Directory kosong/default.
4. Deploy.

Folder ekstensi bukan bagian dari situs dashboard yang disajikan Vercel. Ekstensi operator memakai panel Chrome di sisi kanan, bukan popup biasa. Ekstensi memerlukan Chrome versi 116 atau lebih baru. Setelah backend tersedia, ekstensi dapat dimuat di Chrome melalui `chrome://extensions` → **Developer mode** → **Load unpacked** → pilih folder `extension`. Setelah memperbarui source ekstensi, klik **Reload** pada kartu ekstensi di halaman tersebut.

## Langkah backend berikutnya

Backend direncanakan menggunakan Supabase untuk autentikasi dan penyimpanan metadata pengajuan. Berkas tetap berada di Google Drive operator; jangan menaruh service-role key atau kredensial rahasia di dashboard maupun ekstensi. Kebijakan akses database (RLS) dan otorisasi admin/operator harus dibuat sebelum data nyata digunakan.

## Menyiapkan ekstensi operator

1. Buka **Supabase → SQL Editor** dan jalankan seluruh isi `supabase/operator-submissions.sql`.
2. Untuk tiap operator, buka **Authentication → Users → Add user**. Buat user secara manual; jangan aktifkan pendaftaran publik.
3. Salin UID user tersebut. Di SQL Editor, buat profil operator dengan gampong yang sudah diverifikasi:

   ```sql
   insert into public.profiles (id, role, gampong)
   values ('GANTI_DENGAN_UID', 'operator', 'Cot Gapu');
   ```

4. Gunakan nilai project URL dan **publishable key** pada `extension/config.js`. Key publishable memang terlihat pada extension; jangan pernah menaruh `service_role`/secret key di extension.
5. Untuk uji lokal, buka `chrome://extensions`, aktifkan **Developer mode**, pilih **Load unpacked**, lalu pilih folder `extension`.
6. Agar pintasan ekstensi selalu terlihat di toolbar Chrome, klik ikon **Ekstensi** berbentuk puzzle di kanan atas, lalu klik ikon pin di samping **SI-JUANG Operator Gampong**. Chrome tidak mengizinkan ekstensi menyematkan dirinya sendiri; tindakan pin dilakukan pengguna melalui menu Chrome. Setelah dipin, klik ikonnya untuk membuka panel SI-JUANG di sisi kanan.
7. Login dengan akun operator, isi formulir, dan pastikan pemilik Drive membagikan berkas ke admin kecamatan. Extension hanya menyimpan tautan, bukan mengunggah file.
8. Ekstensi menampilkan 10 pengajuan terakhir dari akun operator yang sedang masuk. Status diperbarui saat popup dibuka dan otomatis setiap 30 detik selama popup tetap terbuka; tombol **Muat ulang** dapat digunakan untuk mengambil perubahan lebih cepat. Riwayat memerlukan tabel `submissions` dan policy operator pada SQL migrasi.
9. Jika daftar jenis surat atau aturan database berubah, jalankan ulang SQL yang sudah diperbarui di `supabase/operator-submissions.sql`, lalu muat ulang ekstensi melalui `chrome://extensions` → **Reload**. Jika pengiriman gagal, ekstensi menampilkan pesan database beserta kode error untuk membantu diagnosis.

Manifest meminta permission `storage` untuk menyimpan token login sementara pada `chrome.storage.session` dan `sidePanel` untuk menampilkan formulir pengajuan serta riwayat pada panel sisi kanan browser. Host permission dibatasi ke satu project Supabase untuk autentikasi dan pengiriman metadata. Tidak ada script/CDN/remote executable code.

Daftar gampong yang disetujui (23): Bandar Bireuen; Bireuen Meunasah Blang; Bireuen Meunasah Capa; Bireuen Meunasah Dayah; Bireuen Meunasah Reuleut; Bireuen Meunasah Teungku Digadong; Blang Reuling; Blang Tingkeum; Buket Teukueh; Cot Gapu; Cot Jrat; Cot Peutek; Gampong Baro; Geudong Alue; Geudong-Geudong; Geulanggang Baro; Geulanggang Gampong; Geulanggang Kulam; Geulanggang Teungoh; Lhok Awe Teungoh; Pulo Ara Geudong Teungoh; Pulo Kiton; Uteun Reutoh.

## Persiapan Chrome Web Store

Ekstensi Chrome adalah paket ZIP, bukan APK Android. Proyek ini menyiapkan source MV3 pada `extension/`; paket yang diunggah ke Chrome Web Store harus berisi `manifest.json` langsung di root ZIP. Uji login, kirim pengajuan, sesi habis, dan akses role sebelum rilis.

1. Buat ZIP dari **isi** folder `extension` (jangan ZIP folder induknya), misalnya:

   ```powershell
   Compress-Archive -Path D:\si-juang-dashboard\extension\* -DestinationPath D:\si-juang-operator-cws.zip -Force
   ```

2. Daftar di Chrome Web Store Developer Dashboard menggunakan akun Google penerbit dan selesaikan biaya pendaftaran satu kali yang diminta Google.
3. Unggah ZIP, isi nama, deskripsi, ikon/screenshot listing, kategori, negara distribusi, single-purpose, justifikasi permission `storage`, deklarasi data pengguna, dan tautan kebijakan privasi.
4. Kebijakan privasi publik ada pada `privacy.html`. Setelah dashboard dideploy, gunakan URL Vercel untuk halaman itu pada listing.
5. Submit untuk review Google. Penerbit harus mengisi deklarasi, memberi kontak dukungan yang benar, dan menunggu keputusan review; kelulusan/penerbitan tidak dapat dijamin dari sisi kode.

Catatan listing: single purpose adalah pengajuan berkas administrasi gampong melalui tautan Google Drive. Jelaskan bahwa extension memproses email login, nama gampong, nama pemohon, jenis surat, keterangan opsional, dan tautan Drive; data dikirim ke project Supabase SI-JUANG. Pilih deklarasi **remote code: No**. Host permission Supabase diperlukan untuk login dan mengirim metadata; `storage` diperlukan untuk sesi login; `sidePanel` menampilkan alur kerja operator di panel sisi kanan Chrome. Cantumkan alamat dukungan resmi dan URL kebijakan privasi publik sebelum submit.
