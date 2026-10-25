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

Dashboard masih prototipe frontend. Data contoh dan data yang dimasukkan dari browser disimpan di `localStorage` browser tersebut, bukan di database bersama. Karena itu, data belum otomatis terlihat di komputer admin lain dan belum boleh dipakai sebagai catatan resmi.
Ekstensi operator memakai Supabase Auth dan RPC `submit_document`; jalankan `supabase/operator-submissions.sql` sebelum menguji pengiriman. Dashboard admin saat ini belum membaca tabel `submissions`.

Alur yang direncanakan:

1. Operator menyimpan berkas di Google Drive operator sendiri.
2. Operator mengatur akses tautan Drive agar admin dapat membuka/unduh, lalu mengirim tautan dan metadata.
3. Admin memproses berkas, kemudian memilih nomor tujuan dan berkas unduhan pada menu WhatsApp.
4. Halaman membuka WhatsApp Web dengan teks yang sudah disiapkan dan kode referensi di baris terakhir. Admin tetap melampirkan berkas di WhatsApp Web sebelum menekan Kirim.

Data surat masih berupa prototipe lokal di browser; database, sinkronisasi statistik, serta pengiriman dari ekstensi belum aktif. Jangan memasukkan data pribadi atau dokumen resmi ke prototipe ini.

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

SQL memberi user hak baca hanya untuk profil miliknya sendiri; pembuatan/perubahan role tidak diizinkan dari browser. Data aplikasi yang sungguhan tetap perlu tabel dan RLS sendiri sebelum digunakan.

## Deploy dashboard ke Vercel

1. Hubungkan repository ini ke Vercel.
2. Pilih framework **Other** dan root directory repository.
3. Karena ini situs statis tanpa proses build, biarkan Build Command dan Output Directory kosong/default.
4. Deploy.

Folder ekstensi bukan bagian dari situs dashboard yang disajikan Vercel. Setelah backend tersedia, ekstensi dapat dimuat di Chrome melalui `chrome://extensions` → **Developer mode** → **Load unpacked** → pilih folder `extension`.

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
6. Login dengan akun operator, isi formulir, dan pastikan pemilik Drive membagikan berkas ke admin kecamatan. Extension hanya menyimpan tautan, bukan mengunggah file.
7. Ekstensi menampilkan 10 pengajuan terakhir dari akun operator yang sedang masuk. Riwayat memerlukan tabel `submissions` dan policy operator pada SQL migrasi.
8. Jika daftar jenis surat atau aturan database berubah, jalankan ulang SQL yang sudah diperbarui di `supabase/operator-submissions.sql`, lalu muat ulang ekstensi melalui `chrome://extensions` → **Reload**. Jika pengiriman gagal, ekstensi menampilkan pesan database beserta kode error untuk membantu diagnosis.

Manifest meminta permission `storage` untuk menyimpan token login sementara pada `chrome.storage.session`. Host permission dibatasi ke satu project Supabase untuk autentikasi dan pengiriman metadata. Tidak ada script/CDN/remote executable code.

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

Catatan listing: single purpose adalah pengajuan berkas administrasi gampong melalui tautan Google Drive. Jelaskan bahwa extension memproses email login, nama gampong, nama pemohon, jenis surat, keterangan opsional, dan tautan Drive; data dikirim ke project Supabase SI-JUANG. Pilih deklarasi **remote code: No**. Host permission Supabase diperlukan untuk login dan mengirim metadata; `storage` diperlukan untuk sesi login. Cantumkan alamat dukungan resmi dan URL kebijakan privasi publik sebelum submit.
