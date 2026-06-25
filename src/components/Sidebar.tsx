'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Data Master', path: '/master', icon: '📁' },
    { name: 'Smart Timetabler', path: '/timetabler', icon: '🗓️' },
    { name: 'Agenda', path: '/agenda', icon: '📝' },
    { name: 'Pabrik Surat', path: '/documents', icon: '📄' },
    { name: 'Pengaturan Sekolah', path: '/settings', icon: '⚙️' },
  ];

  if (pathname === '/login') return null;

  return (
    <>
      <button 
        className="mobile-menu-btn" 
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '✕' : '☰'}
      </button>

      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <span className="logo-icon">🚀</span>
            <h2>SIPAK</h2>
          </div>
          <p className="subtitle">Sistem Penjadwalan</p>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link 
              key={link.path} 
              href={link.path}
              className={`nav-link ${pathname === link.path ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-text">{link.name}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">GK</div>
            <div className="user-info">
              <span className="user-name">Guru Kurikulum</span>
              <span className="user-role">Admin</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}
    </>
  );
}
