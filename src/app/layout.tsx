import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SIPAK - Penjadwalan & Administrasi Kurikulum",
  description: "Sistem Informasi Penjadwalan dan Administrasi Kurikulum cerdas untuk sekolah.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#10121a",
};

import { Toaster } from 'react-hot-toast';

import LayoutWrapper from '@/components/LayoutWrapper';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <div className="app-container">
          <Sidebar />
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </div>
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#0F172A', color: '#fff', borderRadius: '8px' } }} />
      </body>
    </html>
  );
}
