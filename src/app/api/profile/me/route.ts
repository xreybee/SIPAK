import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('id, nama_lengkap, id_pegawai')
    .eq('id', userId)
    .single();

  if (error) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { nama_lengkap, id_pegawai } = await req.json();

  const { data, error } = await supabase
    .from('admin_users')
    .update({ nama_lengkap, id_pegawai })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Profile updated successfully', user: data });
}
