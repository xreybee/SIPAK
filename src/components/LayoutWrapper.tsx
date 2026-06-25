'use client';
import { usePathname } from 'next/navigation';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  return (
    <div className={isLogin ? '' : "app-content-wrapper"}>
      <main className={`main-content animate-fade-in ${isLogin ? 'full-width' : ''}`} style={isLogin ? { padding: 0, margin: 0, maxWidth: '100%' } : {}}>
        {children}
      </main>
    </div>
  );
}
