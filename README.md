# SI-JUANG

Proyek ini berisi prototipe dashboard SI-JUANG dan folder ekstensi Chrome operator.

## Struktur

- `index.html` — halaman dashboard.
- `css/styles.css` — tampilan dashboard.
- `js/app.js` — interaksi prototipe.
- `assets/` — aset web.
- `extension/` — ekstensi Chrome operator.

Web dashboard ditujukan untuk staf kecamatan. Operator gampong hanya menggunakan ekstensi browser untuk mengajukan berkas; pemilih peran Admin/Operator/Publik tidak ditampilkan di web. Dashboard muncul setelah Supabase Auth memverifikasi akun terhadap `public.profiles`. Menu Dashboard, Pelayanan & Surat, Manajemen Operator, dan Leaderboard berpindah antar tampilan di halaman yang sama.

## Status saat ini

Dashboard masih prototipe frontend. Data contoh dan data yang dimasukkan dari browser disimpan di `localStorage` browser tersebut, bukan di database bersama. Karena itu, data belum otomatis terlihat di komputer admin lain dan belum boleh dipakai sebagai catatan resmi.

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
