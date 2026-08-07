# Kalananti Placement Test

Repository ini adalah source production yang ditampilkan melalui:

- `https://www.kalananti.id/placement-test`
- `https://kalanantiacademics.github.io/placement-test/`

## Runtime production

- `index.html` — entry point registrasi khusus siswa **Cabang Offline** (wajib memilih kota & cabang).
- `index-online.html` — entry point registrasi khusus siswa **Online** (otomatis menetapkan branch `Online`).
- `junior-final-placement-test.html` — placement test usia 5–7.
- `kids-final-placement-test.html` — placement test usia 8–15.
- `teens.html` — placement test usia 16–18.
- `hasil-placement-test-kalananti.html` — dashboard hasil HQ/BM/SA.
- `placement-session.js` — session per submission/browser tab.
- `placement-sync.js` — sinkronisasi Apps Script dan report PDF.
- `device-guard.js` — hanya mengizinkan desktop/laptop dan tablet landscape; HP serta tablet portrait diblokir sejak halaman registrasi.
- `assets/` — aset lokal yang digunakan assessment.
- `favicon.ico` — favicon dashboard hasil.

## Backend

- `Code.gs` — Google Apps Script Web App. Perubahan file ini tetap harus di-deploy manual ke Apps Script.

### Kontrak akses dashboard

- `DROPDOWNS!A:A` menyimpan nama cabang; `Online` merupakan branch khusus online.
- Request baru ditulis ke `DROPDOWNS!B:B` (BM) atau `DROPDOWNS!C:C` (SA Kids) pada exact row cabang yang dipilih. Akses existing di F/G tetap dibaca agar akun lama tidak terputus.
- `DROPDOWNS!E:E` menyimpan HQ dan hanya dikelola manual.
- Request publik masuk ke `AccessRequests` sebagai `pending`. Hanya HQ yang sudah login dapat approve/reject dari dashboard.
- Login memakai email terdaftar setelah masa review backend 1 menit, tanpa mengirim OTP/email. Frontend menampilkan countdown, memeriksa approval otomatis, lalu menahan akses dashboard sampai user menekan tombol OK pada overlay persetujuan. Session token disimpan sebagai hash, berlaku 24 jam, dan dapat dicabut melalui logout.
- HQ memiliki `dataScope=all,columnAccess=full`; Online memiliki `dataScope=branch,columnAccess=full`; cabang offline memiliki `dataScope=branch,columnAccess=restricted`.

### Deployment dan migrasi

1. Buat backup/tag source dan catat deployment Apps Script aktif.
2. Salin `Code.gs` ke Apps Script, deploy sebagai versi Web App baru, lalu pastikan URL pada HTML masih menunjuk deployment yang benar.
3. Jalankan `setupPlacementStorage()` satu kali jika sheet placement belum tersedia.
4. Deploy Web App dengan eksekusi sebagai owner dan pastikan scope Spreadsheet, Drive, dan Mail sudah diotorisasi.
5. Pasang installable edit trigger untuk fungsi `onEdit`; simple trigger tidak memiliki otorisasi Drive yang cukup untuk memperbarui permission folder.
6. Jalankan `migratePlacementPdfsToBranchFolders()` dari Apps Script editor untuk memindahkan PDF existing ke subfolder `Placement Test - <branch>`.
7. Periksa permission root PDF. Hapus akses BM/SA lama dari root secara manual; hanya HQ yang boleh tetap memiliki akses root.
8. Uji dengan data non-production: satu user Online, dua cabang offline berbeda, dan satu HQ.
9. Verifikasi masa review 1 menit, countdown/auto-login/overlay persetujuan, approval/rejection HQ, penolakan token lintas cabang, restricted response, pagination, analytics, dan PDF lintas cabang sebelum mengganti deployment production.

Rollback dilakukan dengan mengaktifkan kembali deployment Apps Script sebelumnya dan source tag phase terkait. Jangan menghapus row registrasi yang sudah masuk. Jika migrasi PDF belum selesai, backend otomatis tidak mengirim URL PDF lama kepada user non-HQ.

## Report dan referensi

- `report-*.html` — template dan preview report.
- `PRD-placement-test.md` dan `CHANGELOG.md` — spesifikasi dan riwayat perubahan.
- File panduan, pitch deck, dan question bank dipertahankan di root karena memiliki URL publik yang mungkin masih digunakan.

## Arsip lokal

Backup, virtualenv, generator lama, output QC, screenshot, PDF hasil, dan repair scripts tidak masuk repository production. Pada 2026-08-04 file tersebut dikumpulkan secara lokal di:

`versi-lama-local/`

Backup Git sebelum pembersihan tersedia di tag `backup-pre-cleanup-20260804`.
