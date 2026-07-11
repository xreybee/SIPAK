import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { supabase } from '@/lib/supabase';
import { comparePasswords } from '@/lib/auth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_key_for_sipak_demo_only');

export async function POST(req: Request) {
  try {
    const { id_pegawai, password } = await req.json();

    if (!id_pegawai || !password) {
      return NextResponse.json({ error: 'NIP/NUPTK dan Password wajib diisi.' }, { status: 400 });
    }

    // Check credentials in DB
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('id, nama_lengkap, password_hash')
      .eq('id_pegawai', id_pegawai)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Identitas pegawai tidak ditemukan.' }, { status: 401 });
    }

    const isValid = await comparePasswords(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Kata sandi salah.' }, { status: 401 });
    }

    // Create JWT Token
    const token = await new SignJWT({ sub: user.id, nama: user.nama_lengkap, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1d') // Valid for 1 day
      .sign(JWT_SECRET);

    // Set HTTP-Only Cookie
    const response = NextResponse.json({ message: 'Login berhasil', user: { nama: user.nama_lengkap } });
    response.cookies.set({
      name: 'sipak_auth_token',
      value: token,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 day in seconds
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
