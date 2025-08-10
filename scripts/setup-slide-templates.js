/**
 * Script to set up slide templates in Supabase
 * Run this once to initialize the database with example templates
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSlideTemplates() {
  try {
    console.log('Setting up slide templates...');

    // Read the template HTML file
    const templatePath = path.join(__dirname, '../templates/slide-template-basic.html');
    const htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Check if table exists and create if needed
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'slide_templates');

    if (tablesError) {
      console.error('Error checking tables:', tablesError);
      return;
    }

    // Create the template record
    const { data, error } = await supabase
      .from('slide_templates')
      .upsert([
        {
          name: 'Professional Gradient Template',
          description: 'A modern professional slide template with gradient background, glass morphism effects, and clean typography. Perfect for business presentations and data visualization.',
          theme: 'Professional',
          html_content: htmlContent,
          css_scoped: true,
          aspect_ratio: '16:9',
          tags: ['professional', 'gradient', 'modern', 'business', 'glass-morphism']
        }
      ])
      .select();

    if (error) {
      console.error('Error inserting template:', error);
      return;
    }

    console.log('✅ Successfully set up slide templates:', data);
    
    // Verify the template was inserted
    const { data: templates, error: fetchError } = await supabase
      .from('slide_templates')
      .select('*')
      .limit(5);

    if (fetchError) {
      console.error('Error fetching templates:', fetchError);
      return;
    }

    console.log(`📊 Total templates in database: ${templates.length}`);
    templates.forEach(template => {
      console.log(`  - ${template.name} (${template.theme})`);
    });

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupSlideTemplates();