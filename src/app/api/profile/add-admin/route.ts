import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { nama_lengkap, id_pegawai, password } = await req.json();

    if (!nama_lengkap || !id_pegawai || !password) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const { data, error } = await supabase
      .from('admin_users')
      .insert([
        { 
          nama_lengkap, 
          id_pegawai, 
          password_hash: hashedPassword 
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Pegawai dengan NIP/NUPTK tersebut sudah terdaftar.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Gagal menambahkan admin baru.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Admin baru berhasil ditambahkan', user: data });
  } catch (error: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
