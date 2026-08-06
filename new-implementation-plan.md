# Implementation Plan — Pemisahan Entry Placement Test Online dan Offline

## Ringkasan Requirement

Placement test akan memiliki dua entry point dengan alur tes yang sama, tetapi sumber siswa yang disimpan berbeda:

| Entry point | Pengguna | Input cabang | Nilai `Sessions!H` (`branch`) |
|---|---|---|---|
| `index.html` | Siswa cabang offline | Wajib pilih kota dan cabang | Nama cabang yang dipilih, mis. `Bandung - Antapani` |
| `index-online.html` | Siswa online | Tidak memilih kota/cabang | `Online` |

Kedua entry point tetap melakukan routing berdasarkan usia ke file tes yang sama:

- usia 5–7 → `junior-final-placement-test.html`
- usia 8–15 → `kids-final-placement-test.html`
- usia 16–18 → `teens.html`

Dashboard hasil juga kembali menggunakan akses per cabang. Saat meminta akses, pengguna wajib memilih cabang serta role BM atau SA Kids. Request disimpan sebagai `pending`; HQ dapat approve/reject dalam masa review dua menit. Jika tidak ditolak, login pertama setelah dua menit mengaktifkan akses pada cell cabang yang sesuai di sheet `DROPDOWNS`, bukan menambahkan ke baris baru. Saat login, pengguna cukup memasukkan email; backend menentukan scope data dan profil kolomnya. User Online hanya melihat data Online dengan kolom lengkap, user cabang offline hanya melihat data cabangnya dengan restricted columns, sedangkan HQ melihat seluruh data dengan kolom lengkap.

## Kontrak Data Google Sheets

### Sheet `Sessions`

- Kolom H sudah merupakan field `branch` berdasarkan urutan `SESSION_HEADERS` di `Code.gs`.
- Registrasi dari `index-online.html` mengirim `student.branch: "Online"`, sehingga backend menyimpan `Online` ke `Sessions!H`.
- Registrasi dari `index.html` mengirim nama cabang offline yang dipilih, sehingga backend menyimpan nama tersebut ke `Sessions!H`.
- Tidak perlu menambah kolom baru atau membuat mekanisme penyimpanan terpisah.

### Sheet `DROPDOWNS`

| Kolom | Isi |
|---|---|
| A | Nama cabang; row 5 adalah `Online`, row 6 dan seterusnya cabang offline |
| B | Daftar Branch Manager untuk cabang pada baris yang sama |
| C | Daftar SA Kids untuk cabang pada baris yang sama |
| E | Daftar HQ/all-access yang dikelola manual |

Jika satu cabang memiliki lebih dari satu user dalam role yang sama, seluruh user disimpan dalam satu cell dengan pemisah koma:

```text
Yazid - yazid@kalananti.id, Laras Isti - laras.kalananti@kalananti.id, Lila - lilaatkalananti@gmail.com
```

Contoh: setelah request BM untuk `Bandung - Antapani` disetujui, proses approval harus mencari baris `Bandung - Antapani` di Kolom A, lalu append ke Kolom B pada baris tersebut. Approval berikutnya tidak boleh menulis ke baris kosong berikutnya.

## Perubahan yang Akan Diimplementasikan

### 1. `index-online.html` — entry point online baru

- Buat dari flow `index.html` saat ini yang hanya meminta nama, usia, dan email orang tua.
- Tidak menampilkan pilihan mode, kota, atau cabang.
- Tetapkan `student.branch = "Online"` sebelum membuat placement session dan memanggil `PlacementSync.register()`.
- Pertahankan consent, session isolation, sinkronisasi backend, dan routing Junior/Kids/Teens yang sekarang.
- Akses publik ditujukan melalui file `index-online.html`. Jika dibutuhkan clean URL seperti `/placement-test-online`, routing/redirect domain perlu dikonfigurasi terpisah dari perubahan file ini.

### 2. `index.html` — khusus entry point offline

- Aktifkan kembali input kota dan cabang yang saat ini masih di-comment.
- Hapus pilihan mode Online/Offline karena halaman ini selalu untuk offline.
- Ambil master cabang dari `DROPDOWNS!A6:A`; row 5 (`Online`) wajib diabaikan.
- Bentuk pilihan kota dari prefix nama cabang dan tampilkan cabang yang sesuai setelah kota dipilih.
- Kota dan cabang wajib dipilih sebelum pengguna lanjut ke consent.
- Simpan nama cabang lengkap yang dipilih ke `student.branch`.
- Jika fetch daftar cabang gagal, tampilkan error/retry atau gunakan fallback offline yang juga tidak mengandung `Online`; jangan menyimpan `-` sebagai branch.
- Pertahankan routing Junior/Kids/Teens yang sama dengan entry point online.

### 3. `Code.gs` — daftar cabang dan registrasi siswa

- Pertahankan `register_()` karena mapping `student.branch` ke header `branch` sudah otomatis menulis ke Kolom H.
- Pisahkan kontrak daftar cabang agar kebutuhan halaman offline tidak mengubah kebutuhan dashboard:
  - `get_branches` tetap mengembalikan seluruh cabang, termasuk `Online`, untuk dashboard.
  - tambahkan `get_offline_branches` atau parameter ekuivalen yang membaca mulai row 6 untuk `index.html`.
- Bersihkan nilai kosong/header dan lakukan deduplikasi sebelum mengirim daftar cabang.
- Jangan mengandalkan nomor row saja untuk penyimpanan akses; request dashboard tetap harus mencocokkan nama cabang pada Kolom A.

### 4. `hasil-placement-test-kalananti.html` — request akses dan login berbasis email

- Kembalikan searchable branch dropdown khusus pada flow “Minta Akses” dan muat datanya melalui `get_branches`; opsi `Online` tetap tersedia di sini. Dropdown cabang tidak ditampilkan pada form login.
- Saat membuka form “Minta Akses”, wajibkan:
  - cabang;
  - nama lengkap;
  - email;
  - role `BM` atau `SA Kids`.
- Kirim payload aktual `{ branch, name, email, role }`; hapus hardcode `branch: "All Access"`.
- Form login tetap hanya meminta email dan mengirim `{ email }`; pengguna tidak perlu memilih cabang saat login.
- Backend mencari email di mapping akses dan mengembalikan `authorizedBranch`, `dataScope`, serta `columnAccess`:
  - email yang terdaftar pada row `Online` → scope branch `Online`, kolom `full`;
  - email yang terdaftar pada row cabang offline → scope branch tersebut, kolom `restricted`;
  - email HQ di Kolom E → scope `all`, kolom `full`.
- Simpan hasil autentikasi tersebut di session dashboard lalu tampilkan role/scope yang sesuai sebagai badge.
- Untuk user Online, tampilkan full columns tetapi hanya record dengan `Sessions.branch === "Online"`.
- Untuk HQ, tampilkan seluruh data dari Online dan semua cabang offline dengan full columns serta dashboard analitik HQ.
- Untuk user cabang offline, jangan tampilkan form pencarian nama/email sebagai gate. Setelah login, langsung muat seluruh siswa dengan `Sessions.branch` yang sama dengan cabang user.
- Tabel user cabang offline hanya menampilkan restricted columns yang sudah ditetapkan pada UI saat ini.

### 5. `Code.gs` — akses dashboard branch-scoped

- Ubah `requestDashboardAccess_()` agar:
  1. memvalidasi branch, nama, email, dan role;
  2. mencari exact normalized match branch di `DROPDOWNS!A5:A`;
  3. menolak branch/role yang tidak valid;
  4. membuat atau memperbarui record `AccessRequests` berstatus `pending` tanpa langsung memberikan akses.
- Tambahkan proses approval/rejection HQ serta aktivasi otomatis setelah masa review dua menit yang:
  1. memilih Kolom B untuk BM atau Kolom C untuk SA Kids;
  2. membaca seluruh entry dari cell target menggunakan parser comma/newline;
  3. melakukan deduplikasi email secara case-insensitive;
  4. menulis ulang cell yang sama dengan format comma-separated;
  5. mengubah audit request menjadi `approved` dan baru menjalankan pemberian akses folder sesuai scope branch.
- Ubah `loginDashboard_()` agar login hanya membutuhkan email, lalu mencari email tersebut pada mapping akses `DROPDOWNS` dan menentukan branch dari Kolom A pada baris yang cocok.
- Jika email ditemukan pada row `Online`, buat dashboard session dengan `authorizedBranch: "Online"`, `dataScope: "branch"`, dan `columnAccess: "full"`.
- Jika email ditemukan pada row cabang offline, buat dashboard session dengan nama cabang dari Kolom A, `dataScope: "branch"`, dan `columnAccess: "restricted"`.
- Jika email ditemukan di Kolom E, buat dashboard session HQ dengan `dataScope: "all"` dan `columnAccess: "full"`. Data HQ di Kolom E tetap dikelola manual dan tidak dapat dibuat melalui form request publik.
- Pisahkan `dataScope` dari `columnAccess`; user Online memiliki full columns tetapi bukan all-branch access.
- Jika satu email terdaftar pada lebih dari satu cabang offline, jangan diam-diam mengambil match pertama. Tolak login dengan pesan konfigurasi ambigu agar data cabang tidak salah terbuka.
- Ubah `requireDashboardSession_()`, `getBranchResults_()`, dan `updateEmailStatus_()` agar:
  - HQ mendapatkan seluruh record;
  - Online hanya mendapatkan record dengan `Sessions.branch === "Online"`;
  - user cabang offline mendapatkan seluruh record dengan `Sessions.branch === authorizedBranch` tanpa harus mencari nama siswa terlebih dahulu;
  - token cabang tidak dapat membaca atau mengubah submission cabang lain.
- `searchRestrictedResults_()` tidak lagi menjadi gate akses user cabang. Endpoint dapat dihapus dari flow UI atau dipertahankan hanya sebagai pencarian/filter tambahan di dalam dataset cabang yang sudah difilter server-side.
- Update `onEdit()` agar perubahan manual pada `DROPDOWNS!B:C` tetap memproses semua email comma-separated untuk pemberian akses folder. Monitoring kolom HQ dipertahankan sesuai konfigurasi existing.

### 6. Dokumentasi

- Update `README.md` untuk mencantumkan `index-online.html` dan fungsi masing-masing entry point.
- Sinkronkan bagian arsitektur dashboard di `PRD-placement-test.md` apabila implementasi akhir berbeda dari kontrak yang sudah tertulis.
- Catat bahwa perubahan `Code.gs` memerlukan deployment ulang Google Apps Script Web App.

### 7. Dashboard HQ

- User HQ tetap didaftarkan secara manual di `DROPDOWNS!E:E`; form request publik tidak boleh menambahkan atau mengubah akses HQ.
- Sediakan filter global berdasarkan rentang tanggal, audience, mode Online/Offline, cabang, dan status penyelesaian.
- Tampilkan KPI:
  - total placement test;
  - jumlah dan persentase selesai;
  - jumlah dan persentase belum selesai;
  - jumlah stalled/tidak aktif lebih dari batas waktu yang ditetapkan;
  - jumlah cabang aktif;
  - jumlah peserta Online dibanding Offline;
  - pelaksanaan hari ini, minggu ini, dan bulan ini.
- Tampilkan funnel `Registrasi → Stage 1 → Stage 2 → Stage 3 → Final` beserta jumlah, persentase, dan drop-off per tahap.
- Tampilkan Top 3 cabang berdasarkan jumlah pelaksanaan, jumlah selesai, dan completion rate.
- Tambahkan tab rekap per cabang yang memuat total registrasi, progres tiap stage, final selesai, belum selesai, stalled, completion rate, aktivitas terakhir, dan aksi melihat detail cabang.
- Pertahankan tab semua hasil dengan full columns serta filter nama/email, cabang, mode, audience, status, module, level, PDF, email, dan tanggal.
- Tambahkan operational alerts untuk sync gagal, peserta stalled, final tanpa PDF, serta email belum/gagal dikirim.
- Endpoint overview HQ mengembalikan agregat server-side. Raw records hanya dimuat saat tab detail dibuka dan menggunakan pagination agar seluruh database tidak dikirim untuk menampilkan KPI.

### 8. Keamanan Data dan Autentikasi

- Filtering dan authorization wajib dilakukan di `Code.gs`, bukan hanya menyembunyikan row/column melalui JavaScript frontend.
- Setiap endpoint data harus memvalidasi token lalu menerapkan dua dimensi izin secara terpisah:
  - `dataScope`: `all` untuk HQ atau `branch` untuk Online/offline;
  - `columnAccess`: `full` untuk HQ/Online atau `restricted` untuk cabang offline.
- Response untuk cabang offline dibentuk menggunakan explicit field allowlist. Field full tidak boleh ikut dikirim lalu sekadar disembunyikan di UI.
- Gunakan alur login email tanpa email keluar:
  1. request akses disimpan sebagai `pending`;
  2. selama dua menit pertama backend menolak login dengan pesan sedang ditinjau HQ tanpa countdown di frontend;
  3. HQ dapat approve/reject selama masa review;
  4. jika tidak ditolak, login pertama setelah dua menit mengaktifkan request pada branch+role terkait;
  5. backend menerbitkan opaque session token dengan expiry 24 jam dan hanya menyimpan hash token.
- Request akses publik hanya membuat record `AccessRequests` berstatus `pending`. Email baru ditambahkan ke `DROPDOWNS!B:C` setelah approval HQ atau aktivasi otomatis pada login pertama setelah masa review dua menit; Kolom E selalu manual-only.
- Terapkan rate limit untuk request akses dan login gagal.
- Simpan audit log untuk request, approval, login, logout, akses data, perubahan status email, dan kegagalan authorization.
- Gunakan request `POST` untuk token dan operasi sensitif; jangan menaruh session token pada query string/URL.
- Jangan memberi BM/SA akses ke root folder PDF seluruh placement test. Gunakan folder terpisah untuk Online dan setiap cabang, dengan HQ mendapat akses seluruh folder dan user branch hanya mendapat akses folder branch-nya.
- Saat membuat PDF, tentukan folder tujuan dari branch yang sudah tersimpan di server, bukan dari branch bebas yang dikirim ulang oleh browser.
- Semua endpoint perubahan data, termasuk update status email, wajib memeriksa bahwa submission berada dalam `dataScope` token sebelum melakukan perubahan.

## Delivery Plan per Phase

Implementasi tidak dirilis sekaligus. Setiap phase memiliki deployment, acceptance test, dan rollback point sendiri. Phase berikutnya baru dimulai setelah exit criteria phase sebelumnya terpenuhi.

### Phase 1 — Pemisahan Entry Point dan Pencatatan Asal Siswa

**Tujuan:** memastikan seluruh registrasi baru memiliki branch yang benar tanpa mengubah akses dashboard production terlebih dahulu.

- Buat `index-online.html` dari flow registrasi sekarang dan selalu kirim `student.branch: "Online"`.
- Jadikan `index.html` khusus offline, aktifkan input kota/cabang, dan wajibkan pemilihan cabang.
- Tambahkan endpoint offline-only yang membaca `DROPDOWNS!A6:A`; pertahankan endpoint daftar seluruh cabang untuk dashboard.
- Pastikan `register_()` menulis branch ke `Sessions!H` dan seluruh Junior/Kids/Teens mempertahankan branch sampai finalize.
- Deploy perubahan backend secara backward-compatible sebelum mempublikasikan kedua entry point.
- Jangan menebak branch untuk historical record yang saat ini bernilai kosong atau `-`; tandai sebagai `Legacy/Unknown` untuk kebutuhan audit HQ sampai ada keputusan migrasi data.
- Selama Phase 1, dashboard dan mekanisme auth production existing tetap digunakan.

**Exit criteria:** Online selalu tersimpan sebagai `Online`, offline selalu tersimpan sebagai nama cabang valid, routing seluruh kelompok usia lolos, dan tidak ada regression pada consent/sync/finalize.

### Phase 2 — Auth, Authorization, dan Isolasi Data/PDF

**Tujuan:** dashboard baru aman digunakan oleh HQ, Online, dan cabang offline.

- Kembalikan pemilihan cabang hanya pada form request akses; login tetap email-only.
- Ubah request menjadi `pending`, sediakan approval/rejection HQ selama masa review dua menit, lalu append user yang approved atau auto-activated ke cell `DROPDOWNS!B:C` pada baris cabang yang sama.
- Terapkan login email setelah masa review backend dua menit, rate limit, opaque session token, expiry, revocation/logout, dan audit log tanpa pengiriman email login.
- Terapkan `dataScope` dan `columnAccess` pada seluruh endpoint baca maupun perubahan data.
- Gunakan server-side row filtering dan explicit restricted-field allowlist; jangan mengirim seluruh data ke browser user cabang.
- Implementasikan tampilan operasional:
  - HQ Kolom E → seluruh data, full columns;
  - Online row 5 → hanya `Sessions!H = Online`, full columns;
  - BM/SA offline → hanya branch terkait, restricted columns, langsung menampilkan seluruh data cabangnya tanpa search gate.
- Pisahkan folder/permission PDF untuk Online dan setiap cabang. Migrasikan atau amankan PDF existing sebelum user branch diberikan akses; user non-HQ tidak boleh memiliki akses ke root folder.
- Jalankan negative security tests dengan token lintas cabang dan request API yang dimodifikasi manual.

**Exit criteria:** masa review dua menit, approval/rejection, dan auto-activation berjalan, response API sudah sesuai scope/field allowlist, akses silang cabang ditolak, serta PDF cabang lain tidak dapat dibuka di luar dashboard.

> Dashboard branch/Online baru tidak boleh dirilis jika isolasi PDF belum selesai. Jika migrasi PDF belum siap, akses PDF untuk user non-HQ harus dinonaktifkan sementara.

### Phase 3 — Dashboard Analytics HQ dan Operational Monitoring

**Tujuan:** menambahkan insight bisnis setelah fondasi data dan authorization stabil.

- Implementasikan KPI HQ, funnel stage, Top 3 cabang, tren waktu, dan rekap seluruh cabang.
- Tambahkan tab detail/all-results dengan server-side pagination dan filter.
- Tambahkan operational alerts untuk stalled session, sync gagal, final tanpa PDF, dan email belum/gagal dikirim.
- Pastikan endpoint overview hanya mengirim agregat; raw records dimuat per halaman saat diperlukan.
- Finalisasi dokumentasi `README.md`, `PRD-placement-test.md`, konfigurasi deployment, dan runbook operasional.
- Jalankan regression, performance, browser desktop/mobile, dan production smoke test.

**Exit criteria:** angka KPI tervalidasi terhadap sampel sheet, pagination stabil pada volume production, alert dapat ditindaklanjuti, dan hanya HQ Kolom E yang dapat membuka analytics HQ.

### Aturan Release dan Rollback

- Buat backup/tag sebelum setiap phase dan catat versi deployment Apps Script yang aktif.
- Jangan mencampurkan perubahan dari phase berikutnya ke release phase yang sedang diverifikasi.
- Gunakan data uji untuk Online, minimal dua cabang offline, dan HQ; jangan memakai data siswa production untuk negative security test.
- Jika acceptance criteria gagal, rollback hanya deployment phase tersebut tanpa menghapus data registrasi yang sudah masuk.

## Verification / Acceptance Criteria

### Registrasi siswa

- Submit dari `index-online.html` menghasilkan `Sessions!H = Online` dan masuk ke tes sesuai usia.
- `index.html` tidak menampilkan opsi `Online`, mewajibkan kota+cabang, dan menghasilkan `Sessions!H` sesuai cabang terpilih.
- Refresh/navigasi antar tahap tidak menghilangkan branch dari registration/session.
- Seluruh Junior, Kids, dan Teens membawa nilai branch yang sama hingga finalize dan dashboard.

### Request akses dashboard

- Request BM/SA baru hanya menghasilkan record `pending` dan belum mengubah `DROPDOWNS`.
- Setelah approval atau auto-activation dua menit, BM ditambahkan ke cell Kolom B pada baris cabang tersebut.
- Setelah approval atau auto-activation dua menit, SA Kids ditambahkan ke cell Kolom C pada baris cabang tersebut.
- Approval kedua pada cell yang sudah berisi user menghasilkan `existing entry, new entry` di cell yang sama, bukan row baru.
- Request email yang sama untuk branch+role yang sama tidak membuat duplikat.
- Branch `Online` menggunakan row 5 dengan aturan B/C yang sama.

### Login dan otorisasi

- Login hanya meminta email dan backend berhasil menentukan branch/access level tanpa input cabang.
- User cabang offline langsung melihat seluruh hasil siswa dari cabangnya tanpa harus mencari nama atau email siswa.
- User cabang offline hanya menerima restricted columns yang sudah ditetapkan, meskipun mencoba memanggil endpoint secara langsung.
- User yang terdaftar pada row `Online` hanya menerima record dengan `Sessions!H = Online`, tetapi mendapat full columns.
- Percobaan memakai token cabang A untuk membaca atau mengubah submission cabang B ditolak backend.
- HQ yang terdaftar manual di Kolom E dapat melihat data Online dan seluruh cabang offline dengan full columns serta analytics HQ.
- Login ditolak dengan pesan yang jelas jika satu email terdaftar pada lebih dari satu cabang offline.

### Regression

- Consent, session token placement test, sync per stage, finalize, PDF, dan email report tetap berfungsi.
- `Code.gs` lolos syntax check dan script inline pada seluruh HTML yang diubah tidak memiliki syntax error.
- Smoke test dilakukan pada desktop dan mobile untuk kedua entry point serta portal dashboard.

### Security

- Request akses baru tetap `pending` dan belum dapat dipakai login selama masa review dua menit atau setelah ditolak HQ.
- Login sebelum masa review selesai atau request yang sudah ditolak tidak dapat memperoleh session.
- Browser user cabang tidak menerima field di luar restricted allowlist pada response API.
- Token Online tidak dapat membaca record cabang offline meskipun request dimodifikasi manual.
- Token cabang A tidak dapat membaca atau mengubah submission cabang B.
- Token non-HQ tidak dapat memanggil endpoint analytics/all-results HQ.
- User cabang tidak memperoleh permission ke root folder atau PDF milik cabang lain.
- Endpoint overview HQ mengembalikan agregat tanpa mengirim seluruh raw student records.

## Keputusan Requirement yang Sudah Jelas

- `Sessions!H` adalah tempat menyimpan asal siswa (`Online` atau nama cabang), bukan tempat menyimpan user akses dashboard.
- User akses dashboard disimpan branch-per-row di `DROPDOWNS!B:C`.
- Row 5 `Online` hanya di-ignore pada halaman registrasi offline; row tersebut tetap dipakai oleh entry online dan dashboard.
