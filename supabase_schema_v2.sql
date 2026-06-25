-- Supabase Schema v2 untuk SIPAK (Blueprint)

-- Drop all existing tables to avoid conflict
DROP TABLE IF EXISTS guru_unavailable CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS sekolah_identitas CASCADE;
DROP TABLE IF EXISTS beban_mengajar CASCADE;
DROP TABLE IF EXISTS jadwal_aktif CASCADE;
DROP TABLE IF EXISTS agendas CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS guru CASCADE;
DROP TABLE IF EXISTS kelas CASCADE;
DROP TABLE IF EXISTS mata_pelajaran CASCADE;
-- Tabel Admin Users untuk Login NIP
CREATE TABLE admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_pegawai VARCHAR(50) UNIQUE NOT NULL, -- NIP, NUPTK, NIDN
  password_hash TEXT NOT NULL,
  nama_lengkap VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Default Admin User (Password: admin123)
-- Insert a dummy user so the user can login immediately.
-- Note: In production, password should be hashed with bcrypt. For this demo, we'll store a plain text or simple hash since we don't have bcrypt set up in SQL easily without pgcrypto, but we'll assume the API route does a simple comparison for demo purposes.
INSERT INTO admin_users (id_pegawai, password_hash, nama_lengkap) VALUES ('123456789', 'admin123', 'Admin Kurikulum');

-- Tabel Identitas Sekolah
CREATE TABLE sekolah_identitas (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nama_sekolah VARCHAR(255) NOT NULL,
  alamat TEXT,
  telepon VARCHAR(50),
  website VARCHAR(100),
  email VARCHAR(100),
  logo_url TEXT,
  nama_kepsek VARCHAR(255),
  nip_kepsek VARCHAR(50),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Default Identitas
INSERT INTO sekolah_identitas (nama_sekolah, alamat, telepon, nama_kepsek, nip_kepsek) 
VALUES ('SMP NEGERI 1 INOVASI', 'Jl. Teknologi Cerdas No. 99', '(021) 12345678', 'Dr. Inovator, M.Pd.', '19800101 200501 1 001');

-- 1. Tabel Guru
CREATE TABLE guru (
  id_guru UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  nip VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Kelas
CREATE TABLE kelas (
  id_kelas UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tingkat INTEGER NOT NULL CHECK (tingkat IN (7, 8, 9)),
  nama_kelompok VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Mata Pelajaran (Sekarang menyimpan beban jam)
CREATE TABLE mata_pelajaran (
  id_mapel UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_mapel VARCHAR(255) NOT NULL,
  beban_jam INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabel Relasi Beban Mengajar (Guru - Mapel - Kelas)
CREATE TABLE beban_mengajar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_guru UUID REFERENCES guru(id_guru) ON DELETE CASCADE,
  id_mapel UUID REFERENCES mata_pelajaran(id_mapel) ON DELETE CASCADE,
  id_kelas UUID REFERENCES kelas(id_kelas) ON DELETE CASCADE,
  UNIQUE(id_guru, id_mapel, id_kelas)
);

-- 6. Tabel Jadwal Aktif (Output Penjadwalan)
CREATE TABLE jadwal_aktif (
  id_jadwal UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hari INTEGER NOT NULL CHECK (hari >= 1 AND hari <= 6),
  jam_ke INTEGER NOT NULL CHECK (jam_ke >= 1 AND jam_ke <= 10),
  id_guru UUID REFERENCES guru(id_guru) ON DELETE CASCADE,
  id_mapel UUID REFERENCES mata_pelajaran(id_mapel) ON DELETE CASCADE,
  id_kelas UUID REFERENCES kelas(id_kelas) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Aturan Absolut 1: Satu guru tidak bisa mengajar di dua kelas berbeda pada jam dan hari yang sama
  UNIQUE(id_guru, hari, jam_ke),
  -- Aturan Absolut 2: Satu kelas tidak bisa menerima dua pelajaran/guru berbeda pada jam dan hari yang sama
  UNIQUE(id_kelas, hari, jam_ke)
);

-- 7. Tabel Agendas (Updated untuk priority)
CREATE TABLE agendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  is_completed BOOLEAN DEFAULT false,
  priority VARCHAR(20) DEFAULT 'rutin' CHECK (priority IN ('rutin', 'penting', 'mendesak')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Tabel Documents (Arsip Surat)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  no_surat VARCHAR(255),
  perihal VARCHAR(255),
  tujuan VARCHAR(255),
  isi TEXT,
  tembusan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sekolah_identitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mata_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE beban_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_aktif ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create generic policies for demo
CREATE POLICY "Enable all access for all users" ON admin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON sekolah_identitas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON guru FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON kelas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON mata_pelajaran FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON beban_mengajar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON jadwal_aktif FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON agendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON documents FOR ALL USING (true) WITH CHECK (true);

-- 9. Tabel Guru Unavailable (Ketersediaan Guru)
CREATE TABLE IF NOT EXISTS guru_unavailable (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_guru UUID REFERENCES guru(id_guru) ON DELETE CASCADE,
  hari INTEGER NOT NULL CHECK (hari BETWEEN 1 AND 6),
  jam_ke INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(id_guru, hari, jam_ke)
);
ALTER TABLE guru_unavailable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON guru_unavailable FOR ALL USING (true) WITH CHECK (true);
