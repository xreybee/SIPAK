'use client';

import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface DocumentRecord {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
  no_surat?: string;
  perihal?: string;
  tujuan?: string;
  isi?: string;
  tembusan?: string;
}

export default function DocumentFactory() {
  const [title, setTitle] = useState('');
  const [noSurat, setNoSurat] = useState('');
  const [perihal, setPerihal] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [isi, setIsi] = useState('');
  const [tembusan, setTembusan] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [identitas, setIdentitas] = useState<any>({});
  const [detailModal, setDetailModal] = useState<DocumentRecord | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<DocumentRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    const [docsRes, identitasRes] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('sekolah_identitas').select('*').single()
    ]);
    if (docsRes.data) setDocuments(docsRes.data);
    if (identitasRes.data) setIdentitas(identitasRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getBase64ImageFromUrl = async (imageUrl: string) => {
    try {
      const res = await fetch(imageUrl, { mode: 'cors' });
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Failed to load image for PDF:', err);
      return null;
    }
  };

  const buildLetterPDF = async (data: { noSurat: string; perihal: string; tujuan: string; isi: string; tembusan: string }) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const marginLeft = 30; const marginRight = 20; const marginTop = 20;
    const contentWidth = 210 - marginLeft - marginRight;

    doc.setFont('times', 'bold');
    if (identitas.logo_url) {
      const base64Logo = await getBase64ImageFromUrl(identitas.logo_url);
      if (base64Logo) doc.addImage(base64Logo, 'PNG', marginLeft, marginTop, 20, 20);
    }

    const centerAlignX = marginLeft + (contentWidth / 2);
    doc.setFontSize(14); doc.text('PEMERINTAH KOTA PENDIDIKAN', centerAlignX, marginTop + 4, { align: 'center' });
    doc.text('DINAS PENDIDIKAN DAN KEBUDAYAAN', centerAlignX, marginTop + 10, { align: 'center' });
    doc.setFontSize(16); doc.text(identitas.nama_sekolah?.toUpperCase() || 'NAMA SEKOLAH', centerAlignX, marginTop + 16, { align: 'center' });
    
    doc.setFontSize(10); doc.setFont('times', 'normal');
    doc.text(identitas.alamat || 'Alamat Sekolah', centerAlignX, marginTop + 22, { align: 'center' });
    
    const contactStr = [];
    if (identitas.telepon) contactStr.push(`Telp: ${identitas.telepon}`);
    if (identitas.email) contactStr.push(`Email: ${identitas.email}`);
    if (identitas.website) contactStr.push(`Web: ${identitas.website}`);
    doc.text(contactStr.join(' | '), centerAlignX, marginTop + 26, { align: 'center' });

    doc.setLineWidth(1); doc.line(marginLeft, marginTop + 30, 210 - marginRight, marginTop + 30);
    doc.setLineWidth(0.3); doc.line(marginLeft, marginTop + 31, 210 - marginRight, marginTop + 31);

    let currentY = marginTop + 40;
    doc.setFontSize(12);
    doc.text(`Nomor    : ${data.noSurat || '-'}`, marginLeft, currentY);
    doc.text(`Lampiran : -`, marginLeft, currentY + 6);
    doc.text(`Perihal  : ${data.perihal}`, marginLeft, currentY + 12);

    const dateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Kota Pendidikan, ${dateStr}`, 210 - marginRight, currentY, { align: 'right' });

    currentY += 25;
    doc.text('Kepada Yth.', marginLeft, currentY);
    doc.setFont('times', 'bold'); doc.text(data.tujuan, marginLeft, currentY + 6);
    doc.setFont('times', 'normal'); doc.text('di -', marginLeft, currentY + 12);
    doc.text('   Tempat', marginLeft, currentY + 18);

    currentY += 30;
    doc.text('Dengan hormat,', marginLeft, currentY);
    currentY += 10;
    const splitText = doc.splitTextToSize(data.isi, contentWidth);
    doc.text(splitText, marginLeft, currentY);

    const footerY = currentY + (splitText.length * 6) + 20;
    doc.text('Mengetahui,', 210 - marginRight - 20, footerY, { align: 'center' });
    doc.text('Kepala Sekolah', 210 - marginRight - 20, footerY + 6, { align: 'center' });
    doc.setFont('times', 'bold'); doc.text(identitas.nama_kepsek || 'Nama Kepala Sekolah', 210 - marginRight - 20, footerY + 25, { align: 'center' });
    doc.setFont('times', 'normal'); doc.text(`NIP. ${identitas.nip_kepsek || '-'}`, 210 - marginRight - 20, footerY + 31, { align: 'center' });

    if (data.tembusan) {
      doc.text('Tembusan:', marginLeft, footerY + 35);
      const splitTembusan = doc.splitTextToSize(data.tembusan, contentWidth);
      doc.text(splitTembusan, marginLeft, footerY + 41);
    }

    return doc;
  };

  const generatePDF = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    const loadingToast = toast.loading(editingId ? 'Memperbarui Surat...' : 'Menyusun Dokumen PDF Resmi...');

    try {
      const doc = await buildLetterPDF({ noSurat, perihal, tujuan, isi, tembusan });
      const pdfBlob = doc.output('blob');

      // Upload to Supabase Storage
      const fileName = `surat_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
        });

      let fileUrl = '';
      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
      } else {
        doc.save(fileName);
        fileUrl = 'local-download';
      }

      const payload = { 
        title: title, 
        file_url: fileUrl,
        no_surat: noSurat,
        perihal: perihal,
        tujuan: tujuan,
        isi: isi,
        tembusan: tembusan
      };

      if (editingId) {
        await supabase.from('documents').update(payload).eq('id', editingId);
        toast.success('Surat resmi berhasil diperbarui!', { id: loadingToast });
      } else {
        await supabase.from('documents').insert([payload]);
        toast.success('Surat resmi berhasil di-generate!', { id: loadingToast });
      }

      fetchData();
      setTitle(''); setNoSurat(''); setPerihal(''); setTujuan(''); setIsi(''); setTembusan('');
      setEditingId(null);
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal memproses surat: ' + error.message, { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = (doc: DocumentRecord) => {
    setEditingId(doc.id);
    setTitle(doc.title || '');
    setNoSurat(doc.no_surat || '');
    setPerihal(doc.perihal || '');
    setTujuan(doc.tujuan || '');
    setIsi(doc.isi || '');
    setTembusan(doc.tembusan || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle(''); setNoSurat(''); setPerihal(''); setTujuan(''); setIsi(''); setTembusan('');
  };

  const handleReDownload = async (docRecord: DocumentRecord) => {
    const toastId = toast.loading('Meyiapkan unduhan PDF...');
    try {
      if (docRecord.isi) {
        const doc = await buildLetterPDF({
          noSurat: docRecord.no_surat || '',
          perihal: docRecord.perihal || '',
          tujuan: docRecord.tujuan || '',
          isi: docRecord.isi || '',
          tembusan: docRecord.tembusan || ''
        });
        doc.save(`${docRecord.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        toast.success('Berhasil diunduh!', { id: toastId });
      } else if (docRecord.file_url && docRecord.file_url !== 'local-download') {
        window.open(docRecord.file_url, '_blank');
        toast.success('Membuka tautan Cloud', { id: toastId });
      } else {
        throw new Error('Data isi surat lama tidak lengkap di database.');
      }
    } catch (e: any) {
      toast.error('Gagal mengunduh: ' + e.message, { id: toastId });
    }
  };

  const confirmDelete = (doc: DocumentRecord) => {
    setDeleteConfirmModal(doc);
  };

  const executeDelete = async () => {
    if (!deleteConfirmModal) return;
    const doc = deleteConfirmModal;
    setDeleteConfirmModal(null);
    const deleteToast = toast.loading('Menghapus surat...');
    try {
      if (doc.file_url && doc.file_url !== 'local-download') {
        const urlParts = doc.file_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('documents').remove([fileName]);
      }
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      
      toast.success('Surat berhasil dihapus', { id: deleteToast });
      fetchData();
    } catch (err: any) {
      toast.error('Gagal menghapus surat: ' + err.message, { id: deleteToast });
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Pabrik Surat Resmi</h1>
        <p className="text-muted">Buat surat resmi sekolah dengan tata naskah dinas otomatis.</p>
      </header>

      <section className="grid grid-cols-2">
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{editingId ? '✏️ Edit Surat' : 'Formulir Surat'}</h3>
            {editingId && (
              <button onClick={cancelEdit} type="button" className="btn btn-sm" style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                Batal Edit
              </button>
            )}
          </div>
          <form onSubmit={generatePDF} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Judul Arsip (Internal)</label>
              <input type="text" className="form-control" value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Contoh: Surat Panggilan Ortu Budi" />
            </div>
            <div className="form-group">
              <label className="form-label">Nomor Surat</label>
              <input type="text" className="form-control" value={noSurat} onChange={e=>setNoSurat(e.target.value)} required placeholder="Contoh: 421.3 / 123 / SMP / 2026" />
            </div>
            <div className="form-group">
              <label className="form-label">Perihal Surat</label>
              <input type="text" className="form-control" value={perihal} onChange={e=>setPerihal(e.target.value)} required placeholder="Contoh: Undangan Rapat Wali Murid" />
            </div>
            <div className="form-group">
              <label className="form-label">Tujuan (Kepada Yth.)</label>
              <input type="text" className="form-control" value={tujuan} onChange={e=>setTujuan(e.target.value)} required placeholder="Contoh: Bapak/Ibu Wali Murid Kelas 7A" />
            </div>
            <div className="form-group">
              <label className="form-label">Isi Surat</label>
              <textarea className="form-control" rows={5} value={isi} onChange={e=>setIsi(e.target.value)} required placeholder="Ketik isi surat disini..."></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Tembusan (Opsional)</label>
              <textarea className="form-control" rows={2} value={tembusan} onChange={e=>setTembusan(e.target.value)} placeholder="1. Kepala Dinas Pendidikan&#10;2. Komite Sekolah"></textarea>
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={isGenerating} style={{ width: '100%', marginTop: '1rem' }}>
              {isGenerating ? 'Menyusun Dokumen...' : editingId ? '💾 Simpan Perubahan Surat' : '📄 Generate & Simpan PDF Resmi'}
            </button>
          </form>
        </div>

        <div className="glass-panel">
          <h3>Riwayat Dokumen</h3>
          
          <div style={{ marginTop: '1rem' }}>
            {documents.length === 0 ? (
              <p className="text-muted">Belum ada dokumen yang dibuat.</p>
            ) : (
              <ul className="agenda-list">
                {documents.map((doc) => (
                  <li key={doc.id} className="agenda-item">
                    <div className="agenda-icon" style={{ fontSize: '2rem', padding: '0 0.5rem' }}>📄</div>
                    <div className="agenda-details">
                      <h4>{doc.title}</h4>
                      <p>{new Date(doc.created_at).toLocaleString('id-ID')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto', minWidth: '220px' }}>
                      <button 
                        onClick={() => setDetailModal(doc)} 
                        className="btn btn-sm" 
                        title="Lihat Detail"
                        style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        👁️ Detail
                      </button>
                      <button 
                        onClick={() => handleEdit(doc)} 
                        className="btn btn-sm" 
                        title="Edit Surat"
                        style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleReDownload(doc)} 
                        className="btn btn-sm"
                        title="Unduh PDF"
                        style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        ⬇️ Unduh
                      </button>
                      <button 
                        onClick={() => confirmDelete(doc)} 
                        className="btn btn-sm" 
                        title="Hapus Surat"
                        style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Modal Detail Surat */}
      {detailModal && (
        <div className="modal-backdrop" onClick={() => setDetailModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Detail Surat</h3>
              <button className="modal-close" onClick={() => setDetailModal(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <strong>Judul Arsip:</strong> {detailModal.title}
              </div>
              <div>
                <strong>Nomor Surat:</strong> {detailModal.no_surat || '-'}
              </div>
              <div>
                <strong>Perihal:</strong> {detailModal.perihal || '-'}
              </div>
              <div>
                <strong>Tujuan:</strong> {detailModal.tujuan || '-'}
              </div>
              <div>
                <strong>Isi Surat:</strong>
                <div style={{ padding: '0.5rem', background: '#F8FAFC', borderRadius: '4px', whiteSpace: 'pre-wrap', border: '1px solid #E2E8F0', marginTop: '0.25rem' }}>
                  {detailModal.isi || '-'}
                </div>
              </div>
              {detailModal.tembusan && (
                <div>
                  <strong>Tembusan:</strong>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{detailModal.tembusan}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailModal(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Surat */}
      {deleteConfirmModal && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header" style={{ background: '#fee2e2', color: '#991b1b' }}>
              <h3 className="modal-title" style={{ color: '#991b1b' }}>⚠️ Konfirmasi Hapus</h3>
              <button className="modal-close" onClick={() => setDeleteConfirmModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '1rem' }}>Apakah Anda yakin ingin menghapus arsip surat:</p>
              <p style={{ fontWeight: 'bold', margin: '0.5rem 0 1.5rem 0', color: '#0f172a' }}>"{deleteConfirmModal.title}"?</p>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Tindakan ini tidak dapat dibatalkan dan file PDF di Cloud akan permanen terhapus.</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn" style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600 }} onClick={() => setDeleteConfirmModal(null)}>Batal</button>
              <button className="btn" style={{ background: '#dc2626', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600 }} onClick={executeDelete}>Ya, Hapus Permanen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
