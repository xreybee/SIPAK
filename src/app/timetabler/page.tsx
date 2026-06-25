'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

// Helper to sort classes (optional)
const sortClasses = (a: string, b: string) => a.localeCompare(b);

export default function Timetabler() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [jadwals, setJadwals] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [identitas, setIdentitas] = useState<any>({});

  const fetchData = async () => {
    const [resJadwal, resKelas, resIdentitas] = await Promise.all([
      supabase.from('jadwal_aktif').select(`
        id_jadwal, hari, jam_ke,
        id_guru, guru (nama),
        id_mapel, mata_pelajaran (nama_mapel),
        id_kelas, kelas (tingkat, nama_kelompok)
      `).order('hari').order('jam_ke'),
      supabase.from('kelas').select('*').order('tingkat').order('nama_kelompok'),
      supabase.from('sekolah_identitas').select('*').single()
    ]);

    if (resJadwal.data) setJadwals(resJadwal.data);
    if (resKelas.data) setKelasList(resKelas.data);
    if (resIdentitas.data) setIdentitas(resIdentitas.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateSchedule = async () => {
    setIsGenerating(true);
    const loadingToast = toast.loading('Menyusun Jadwal...');
    try {
      const res = await fetch('/api/generate-schedule', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate');
      toast.success(data.message, { id: loadingToast });

      // Voice Notification
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance("Jadwal baru sudah dibuat");
        utterance.lang = 'id-ID';
        window.speechSynthesis.speak(utterance);
      }

      fetchData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const maxPeriods = 8; // We assume 8 periods max for the visual matrix
  const daysActive = [1, 2, 3, 4, 5, 6]; // Include Saturday

  // Build numeric codes for each unique Teacher + Mapel combination
  const assignmentDetails = new Map();
  jadwals.forEach(j => {
    const key = `${j.id_guru}_${j.id_mapel}`;
    if (!assignmentDetails.has(key)) {
      assignmentDetails.set(key, {
        id_guru: j.id_guru,
        id_mapel: j.id_mapel,
        nama_guru: j.guru?.nama || '',
        nama_mapel: j.mata_pelajaran?.nama_mapel || ''
      });
    }
  });

  const sortedAssignments = Array.from(assignmentDetails.values()).sort((a, b) => {
    if (a.nama_guru === b.nama_guru) {
      return a.nama_mapel.localeCompare(b.nama_mapel);
    }
    return a.nama_guru.localeCompare(b.nama_guru);
  });

  const assignmentToCode: Record<string, string> = {};
  sortedAssignments.forEach((assign, idx) => {
    assignmentToCode[`${assign.id_guru}_${assign.id_mapel}`] = (idx + 1).toString();
  });

  // Build matrix dictionary for fast lookup: matrix[hari][jam_ke][id_kelas]
  const matrix: Record<number, Record<number, Record<string, any>>> = {};
  
  // Build legend dictionary
  const legendMap: Record<string, any> = {};

  jadwals.forEach(j => {
    if (!matrix[j.hari]) matrix[j.hari] = {};
    if (!matrix[j.hari][j.jam_ke]) matrix[j.hari][j.jam_ke] = {};
    
    const assignKey = `${j.id_guru}_${j.id_mapel}`;
    const kodeAngka = assignmentToCode[assignKey];

    matrix[j.hari][j.jam_ke][j.id_kelas] = {
      kode: kodeAngka,
      mapel: j.mata_pelajaran?.nama_mapel,
      guru: j.guru?.nama
    };

    // Populate legend
    if (!legendMap[assignKey]) {
      legendMap[assignKey] = {
        kode: kodeAngka,
        nama: j.guru?.nama,
        mapelStr: j.mata_pelajaran?.nama_mapel,
        kelas: new Set()
      };
    }
    legendMap[assignKey].kelas.add(`${j.kelas?.tingkat}${j.kelas?.nama_kelompok}`);
  });

  const legendArray = Object.values(legendMap)
    .sort((a: any, b: any) => Number(a.kode) - Number(b.kode))
    .map((leg: any) => ({
      ...leg,
      no: leg.kode, // No dan Kode sama persis karena berurutan 1..n
      kelasStr: Array.from(leg.kelas).sort(sortClasses).join(', ')
    }));

  // Group classes by tingkat
  const tingkatMap: Record<number, any[]> = { 7: [], 8: [], 9: [] };
  kelasList.forEach(k => {
    if (tingkatMap[k.tingkat]) tingkatMap[k.tingkat].push(k);
  });

  const daySchedules: Record<number, { type: 'special' | 'period', num?: number, label?: string, time: string }[]> = {
    1: [
      { type: 'special', label: 'UPACARA BENDERA', time: '07.00 - 08.10' },
      { type: 'period', num: 3, time: '08.10 - 08.50' },
      { type: 'period', num: 4, time: '08.50 - 09.30' },
      { type: 'period', num: 5, time: '09.30 - 10.10' },
      { type: 'special', label: 'ISTIRAHAT', time: '10.10 - 10.40' },
      { type: 'period', num: 6, time: '10.40 - 11.20' },
      { type: 'period', num: 7, time: '11.20 - 12.10' },
      { type: 'period', num: 8, time: '12.10 - 12.50' },
      { type: 'special', label: 'SHOLAT DZUHUR', time: '12.50 - 13.20' },
      { type: 'special', label: 'PENGEMBANGAN DIRI', time: '13.20 - Selesai' }
    ],
    2: [
      { type: 'special', label: 'SHOLAT DHUHA', time: '07.00 - 07.30' },
      { type: 'period', num: 1, time: '07.30 - 08.10' },
      { type: 'period', num: 2, time: '08.10 - 08.50' },
      { type: 'period', num: 3, time: '08.50 - 09.30' },
      { type: 'period', num: 4, time: '09.30 - 10.10' },
      { type: 'special', label: 'ISTIRAHAT', time: '10.10 - 10.40' },
      { type: 'period', num: 5, time: '10.40 - 11.20' },
      { type: 'period', num: 6, time: '11.20 - 12.10' },
      { type: 'special', label: 'SHOLAT DZUHUR', time: '12.10 - 12.40' },
      { type: 'period', num: 7, time: '12.40 - 13.20' },
      { type: 'period', num: 8, time: '13.20 - 14.00' },
      { type: 'special', label: 'ESKUL / PENG. DIRI', time: '14.00 - Selesai' }
    ],
    3: [
      { type: 'special', label: 'SHOLAT DHUHA', time: '07.00 - 07.30' },
      { type: 'period', num: 1, time: '07.30 - 08.10' },
      { type: 'period', num: 2, time: '08.10 - 08.50' },
      { type: 'period', num: 3, time: '08.50 - 09.30' },
      { type: 'period', num: 4, time: '09.30 - 10.10' },
      { type: 'special', label: 'ISTIRAHAT', time: '10.10 - 10.40' },
      { type: 'period', num: 5, time: '10.40 - 11.20' },
      { type: 'period', num: 6, time: '11.20 - 12.10' },
      { type: 'special', label: 'SHOLAT DZUHUR', time: '12.10 - 12.40' },
      { type: 'period', num: 7, time: '12.40 - 13.20' },
      { type: 'period', num: 8, time: '13.20 - 14.00' },
      { type: 'special', label: 'ESKUL / PENG. DIRI', time: '14.00 - Selesai' }
    ],
    4: [
      { type: 'special', label: 'SHOLAT DHUHA', time: '07.00 - 07.30' },
      { type: 'period', num: 1, time: '07.30 - 08.10' },
      { type: 'period', num: 2, time: '08.10 - 08.50' },
      { type: 'period', num: 3, time: '08.50 - 09.30' },
      { type: 'period', num: 4, time: '09.30 - 10.10' },
      { type: 'special', label: 'ISTIRAHAT', time: '10.10 - 10.40' },
      { type: 'period', num: 5, time: '10.40 - 11.20' },
      { type: 'period', num: 6, time: '11.20 - 12.10' },
      { type: 'special', label: 'SHOLAT DZUHUR', time: '12.10 - 12.40' },
      { type: 'period', num: 7, time: '12.40 - 13.20' },
      { type: 'period', num: 8, time: '13.20 - 14.00' },
      { type: 'special', label: 'ESKUL / PENG. DIRI', time: '14.00 - Selesai' }
    ],
    5: [
      { type: 'special', label: 'JUMSIH / DHUHA', time: '07.00 - 07.30' },
      { type: 'period', num: 1, time: '07.30 - 08.10' },
      { type: 'period', num: 2, time: '08.10 - 08.50' },
      { type: 'period', num: 3, time: '08.50 - 09.30' },
      { type: 'period', num: 4, time: '09.30 - 10.10' },
      { type: 'special', label: 'SHOLAT JUMAT', time: '10.10 - Selesai' }
    ],
    6: [
      { type: 'special', label: 'SHOLAT DHUHA', time: '07.00 - 07.30' },
      { type: 'period', num: 1, time: '07.30 - 08.10' },
      { type: 'period', num: 2, time: '08.10 - 08.50' },
      { type: 'period', num: 3, time: '08.50 - 09.30' },
      { type: 'period', num: 4, time: '09.30 - 10.10' },
      { type: 'special', label: 'ISTIRAHAT', time: '10.10 - 10.40' },
      { type: 'period', num: 5, time: '10.40 - 11.20' },
      { type: 'period', num: 6, time: '11.20 - 12.00' },
      { type: 'period', num: 7, time: '12.00 - 12.40' },
      { type: 'special', label: 'SHOLAT DZUHUR', time: '12.50 - 13.20' },
      { type: 'special', label: 'ESKUL / PENG. DIRI', time: '13.20 - Selesai' }
    ]
  };

  return (
    <>
      <header className="page-header no-print">
        <h1>Smart Timetabler</h1>
        <p className="text-muted">Generate jadwal otomatis dan cetak dalam format matriks resmi institusi.</p>
        
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          <button onClick={generateSchedule} disabled={isGenerating} className="btn btn-primary">
            {isGenerating ? 'Menyusun...' : '⚡ Generate Jadwal Baru'}
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary">
            🖨️ Cetak Jadwal (Landscape)
          </button>
        </div>
      </header>

      {jadwals.length === 0 ? (
        <div className="glass-panel text-center no-print" style={{ padding: '4rem 1rem' }}>
          <div style={{ fontSize: '4rem', opacity: 0.5 }}>📅</div>
          <h3 className="text-muted">Belum ada jadwal.</h3>
          <p>Silakan klik Generate Jadwal Baru.</p>
        </div>
      ) : (
        <div className="print-container" style={{ background: '#fff', padding: '1rem', borderRadius: '8px', color: '#000', overflowX: 'auto' }}>
          
          {/* Judul Cetak */}
          <div style={{ textAlign: 'center', marginBottom: '1rem', background: '#6d28d9', color: '#fff', padding: '0.5rem', fontWeight: 'bold' }} className="print-header-bg">
            <h2 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>JADWAL PELAJARAN {identitas?.nama_sekolah || 'SEKOLAH'}</h2>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>SEMESTER GENAP TAHUN AJARAN 2025-2026</h3>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }} className="print-matrix-wrapper">
            
            {/* Tabel Matriks Kiri */}
            <div style={{ flex: 1, minWidth: '700px' }}>
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '40px' }}>Hari</th>
                    <th rowSpan={2} style={{ width: '30px' }}>Jam</th>
                    <th rowSpan={2} style={{ width: '100px' }}>Waktu</th>
                    <th colSpan={tingkatMap[7].length || 1}>Kelas 7</th>
                    <th colSpan={tingkatMap[8].length || 1}>Kelas 8</th>
                    <th colSpan={tingkatMap[9].length || 1}>Kelas 9</th>
                  </tr>
                  <tr>
                    {/* Render sub header for class groups A, B, C... */}
                    {[7, 8, 9].map(tingkat => (
                      tingkatMap[tingkat].length > 0 
                        ? tingkatMap[tingkat].map(k => <th key={k.id_kelas}>{k.nama_kelompok}</th>)
                        : <th key={`empty-${tingkat}`}>-</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daysActive.map(hari => {
                    const rowDefs = daySchedules[hari] || [];
                    return rowDefs.map((row, idx) => {
                      if (row.type === 'special') {
                        return (
                          <tr key={`${hari}-sp-${idx}`} className="matrix-special-row">
                            {idx === 0 && (
                              <td rowSpan={rowDefs.length} className="day-name-vertical" style={{ fontWeight: 'bold', writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                                {dayNames[hari].toUpperCase()}
                              </td>
                            )}
                            <td colSpan={2}>{row.time}</td>
                            <td colSpan={kelasList.length + 1} className="special-label" style={{ letterSpacing: '5px', fontWeight: 'bold' }}>
                              {row.label}
                            </td>
                          </tr>
                        );
                      } else {
                        return (
                          <tr key={`${hari}-pd-${row.num}`}>
                            {idx === 0 && (
                              <td rowSpan={rowDefs.length} className="day-name-vertical" style={{ fontWeight: 'bold', writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                                {dayNames[hari].toUpperCase()}
                              </td>
                            )}
                            <td>{row.num}</td>
                            <td>{row.time}</td>
                            
                            {/* Render cells for each class */}
                            {[7, 8, 9].map(tingkat => {
                              if (tingkatMap[tingkat].length > 0) {
                                return tingkatMap[tingkat].map((k: any) => {
                                  const cellData = matrix[hari]?.[row.num!]?.[k.id_kelas];
                                  return (
                                    <td key={`${hari}-${row.num}-${k.id_kelas}`} title={`${cellData?.mapel || 'Kosong'} - ${cellData?.guru || ''}`}>
                                      {cellData?.kode || '-'}
                                    </td>
                                  );
                                });
                              } else {
                                return <td key={`${hari}-${row.num}-empty-${tingkat}`}>-</td>;
                              }
                            })}
                          </tr>
                        );
                      }
                    });
                  })}
                </tbody>
              </table>
            </div>

            {/* Tabel Legenda Kanan */}
            <div style={{ width: '400px' }}>
              <table className="legend-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>No</th>
                    <th style={{ width: '40px' }}>Kode</th>
                    <th>Nama Guru</th>
                    <th>Mata Pelajaran</th>
                    <th>Kelas</th>
                  </tr>
                </thead>
                <tbody>
                  {legendArray.map(leg => (
                    <tr key={leg.kode + leg.no}>
                      <td style={{ textAlign: 'center' }}>{leg.no}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{leg.kode}</td>
                      <td>{leg.nama}</td>
                      <td>{leg.mapelStr}</td>
                      <td>{leg.kelasStr}</td>
                    </tr>
                  ))}
                  {legendArray.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>

              {/* Tanda Tangan Footer */}
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
                <div style={{ width: '150px', textAlign: 'center' }}>
                  {identitas?.logo_url && (
                    <img src={identitas.logo_url} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', opacity: 0.2 }} />
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p>Kota Pendidikan, 12 Juli 2026</p>
                  <p>Mengetahui,</p>
                  <p>Kepala Sekolah,</p>
                  <br/><br/><br/>
                  <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{identitas?.nama_kepsek || 'Dr. Inovator, M.Pd.'}</p>
                  <p>NIP. {identitas?.nip_kepsek || '19800101 200501 1 001'}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
