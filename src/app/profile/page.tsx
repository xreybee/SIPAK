'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for editing profile
  const [namaLengkap, setNamaLengkap] = useState('');
  const [idPegawai, setIdPegawai] = useState('');

  // Form states for adding new admin
  const [newAdminNama, setNewAdminNama] = useState('');
  const [newAdminIdPegawai, setNewAdminIdPegawai] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  useEffect(() => {
    // We can't get headers directly in a client component, 
    // so we will fetch user data from an API route
    const fetchUserData = async () => {
      const res = await fetch('/api/profile/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setNamaLengkap(data.nama_lengkap);
        setIdPegawai(data.id_pegawai);
      } else {
        toast.error('Gagal mengambil data pengguna');
        router.push('/login');
      }
    };
    fetchUserData();
  }, [router]);

  const handleLogout = async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/login');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const loadingToast = toast.loading('Menyimpan profil...');
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_lengkap: namaLengkap,
          id_pegawai: idPegawai,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Profil berhasil diperbarui', { id: loadingToast });
      setUser(data.user);
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const loadingToast = toast.loading('Menambahkan admin baru...');
    try {
      const res = await fetch('/api/profile/add-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_lengkap: newAdminNama,
          id_pegawai: newAdminIdPegawai,
          password: newAdminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Admin baru berhasil ditambahkan', { id: loadingToast });
      setNewAdminNama('');
      setNewAdminIdPegawai('');
      setNewAdminPassword('');
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };


  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <header className="page-header">
        <h1>Profil Admin</h1>
        <p className="text-muted">Kelola informasi profil Anda dan tambahkan admin baru.</p>
      </header>

      <div className="grid grid-cols-2 gap-8">
        <div className="glass-panel">
          <h3>Edit Profil</h3>
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <input 
                type="text" 
                className="form-control" 
                value={namaLengkap} 
                onChange={(e) => setNamaLengkap(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nomor Induk Pegawai</label>
              <input 
                type="text" 
                className="form-control" 
                value={idPegawai} 
                onChange={(e) => setIdPegawai(e.target.value)} 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>

        <div className="glass-panel">
          <h3>Tambah Admin Baru</h3>
          <form onSubmit={handleAddAdmin}>
            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <input 
                type="text" 
                className="form-control" 
                value={newAdminNama}
                onChange={(e) => setNewAdminNama(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nomor Induk Pegawai</label>
              <input 
                type="text" 
                className="form-control" 
                value={newAdminIdPegawai}
                onChange={(e) => setNewAdminIdPegawai(e.target.value)}
                placeholder="198001012005011001"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-control" 
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="********"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSaving}>
              {isSaving ? 'Menambahkan...' : 'Tambah Admin'}
            </button>
          </form>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button onClick={handleLogout} className="btn btn-danger">
          Logout
        </button>
      </div>
    </>
  );
}
