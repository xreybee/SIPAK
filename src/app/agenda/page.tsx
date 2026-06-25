'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Agenda {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  priority: 'rutin' | 'penting' | 'mendesak';
  is_completed: boolean;
}

export default function AgendaTracker() {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newPriority, setNewPriority] = useState<'rutin'|'penting'|'mendesak'>('rutin');

  const fetchAgendas = async () => {
    const { data, error } = await supabase
      .from('agendas')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (!error && data) {
      setAgendas(data);
    }
  };

  useEffect(() => {
    fetchAgendas();

    const channel = supabase
      .channel('agenda_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendas' }, (payload) => {
        fetchAgendas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;

    await supabase.from('agendas').insert([
      { title: newTitle, date: newDate, time: newTime || null, priority: newPriority }
    ]);

    setNewTitle(''); setNewDate(''); setNewTime(''); setNewPriority('rutin');
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    await supabase.from('agendas').update({ is_completed: !currentStatus }).eq('id', id);
  };

  return (
    <>
      <header className="page-header">
        <h1>Real-time Agenda Tracker</h1>
        <p className="text-muted">Kelola agenda Anda. Perubahan akan tersinkronisasi otomatis di semua perangkat.</p>
      </header>

      <section className="grid grid-cols-3">
        <div className="glass-panel" style={{ gridColumn: 'span 1' }}>
          <h3>Tambah Agenda</h3>
          <form onSubmit={addAgenda} style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Judul Agenda</label>
              <input type="text" className="form-control" placeholder="Contoh: Rapat Wali Kelas" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input type="date" className="form-control" value={newDate} onChange={e => setNewDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Waktu</label>
              <input type="time" className="form-control" value={newTime} onChange={e => setNewTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Prioritas</label>
              <select className="form-control" value={newPriority} onChange={e => setNewPriority(e.target.value as any)}>
                <option value="rutin">🟢 Rutin</option>
                <option value="penting">🟡 Penting</option>
                <option value="mendesak">🔴 Mendesak / Deadline</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Simpan Agenda
            </button>
          </form>
        </div>

        <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
          <h3>Daftar Agenda</h3>
          
          {agendas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📝</span>
              Belum ada agenda yang tersimpan.
            </div>
          ) : (
            <ul className="agenda-list" style={{ marginTop: '1rem' }}>
              {agendas.map(agenda => (
                <li key={agenda.id} className={`agenda-item priority-${agenda.priority}`} style={{ opacity: agenda.is_completed ? 0.5 : 1 }}>
                  <div className="agenda-date">
                    <span className="day">{new Date(agenda.date).getDate()}</span>
                    <span className="month">{new Date(agenda.date).toLocaleString('id-ID', { month: 'short' })}</span>
                  </div>
                  <div className="agenda-details" style={{ textDecoration: agenda.is_completed ? 'line-through' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0 }}>{agenda.title}</h4>
                      {agenda.priority === 'mendesak' && <span className="badge badge-danger">Mendesak</span>}
                      {agenda.priority === 'penting' && <span className="badge badge-warning">Penting</span>}
                    </div>
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {agenda.time ? agenda.time.slice(0, 5) : 'Sepanjang hari'}
                    </p>
                  </div>
                  <div className="agenda-actions">
                    <button 
                      className={`btn btn-sm ${agenda.is_completed ? 'btn-secondary' : 'btn-success'}`}
                      onClick={() => toggleComplete(agenda.id, agenda.is_completed)}
                    >
                      {agenda.is_completed ? 'Batal' : 'Selesai'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
