# 🎮 FREE FIRE ESPORTS SCOREBOARD — IT-FESTIVAL 2026 EDITION

Layout scoreboard turnamen Free Fire live real-time dengan tema retro pixel arcade khas **IT-Festival 2026** (kombinasi warna Navy `#050718`, Yellow `#FFE600`, Pink `#FF2E93`, dan Cyan `#00F0FF`) lengkap dengan maskot **VIXEL**.

---

## 🚀 Cara Menjalankan

### 1. Menjalankan Server Realtime Database
Server Node.js sudah otomatis berjalan dan menyimpan semua perubahan tim serta sponsor ke file disk `tournament_data.json`:
```bash
node server.js
```

Lalu buka di browser atau OBS Studio:
- **Tampilan Scoreboard Live**: [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Tampilan Admin Panel**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

> 💡 **Untuk OBS Studio Browser Source:** Masukkan URL `http://localhost:3000/index.html` dengan Width: `1920` dan Height: `1080`. Scoreboard sudah memiliki solid background `#050718` (tidak akan transparan di OBS) dan terhubung via Server-Sent Events (SSE) dengan latensi 0ms ke Admin Panel!

---

## 🧮 Sistem Penilaian (Free Fire Scoring Rules)

### Dari Mana Placement PTS Diperoleh?
**Placement PTS (Placement Points)** diperoleh dari peringkat akhir tim di setiap match sesuai aturan resmi Garena Free Fire World Series (FFWS):

| Peringkat Finish (Rank) | Placement Points |
| :--- | :--- |
| **Rank 1 (BOOYAH!)** | **12 Poin** |
| Rank 2 | 9 Poin |
| Rank 3 | 8 Poin |
| Rank 4 | 7 Poin |
| Rank 5 | 6 Poin |
| Rank 6 | 5 Poin |
| Rank 7 | 4 Poin |
| Rank 8 | 3 Poin |
| Rank 9 | 2 Poin |
| Rank 10 | 1 Poin |
| Rank 11 & 12 | 0 Poin |

### Apakah TOTAL = ELIMS + PLACEMENT atau Ditambah BOOYAH Juga?
* **Aturan Resmi (Official FFWS):**  
  $$\text{TOTAL} = \text{ELIMS (Kills)} + \text{PLACEMENT PTS}$$  
  *Setiap 1 Kill bernilai 1 Poin.*  
  Poin Booyah (12 poin) **sudah termasuk di dalam kolom Placement PTS**. Kolom **BOOYAH** pada tabel scoreboard menampilkan total kemenangan tim untuk keperluan tiebreaker (pemecah seri jika total poin sama).
* **Mode Custom Bonus Booyah (Opsional di Admin):**  
  Jika panitia turnamen menetapkan bonus ekstra untuk Booyah (misal +5 poin tambahan), kamu bisa mengaktifkan mode **"CUSTOM DENGAN BONUS BOOYAH"** di tab **Rumus & Aturan Poin** pada Admin Panel.

---

## ✨ Fitur-Fitur Utama

1. **⚡ Real-Time Sync (0 ms Latency)**
   - Menggunakan **BroadcastChannel API** dan **Storage Events** untuk sinkronisasi seketika antar jendela/tab browser dan OBS Browser Source tanpa perlu reload halaman.
   - Tersedia opsi konfigurasi **Firebase Realtime Database** gratis jika admin dan scoreboard berada di perangkat fisik yang berbeda setelah di-deploy.
2. **🏆 Animasi Rank-Up Halus (FLIP Technique)**
   - Menggunakan teknik *First Last Invert Play (FLIP)* untuk transisi posisi tabel secara mulus ketika peringkat tim berubah.
   - Tim yang naik peringkat akan memancarkan efek cahaya emas/hijau (`rank-up-anim`) disertai suara fanfare retro.
3. **🤖 Maskot VIXEL IT-Festival 2026**
   - Maskot robot pixel VIXEL tampil di sisi kanan scoreboard dengan animasi mengambang (*idle float*), dialog balon yang dinamis, dan efek suara saat diklik.
4. **👑 Champion Rush Bar**
   - Indikator target poin (default 118 Poin) sesuai regulasi turnamen Free Fire SEA.
5. **⚙️ Admin Dashboard Lengkap**
   - Tambah & edit tim dengan bendera negara, singkatan/tag, dan logo.
   - Form input hasil match cepat dengan preset dropdown rank (pilih Rank 1 otomatis set Booyah=1 dan Placement=12 Pts).
   - Tombol stepper `+` dan `-` untuk penyesuaian instan.
   - Fitur Ekspor & Impor file Backup JSON.
   - Mode Fullscreen satu-klik untuk layar proyektor / panggung turnamen.
