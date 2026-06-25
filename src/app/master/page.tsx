'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

type TabType = 'guru' | 'mapel' | 'kelas';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState<TabType>('guru');

  // Data states
  const [gurus, setGurus] = useState<any[]>([]);
  const [mapels, setMapels] = useState<any[]>([]);
  const [kelas, setKelas] = useState<any[]>([]);

  // Form states
  const [namaGuru, setNamaGuru] = useState('');
  const [nipGuru, setNipGuru] = useState('');
  
  interface BebanMengajarInput {
    id_mapel: string;
    kelas_ids: string[];
  }
  const [bebanMengajarList, setBebanMengajarList] = useState<BebanMengajarInput[]>([]);

  const [namaMapel, setNamaMapel] = useState('');
  const [bebanJam, setBebanJam] = useState<number | string>(2);

  const [tingkatKelas, setTingkatKelas] = useState(7);
  const [namaKelompok, setNamaKelompok] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  // Modal Availability State
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [selectedGuruForAvailability, setSelectedGuruForAvailability] = useState<any>(null);
  const [unavailableDays, setUnavailableDays] = useState<number[]>([]);

  // Modal Edit Guru State
  const [isEditGuruModalOpen, setIsEditGuruModalOpen] = useState(false);
  const [selectedGuruForEdit, setSelectedGuruForEdit] = useState<any>(null);
  const [editBebanMengajarList, setEditBebanMengajarList] = useState<BebanMengajarInput[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    const [resGuru, resMapel, resKelas] = await Promise.all([
      supabase.from('guru').select('*').order('nama'),
      supabase.from('mata_pelajaran').select('*').order('nama_mapel'),
      supabase.from('kelas').select('*').order('tingkat').order('nama_kelompok')
    ]);
    if (resGuru.data) setGurus(resGuru.data);
    if (resMapel.data) setMapels(resMapel.data);
    if (resKelas.data) setKelas(resKelas.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaGuru) return;

    setIsLoading(true);
    const { data: newGuru, error } = await supabase
      .from('guru')
      .insert([{ nama: namaGuru, nip: nipGuru }])
      .select()
      .single();

    if (newGuru && !error) {
      const bebanMappings: any[] = [];
      for (const b of bebanMengajarList) {
        for (const k of b.kelas_ids) {
          bebanMappings.push({
            id_guru: newGuru.id_guru,
            id_mapel: b.id_mapel,
            id_kelas: k
          });
        }
      }
      
      if (bebanMappings.length > 0) {
        await supabase.from('beban_mengajar').insert(bebanMappings);
      }

      setNamaGuru(''); setNipGuru(''); setBebanMengajarList([]);
      fetchData();
    }
    setIsLoading(false);
  };

  const handleAddMapel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaMapel) return;
    setIsLoading(true);
    await supabase.from('mata_pelajaran').insert([{ nama_mapel: namaMapel, beban_jam: bebanJam }]);
    setNamaMapel(''); setBebanJam(2);
    fetchData();
  };

  const handleAddKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKelompok) return;
    setIsLoading(true);
    await supabase.from('kelas').insert([{ tingkat: tingkatKelas, nama_kelompok: namaKelompok }]);
    setTingkatKelas(7); setNamaKelompok('');
    fetchData();
  };

  const executeDelete = async (table: string, idColumn: string, id: string) => {
    setIsLoading(true);
    const { error } = await supabase.from(table).delete().eq(idColumn, id);
    if (error) {
      toast.error(`Gagal menghapus data dari ${table}`);
    } else {
      toast.success('Data berhasil dihapus');
      fetchData();
    }
    setIsLoading(false);
  };

  const deleteRecord = (table: string, idColumn: string, id: string) => {
    toast.custom((t) => (
      <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #fee2e2' }}>
        <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#b91c1c' }}>⚠️ Konfirmasi Hapus</p>
        <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#4b5563' }}>Apakah Anda yakin ingin menghapus data ini secara permanen?</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button 
            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => toast.dismiss(t.id)}
          >
            Batal
          </button>
          <button 
            style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => {
              toast.dismiss(t.id);
              executeDelete(table, idColumn, id);
            }}
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleCheckboxChange = (id: string, stateList: string[], setStateList: any) => {
    if (stateList.includes(id)) {
      setStateList(stateList.filter(item => item !== id));
    } else {
      setStateList([...stateList, id]);
    }
  };

  // AVAILABILITY MODAL LOGIC
  const openAvailabilityModal = async (guru: any) => {
    setSelectedGuruForAvailability(guru);
    setIsAvailabilityModalOpen(true);
    setUnavailableDays([]); // reset

    const res = await fetch(`/api/guru-availability?id_guru=${guru.id_guru}`);
    if (res.ok) {
      const data = await res.json();
      const blockedDays = data.map((d: any) => d.hari);
      setUnavailableDays(blockedDays);
    }
  };

  const closeAvailabilityModal = () => {
    setIsAvailabilityModalOpen(false);
    setSelectedGuruForAvailability(null);
  };

  const toggleDayAvailability = (dayIndex: number) => {
    if (unavailableDays.includes(dayIndex)) {
      setUnavailableDays(unavailableDays.filter(d => d !== dayIndex));
    } else {
      setUnavailableDays([...unavailableDays, dayIndex]);
    }
  };

  const saveAvailability = async () => {
    const loadingToast = toast.loading('Menyimpan jadwal libur...');
    try {
      const payload = {
        id_guru: selectedGuruForAvailability.id_guru,
        unavailable_slots: unavailableDays.map(hari => ({ hari, jam_ke: null }))
      };

      const res = await fetch('/api/guru-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success('Jadwal libur guru berhasil disimpan!', { id: loadingToast });
      closeAvailabilityModal();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  // EDIT GURU MODAL LOGIC
  const openEditGuruModal = async (guru: any) => {
    setSelectedGuruForEdit(guru);
    setIsEditGuruModalOpen(true);
    setEditBebanMengajarList([]); // reset

    const { data, error } = await supabase
      .from('beban_mengajar')
      .select('*')
      .eq('id_guru', guru.id_guru);

    if (data && !error) {
      // Group by mapel
      const mapelMap: Record<string, string[]> = {};
      data.forEach(d => {
        if (!mapelMap[d.id_mapel]) mapelMap[d.id_mapel] = [];
        mapelMap[d.id_mapel].push(d.id_kelas);
      });

      const structuredList: BebanMengajarInput[] = Object.keys(mapelMap).map(mapelId => ({
        id_mapel: mapelId,
        kelas_ids: mapelMap[mapelId]
      }));

      setEditBebanMengajarList(structuredList);
    }
  };

  const closeEditGuruModal = () => {
    setIsEditGuruModalOpen(false);
    setSelectedGuruForEdit(null);
  };

  const saveEditGuru = async () => {
    const loadingToast = toast.loading('Menyimpan perubahan...');
    try {
      // 1. Hapus semua beban lama
      const { error: errDel } = await supabase.from('beban_mengajar').delete().eq('id_guru', selectedGuruForEdit.id_guru);
      if (errDel) throw errDel;

      // 2. Masukkan yang baru
      const bebanMappings: any[] = [];
      for (const b of editBebanMengajarList) {
        for (const k of b.kelas_ids) {
          bebanMappings.push({
            id_guru: selectedGuruForEdit.id_guru,
            id_mapel: b.id_mapel,
            id_kelas: k
          });
        }
      }
      
      if (bebanMappings.length > 0) {
        const { error: errIns } = await supabase.from('beban_mengajar').insert(bebanMappings);
        if (errIns) throw errIns;
      }

      toast.success('Beban mengajar berhasil diperbarui!', { id: loadingToast });
      closeEditGuruModal();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan', { id: loadingToast });
    }
  };

  const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return (
    <>
      <header className="page-header">
        <h1>Panel Data Induk</h1>
        <p className="text-muted">Kelola data dasar untuk kebutuhan algoritma penjadwalan cerdas.</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className={`btn ${activeTab === 'guru' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('guru')}>👨‍🏫 Data Guru</button>
        <button className={`btn ${activeTab === 'mapel' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('mapel')}>📚 Data Mata Pelajaran</button>
        <button className={`btn ${activeTab === 'kelas' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('kelas')}>🏫 Data Kelas</button>
      </div>

      {activeTab === 'guru' && (
        <section className="grid grid-cols-3">
          <div className="glass-panel" style={{ gridColumn: 'span 1' }}>
            <h3>Tambah Guru</h3>
            <form onSubmit={handleAddGuru}>
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input type="text" className="form-control" value={namaGuru} onChange={e=>setNamaGuru(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">NIP (Opsional)</label>
                <input type="text" className="form-control" value={nipGuru} onChange={e=>setNipGuru(e.target.value)} />
              </div>

              {/* Beban Mengajar Dynamic Inputs */}
              <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Tugas Mengajar</label>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-secondary" 
                    onClick={() => setBebanMengajarList([...bebanMengajarList, { id_mapel: '', kelas_ids: [] }])}
                  >
                    + Tambah Mapel
                  </button>
                </div>

                {bebanMengajarList.length === 0 && (
                  <div className="text-muted" style={{ fontSize: '0.85rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                    Belum ada mata pelajaran yang ditambahkan. Klik "Tambah Mapel".
                  </div>
                )}

                {bebanMengajarList.map((beban, index) => (
                  <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <select 
                        className="form-control" 
                        value={beban.id_mapel}
                        onChange={(e) => {
                          const newList = [...bebanMengajarList];
                          newList[index].id_mapel = e.target.value;
                          setBebanMengajarList(newList);
                        }}
                        required
                      >
                        <option value="">-- Pilih Mata Pelajaran --</option>
                        {mapels.map(m => (
                          <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-danger" 
                        style={{ marginLeft: '0.5rem' }}
                        onClick={() => setBebanMengajarList(bebanMengajarList.filter((_, i) => i !== index))}
                      >
                        Hapus
                      </button>
                    </div>

                    {beban.id_mapel && (
                      <div style={{ marginTop: '1rem' }}>
                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Pilih Kelas untuk Mapel ini:</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                          {kelas.map(k => (
                            <label key={k.id_kelas} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem', alignItems: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={beban.kelas_ids.includes(k.id_kelas)} 
                                onChange={(e) => {
                                  const newList = [...bebanMengajarList];
                                  if (e.target.checked) {
                                    newList[index].kelas_ids.push(k.id_kelas);
                                  } else {
                                    newList[index].kelas_ids = newList[index].kelas_ids.filter(id => id !== k.id_kelas);
                                  }
                                  setBebanMengajarList(newList);
                                }} 
                              />
                              Kelas {k.tingkat} {k.nama_kelompok}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={isLoading}>Simpan Guru</button>
            </form>
          </div>
          <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
            <h3>Daftar Guru</h3>
            <table className="data-table">
              <thead><tr><th>Nama Guru</th><th>NIP</th><th>Aksi</th></tr></thead>
              <tbody>
                {gurus.map(g => (
                  <tr key={g.id_guru}>
                    <td>
                      <span 
                        style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: '500' }} 
                        onClick={() => openEditGuruModal(g)}
                        title="Klik untuk melihat/mengedit detail beban mengajar"
                      >
                        {g.nama}
                      </span>
                    </td>
                    <td>{g.nip || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openAvailabilityModal(g)}>📅 Atur Libur</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteRecord('guru', 'id_guru', g.id_guru)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* OTHER TABS OMITTED FOR BREVITY BUT KEPT IN SOURCE */}
      {activeTab === 'mapel' && (
        <section className="grid grid-cols-2">
          <div className="glass-panel">
            <h3>Tambah Mata Pelajaran</h3>
            <form onSubmit={handleAddMapel}>
              <div className="form-group">
                <label className="form-label">Nama Mata Pelajaran</label>
                <input type="text" className="form-control" value={namaMapel} onChange={e=>setNamaMapel(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Beban Jam (per Kelas)</label>
                <input type="number" min="1" max="10" className="form-control" value={Number.isNaN(bebanJam) ? '' : bebanJam} onChange={e=>setBebanJam(parseInt(e.target.value) || 0)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>Simpan Mapel</button>
            </form>
          </div>
          <div className="glass-panel">
            <h3>Daftar Mata Pelajaran</h3>
            <table className="data-table">
              <thead><tr><th>Nama Mapel</th><th>Beban Jam</th><th>Aksi</th></tr></thead>
              <tbody>
                {mapels.map(m => (
                  <tr key={m.id_mapel}>
                    <td>{m.nama_mapel}</td><td>{m.beban_jam} Jam</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => deleteRecord('mata_pelajaran', 'id_mapel', m.id_mapel)}>Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'kelas' && (
        <section className="grid grid-cols-2">
          <div className="glass-panel">
            <h3>Tambah Kelas</h3>
            <form onSubmit={handleAddKelas}>
              <div className="form-group">
                <label className="form-label">Tingkat Kelas</label>
                <select className="form-control" value={tingkatKelas} onChange={e=>setTingkatKelas(parseInt(e.target.value))}>
                  <option value={7}>Kelas 7</option>
                  <option value={8}>Kelas 8</option>
                  <option value={9}>Kelas 9</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nama Kelompok (Contoh: A, B, C)</label>
                <input type="text" className="form-control" value={namaKelompok} onChange={e=>setNamaKelompok(e.target.value.toUpperCase())} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>Simpan Kelas</button>
            </form>
          </div>
          <div className="glass-panel">
            <h3>Daftar Kelas</h3>
            <table className="data-table">
              <thead><tr><th>Tingkat</th><th>Kelompok</th><th>Aksi</th></tr></thead>
              <tbody>
                {kelas.map(k => (
                  <tr key={k.id_kelas}>
                    <td>Kelas {k.tingkat}</td><td>{k.nama_kelompok}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => deleteRecord('kelas', 'id_kelas', k.id_kelas)}>Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* AVAILABILITY MODAL */}
      {isAvailabilityModalOpen && selectedGuruForAvailability && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '500px', maxWidth: '90%', position: 'relative' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              Pengaturan Hari Libur Guru
            </h3>
            <p><strong>Nama:</strong> {selectedGuruForAvailability.nama}</p>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Klik pada kotak hari di bawah ini untuk menandai hari tersebut sebagai <strong>Hari Libur (Merah)</strong>. Guru tidak akan dijadwalkan mengajar pada hari yang berwarna merah.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              {[1, 2, 3, 4, 5, 6].map(dayIndex => {
                const isOff = unavailableDays.includes(dayIndex);
                return (
                  <div 
                    key={dayIndex}
                    onClick={() => toggleDayAvailability(dayIndex)}
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isOff ? '2px solid #ef4444' : '2px solid #d1d5db',
                      backgroundColor: isOff ? '#fef2f2' : '#f9fafb',
                      color: isOff ? '#b91c1c' : '#374151',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    {dayNames[dayIndex]}
                    <div style={{ fontSize: '0.8rem', fontWeight: 'normal', marginTop: '0.5rem' }}>
                      {isOff ? '🚫 Libur' : '✅ Tersedia'}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={closeAvailabilityModal}>Batal</button>
              <button className="btn btn-primary" onClick={saveAvailability}>Simpan Pengaturan</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT GURU MODAL */}
      {isEditGuruModalOpen && selectedGuruForEdit && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '600px', maxWidth: '90%', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              Detail & Edit Beban Mengajar Guru
            </h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}><strong>{selectedGuruForEdit.nama}</strong></p>
              <p className="text-muted" style={{ margin: 0 }}>NIP: {selectedGuruForEdit.nip || '-'}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Daftar Mata Pelajaran & Kelas</label>
              <button 
                type="button" 
                className="btn btn-sm btn-secondary" 
                onClick={() => setEditBebanMengajarList([...editBebanMengajarList, { id_mapel: '', kelas_ids: [] }])}
              >
                + Tambah Mapel
              </button>
            </div>

            {editBebanMengajarList.length === 0 && (
              <div className="text-muted" style={{ fontSize: '0.85rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center', marginBottom: '1rem' }}>
                Guru ini belum memiliki beban mengajar. Klik "Tambah Mapel" untuk mulai menambahkan.
              </div>
            )}

            {editBebanMengajarList.map((beban, index) => (
              <div key={index} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <select 
                    className="form-control" 
                    value={beban.id_mapel}
                    onChange={(e) => {
                      const newList = [...editBebanMengajarList];
                      newList[index].id_mapel = e.target.value;
                      setEditBebanMengajarList(newList);
                    }}
                    required
                  >
                    <option value="">-- Pilih Mata Pelajaran --</option>
                    {mapels.map(m => (
                      <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-danger" 
                    style={{ marginLeft: '0.5rem' }}
                    onClick={() => setEditBebanMengajarList(editBebanMengajarList.filter((_, i) => i !== index))}
                  >
                    Hapus
                  </button>
                </div>

                {beban.id_mapel && (
                  <div style={{ marginTop: '1rem' }}>
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>Kelas yang diampu:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                      {kelas.map(k => (
                        <label key={k.id_kelas} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem', alignItems: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={beban.kelas_ids.includes(k.id_kelas)} 
                            onChange={(e) => {
                              const newList = [...editBebanMengajarList];
                              if (e.target.checked) {
                                newList[index].kelas_ids.push(k.id_kelas);
                              } else {
                                newList[index].kelas_ids = newList[index].kelas_ids.filter(id => id !== k.id_kelas);
                              }
                              setEditBebanMengajarList(newList);
                            }} 
                          />
                          Kelas {k.tingkat} {k.nama_kelompok}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button className="btn btn-secondary" onClick={closeEditGuruModal}>Batal</button>
              <button className="btn btn-primary" onClick={saveEditGuru}>Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
