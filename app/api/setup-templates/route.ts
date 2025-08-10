import { NextRequest, NextResponse } from 'next/server';
import { setupSlideTemplates } from '@/lib/setup-templates';

/**
 * API endpoint to initialize slide templates in Supabase
 * Run this once to set up the database with example templates
 * GET /api/setup-templates
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Initializing slide templates...');
    
    const template = await setupSlideTemplates();
    
    if (template) {
      return NextResponse.json({
        success: true,
        message: 'Slide templates initialized successfully',
        template: {
          id: template.id,
          name: template.name,
          theme: template.theme
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to initialize slide templates'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Template setup error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Error setting up slide templates',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}