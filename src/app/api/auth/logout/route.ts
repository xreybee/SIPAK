import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Berhasil keluar.' });
  response.cookies.delete('sipak_auth_token');
  return response;
}
