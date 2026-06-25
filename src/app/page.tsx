'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({ guru: 0, mapel: 0, kelas: 0 });
  const [agendas, setAgendas] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [resGuru, resMapel, resKelas, resAgenda] = await Promise.all([
        supabase.from('guru').select('*', { count: 'exact', head: true }),
        supabase.from('mata_pelajaran').select('*', { count: 'exact', head: true }),
        supabase.from('kelas').select('*', { count: 'exact', head: true }),
        supabase.from('agendas').select('*').eq('is_completed', false).order('date', { ascending: true }).limit(5)
      ]);

      setStats({
        guru: resGuru.count || 0,
        mapel: resMapel.count || 0,
        kelas: resKelas.count || 0
      });

      if (resAgenda.data) {
        setAgendas(resAgenda.data);
      }
    };

    fetchData();

    // Setup realtime subscription for dashboard
    const channel = supabase.channel('dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchData();
      }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <header className="page-header">
        <h1>Dashboard SIPAK</h1>
        <p className="text-muted">Selamat datang, Guru Kurikulum. Berikut ringkasan data real-time hari ini.</p>
      </header>

      <section className="grid grid-cols-3">
        <div className="glass-panel stat-card">
          <div className="stat-icon">👨‍🏫</div>
          <div className="stat-content">
            <h3>Total Guru</h3>
            <p className="stat-number">{stats.guru}</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <h3>Mata Pelajaran</h3>
            <p className="stat-number">{stats.mapel}</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon">🏫</div>
          <div className="stat-content">
            <h3>Total Kelas</h3>
            <p className="stat-number">{stats.kelas}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 mt-lg">
        <div className="glass-panel">
          <div className="panel-header">
            <h3>🗓️ Agenda Mendatang</h3>
            <Link href="/agenda" className="btn btn-secondary btn-sm">Kelola Agenda</Link>
          </div>
          
          {agendas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Tidak ada agenda aktif saat ini.
            </div>
          ) : (
            <ul className="agenda-list">
              {agendas.map(agenda => (
                <li key={agenda.id} className={`agenda-item priority-${agenda.priority || 'rutin'}`}>
                  <div className="agenda-date">
                    <span className="day">{new Date(agenda.date).getDate()}</span>
                    <span className="month">{new Date(agenda.date).toLocaleString('id-ID', { month: 'short' })}</span>
                  </div>
                  <div className="agenda-details">
                    <h4>{agenda.title}</h4>
                    <p>{agenda.time ? agenda.time.slice(0, 5) : 'Sepanjang hari'}</p>
                  </div>
                  {agenda.priority === 'mendesak' && <span className="badge badge-danger">Mendesak</span>}
                  {agenda.priority === 'penting' && <span className="badge badge-warning">Penting</span>}
                  {agenda.priority === 'rutin' && <span className="badge badge-primary">Rutin</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <h3>⚡ Aksi Cepat</h3>
          </div>
          <div className="action-grid">
            <Link href="/master" className="action-card">
              <div className="action-icon">📂</div>
              <h4>Data Induk</h4>
              <p>Kelola data guru, mapel, & kelas</p>
            </Link>
            <Link href="/timetabler" className="action-card">
              <div className="action-icon">🎲</div>
              <h4>Smart Timetabler</h4>
              <p>Buat jadwal otomatis anti-bentrok</p>
            </Link>
            <Link href="/documents" className="action-card">
              <div className="action-icon">📄</div>
              <h4>Pabrik Surat</h4>
              <p>Generate surat resmi sekolah</p>
            </Link>
            <Link href="/settings" className="action-card">
              <div className="action-icon">⚙️</div>
              <h4>Pengaturan</h4>
              <p>Kustomisasi identitas instansi</p>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
