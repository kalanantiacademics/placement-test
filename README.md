# Kalananti Placement Test

Repository ini adalah source production yang ditampilkan melalui:

- `https://www.kalananti.id/placement-test`
- `https://kalanantiacademics.github.io/placement-test/`

## Runtime production

- `index.html` — registrasi dan routing berdasarkan usia.
- `junior-final-placement-test.html` — placement test usia 5–7.
- `kids-final-placement-test.html` — placement test usia 8–15.
- `teens.html` — placement test usia 16–18.
- `hasil-placement-test-kalananti.html` — dashboard hasil HQ/BM/SA.
- `placement-session.js` — session per submission/browser tab.
- `placement-sync.js` — sinkronisasi Apps Script dan report PDF.
- `device-guard.js` — aturan perangkat dan viewport.
- `assets/` — aset lokal yang digunakan assessment.
- `favicon.ico` — favicon dashboard hasil.

## Backend

- `Code.gs` — Google Apps Script Web App. Perubahan file ini tetap harus di-deploy manual ke Apps Script.

## Report dan referensi

- `report-*.html` — template dan preview report.
- `PRD-placement-test.md` dan `CHANGELOG.md` — spesifikasi dan riwayat perubahan.
- File panduan, pitch deck, dan question bank dipertahankan di root karena memiliki URL publik yang mungkin masih digunakan.

## Arsip lokal

Backup, virtualenv, generator lama, output QC, screenshot, PDF hasil, dan repair scripts tidak masuk repository production. Pada 2026-08-04 file tersebut dikumpulkan secara lokal di:

`versi-lama-local/`

Backup Git sebelum pembersihan tersedia di tag `backup-pre-cleanup-20260804`.
