'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [idPgw, setIdPgw] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idPgw || !password) {
      toast.error('NIP/NIDN dan kata sandi wajib diisi');
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading('Memeriksa kredensial...');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_pegawai: idPgw, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login gagal');
      }

      toast.success(`Selamat datang, ${data.user.nama}`, { id: loadingToast });
      window.location.href = '/'; // Redirect to dashboard
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: 'var(--spacing-lg)'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '400px',
        width: '100%',
        padding: '3rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--primary)' }}>🔒</div>
        <h2 style={{ marginBottom: '0.5rem', color: 'var(--bg-sidebar)' }}>Login SIPAK</h2>
        <p className="text-muted" style={{ marginBottom: '2rem', fontSize: '0.9rem' }}>
          Gunakan NIP/NIDN/NUPTK untuk mengakses dasbor admin kurikulum.
        </p>

        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div className="form-group">
            <label className="form-label">Nomor Induk Pegawai</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Contoh: 198001012005011001"
              value={idPgw}
              onChange={e => setIdPgw(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Kata Sandi</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={isLoading}>
            {isLoading ? 'Mengautentikasi...' : 'Masuk ke Sistem'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <p>Butuh bantuan? Hubungi Administrator IT Sekolah.</p>
          <p style={{ marginTop: '0.5rem' }}>Demo Creds: NIP: 123456789 | Pass: admin123</p>
        </div>
      </div>
    </div>
  );
}
