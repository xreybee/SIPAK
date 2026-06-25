'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [identitas, setIdentitas] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const fetchIdentitas = async () => {
    const { data } = await supabase.from('sekolah_identitas').select('*').single();
    if (data) setIdentitas(data);
  };

  useEffect(() => {
    fetchIdentitas();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const loadingToast = toast.loading('Menyimpan pengaturan...');

    try {
      let logoUrl = identitas.logo_url;

      // Handle logo upload
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;
        
        // Ensure bucket exists in supabase: "public/assets"
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('assets')
          .upload(fileName, logoFile, { upsert: true });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(fileName);
          logoUrl = publicUrlData.publicUrl;
        } else {
          console.warn('Storage upload failed:', uploadError);
          // For demo if bucket doesn't exist, we will just use a fallback or error
          toast.error('Gagal mengunggah logo. Pastikan bucket "assets" sudah dibuat.');
        }
      }

      // Update Database
      const { error } = await supabase
        .from('sekolah_identitas')
        .update({
          nama_sekolah: identitas.nama_sekolah,
          alamat: identitas.alamat,
          telepon: identitas.telepon,
          website: identitas.website,
          email: identitas.email,
          nama_kepsek: identitas.nama_kepsek,
          nip_kepsek: identitas.nip_kepsek,
          logo_url: logoUrl
        })
        .eq('id', 1);

      if (error) throw error;

      toast.success('Identitas sekolah berhasil diperbarui!', { id: loadingToast });
      fetchIdentitas();
      setLogoFile(null);
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIdentitas({ ...identitas, [e.target.name]: e.target.value });
  };

  return (
    <>
      <header className="page-header">
        <h1>Pengaturan Sekolah</h1>
        <p className="text-muted">Ubah identitas, logo, dan profil Kepala Sekolah untuk kebutuhan Kop Surat resmi.</p>
      </header>

      <div className="glass-panel" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleUpdate} className="grid grid-cols-2">
          
          <div style={{ gridColumn: 'span 2' }}>
            <h3>Identitas Instansi</h3>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Nama Sekolah</label>
              <input type="text" name="nama_sekolah" className="form-control" value={identitas.nama_sekolah || ''} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Alamat Lengkap</label>
              <textarea name="alamat" className="form-control" rows={3} value={identitas.alamat || ''} onChange={handleChange} required />
            </div>
          </div>

          <div>
            <div className="form-group">
              <label className="form-label">Nomor Telepon</label>
              <input type="text" name="telepon" className="form-control" value={identitas.telepon || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Resmi</label>
              <input type="email" name="email" className="form-control" value={identitas.email || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input type="text" name="website" className="form-control" value={identitas.website || ''} onChange={handleChange} />
            </div>
          </div>

          <div>
            <div className="form-group">
              <label className="form-label">Logo Sekolah</label>
              {identitas.logo_url && (
                <div style={{ marginBottom: '1rem', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'inline-block' }}>
                  <img src={identitas.logo_url} alt="Logo" style={{ height: '80px', objectFit: 'contain' }} />
                </div>
              )}
              <input type="file" accept="image/png, image/jpeg" className="form-control" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Abaikan jika tidak ingin mengubah logo. Disarankan PNG transparan.</p>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <h3>Pejabat Penandatangan (Kepala Sekolah)</h3>
            <div className="grid grid-cols-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nama Kepala Sekolah beserta Gelar</label>
                <input type="text" name="nama_kepsek" className="form-control" value={identitas.nama_kepsek || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">NIP / NUPTK</label>
                <input type="text" name="nip_kepsek" className="form-control" value={identitas.nip_kepsek || ''} onChange={handleChange} required />
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? 'Menyimpan...' : '💾 Simpan Perubahan Identitas'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
