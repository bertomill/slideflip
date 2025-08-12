import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'templates', 'imported-02.html');
    const html = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json({ success: true, slideHtml: html });
  } catch (error) {
    console.error('Failed to load fallback slide:', error);
    return NextResponse.json({ success: false, error: 'Fallback slide not available' }, { status: 500 });
  }
}

export const dynamic = 'force-static';
