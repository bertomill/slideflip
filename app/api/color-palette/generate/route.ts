import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Generate a brand color palette (5 colors) from a short style prompt using OpenAI.
 * Returns array of hex strings. No images produced.
 * Requires OPENAI_API_KEY env var.
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `You are a senior brand designer. Given a short brief, output a JSON array of exactly 5 accessible brand colors in hex (uppercase, with leading #). Each color should have strong contrast when paired appropriately.
Rules:
- Return ONLY valid JSON array of 5 hex strings, e.g. ["#0F172A", "#3B82F6", "#22D3EE", "#E2E8F0", "#FFFFFF"]
- No prose. No keys. No markdown.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Brief: ${prompt}` },
      ],
      temperature: 0.5,
      max_tokens: 150,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '[]';
    // Attempt to parse, fallback to filtering hex-like strings
    let colors: string[] = [];
    try {
      colors = JSON.parse(raw);
    } catch {
      const matches = raw.match(/#[0-9A-Fa-f]{6}/g) || [];
      colors = matches.slice(0, 5).map(s => s.toUpperCase());
    }

    // Normalize and cap at 5
    colors = colors
      .map(c => (c.startsWith('#') ? c.toUpperCase() : `#${c.toUpperCase()}`))
      .filter(c => /^#[0-9A-F]{6}$/.test(c))
      .slice(0, 5);

    if (colors.length < 5) {
      // Pad with neutrals if needed
      const pad = ['#0F172A', '#3B82F6', '#22D3EE', '#E2E8F0', '#FFFFFF'];
      colors = [...colors, ...pad].slice(0, 5);
    }

    return NextResponse.json({ colors });
  } catch (e: any) {
    console.error('Palette generation error:', e);
    return NextResponse.json({ error: 'Failed to generate palette' }, { status: 500 });
  }
}

