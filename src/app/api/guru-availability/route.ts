import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id_guru = searchParams.get('id_guru');

  if (!id_guru) {
    return NextResponse.json({ error: 'id_guru wajib diisi' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('guru_unavailable')
    .select('hari, jam_ke')
    .eq('id_guru', id_guru);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const { id_guru, unavailable_slots } = await req.json();

    if (!id_guru || !Array.isArray(unavailable_slots)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    // Determine the days this teacher wants to take off
    const requestedDays = new Set<number>();
    unavailable_slots.forEach(slot => requestedDays.add(slot.hari));

    // Validate the max 2 teachers per day rule
    for (const hari of Array.from(requestedDays)) {
      const { data: otherTeachers, error } = await supabase
        .from('guru_unavailable')
        .select('id_guru')
        .eq('hari', hari)
        .neq('id_guru', id_guru);

      if (error) throw error;

      const uniqueTeachersOff = new Set(otherTeachers.map(row => row.id_guru));
      if (uniqueTeachersOff.size >= 2) {
        return NextResponse.json({ 
          error: `Gagal menyimpan: Kuota libur untuk hari ke-${hari} sudah penuh (maksimal 2 guru per hari).` 
        }, { status: 400 });
      }
    }

    // If validation passes, we delete all existing slots for this teacher and insert new ones
    const { error: deleteError } = await supabase
      .from('guru_unavailable')
      .delete()
      .eq('id_guru', id_guru);

    if (deleteError) throw deleteError;

    if (unavailable_slots.length > 0) {
      const payload = unavailable_slots.map(slot => ({
        id_guru,
        hari: slot.hari,
        jam_ke: slot.jam_ke || null
      }));

      const { error: insertError } = await supabase
        .from('guru_unavailable')
        .insert(payload);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ message: 'Ketersediaan berhasil diperbarui' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan server' }, { status: 500 });
  }
}
