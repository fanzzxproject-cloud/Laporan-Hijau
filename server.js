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

// Generate ID laporan random
function generateLaporanId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 9; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `LAPORAN_${rand}`;
}

// Kirim laporan baru
app.post('/api/laporan', async (req, res) => {
  const { nama_pelapor, kelas, lokasi, kategori, penjelasan, foto_url } = req.body;

  if (!nama_pelapor || !kelas || !lokasi || !kategori || !penjelasan) {
    return res.status(400).json({ error: 'Semua field wajib harus diisi.' });
  }

  const laporan_id = generateLaporanId();

  const { data, error } = await supabase
    .from('laporan')
    .insert([{ laporan_id, nama_pelapor, kelas, lokasi, kategori, penjelasan, foto_url, status: 'baru' }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// Cek status laporan berdasarkan laporan_id
app.get('/api/laporan/cek', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID laporan wajib diisi.' });

  const cleanId = id.toUpperCase().startsWith('LAPORAN_') ? id : `LAPORAN_${id}`;
  const { data, error } = await supabase
    .from('laporan')
    .select('id, laporan_id, kategori, lokasi, status, created_at, balasan, foto_dokumentasi')
    .eq('laporan_id', cleanId)
    .single();

  if (error) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
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
