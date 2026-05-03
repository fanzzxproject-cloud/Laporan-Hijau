require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── LAPORAN ──────────────────────────────────────

// Kirim laporan baru
app.post('/api/laporan', async (req, res) => {
  const { nama_pelapor, kelas, lokasi, kategori, penjelasan, foto_url } = req.body;

  if (!nama_pelapor || !kelas || !lokasi || !kategori || !penjelasan) {
    return res.status(400).json({ error: 'Semua field wajib harus diisi.' });
  }

  const { data, error } = await supabase
    .from('laporan')
    .insert([{ nama_pelapor, kelas, lokasi, kategori, penjelasan, foto_url, status: 'baru' }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// Cek status laporan berdasarkan nama & kelas
app.get('/api/laporan/cek', async (req, res) => {
  const { nama, kelas } = req.query;

  if (!nama || !kelas) {
    return res.status(400).json({ error: 'Nama dan kelas wajib diisi.' });
  }

  const { data, error } = await supabase
    .from('laporan')
    .select('id, kategori, lokasi, status, created_at, balasan')
    .ilike('nama_pelapor', nama)
    .eq('kelas', kelas)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// Sync status riwayat berdasarkan array id
app.post('/api/laporan/sync', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids harus berupa array.' });
  }

  const { data, error } = await supabase
    .from('laporan')
    .select('id, status, balasan')
    .in('id', ids);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// ── PENGUMUMAN ───────────────────────────────────

// Ambil daftar pengumuman
app.get('/api/pengumuman', async (req, res) => {
  const { data, error } = await supabase
    .from('pengumuman')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// ── UPLOAD FOTO (signed URL) ──────────────────────

// Generate signed upload URL agar file bisa diupload langsung dari browser
app.post('/api/upload-url', async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename wajib.' });

  const fname = `laporan_${Date.now()}_${filename}`;
  const { data, error } = await supabase.storage
    .from('laporan-foto')
    .createSignedUploadUrl(fname);

  if (error) return res.status(500).json({ error: error.message });

  const publicUrl = supabase.storage.from('laporan-foto').getPublicUrl(fname).data.publicUrl;
  res.json({ signedUrl: data.signedUrl, token: data.token, path: fname, publicUrl });
});

// ── SERVE FRONTEND ───────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Laporan Hijau berjalan di http://localhost:${PORT}`);
});
