import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Generate a brand color palette (5 colors) from a short style prompt using Anthropic Claude.
 * Returns array of hex strings. No images produced.
 * Requires ANTHROPIC_API_KEY env var.
 */
export async function POST(req: NextRequest) {
  try {
    console.log('Color palette generation API called');
    const { prompt } = await req.json();
    console.log('Received prompt:', prompt);
    
    if (!prompt || typeof prompt !== 'string') {
      console.log('Invalid prompt provided');
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('Anthropic API key exists:', !!apiKey);
    
    if (!apiKey) {
      console.error('No Anthropic API key found');
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });

    const system = `You are a senior brand designer. Given a short brief, output a JSON array of exactly 5 accessible brand colors in hex (uppercase, with leading #). Each color should have strong contrast when paired appropriately.
Rules:
- Return ONLY valid JSON array of 5 hex strings, e.g. ["#0F172A", "#3B82F6", "#22D3EE", "#E2E8F0", "#FFFFFF"]
- No prose. No keys. No markdown.`;

    console.log('Making Anthropic API call...');
    const completion = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      temperature: 0.5,
      system: system,
      messages: [
        { role: 'user', content: `Brief: ${prompt}` },
      ],
    });
    
    console.log('Anthropic API call successful');

    const raw = completion.content[0]?.text?.trim() || '[]';
    console.log('Raw Anthropic response:', raw);
    
    // Attempt to parse, fallback to filtering hex-like strings
    let colors: string[] = [];
    try {
      colors = JSON.parse(raw);
      console.log('Parsed colors from JSON:', colors);
    } catch {
      console.log('JSON parsing failed, extracting hex colors from text');
      const matches = raw.match(/#[0-9A-Fa-f]{6}/g) || [];
      colors = matches.slice(0, 5).map(s => s.toUpperCase());
      console.log('Extracted hex colors:', colors);
    }

    // Normalize and cap at 5
    colors = colors
      .map(c => (c.startsWith('#') ? c.toUpperCase() : `#${c.toUpperCase()}`))
      .filter(c => /^#[0-9A-F]{6}$/.test(c))
      .slice(0, 5);

    console.log('Normalized colors:', colors);

    if (colors.length < 5) {
      console.log('Padding with default colors');
      // Pad with neutrals if needed
      const pad = ['#0F172A', '#3B82F6', '#22D3EE', '#E2E8F0', '#FFFFFF'];
      colors = [...colors, ...pad].slice(0, 5);
    }

    console.log('Final colors to return:', colors);
    return NextResponse.json({ colors });
  } catch (e: any) {
    console.error('Palette generation error:', e);
    console.error('Error stack:', e.stack);
    return NextResponse.json({ 
      error: 'Failed to generate palette', 
      details: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined 
    }, { status: 500 });
  }
}

