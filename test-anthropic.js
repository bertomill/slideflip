// Test script to verify Anthropic API integration
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '.env.local' });

console.log('Testing Anthropic API integration...');
console.log('API Key present:', process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not found in environment variables');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testAPI() {
  try {
    console.log('Making test API call to Claude...');
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'Test connection. Just respond with "Connection successful!"'
        }
      ]
    });

    console.log('✅ API call successful!');
    console.log('Response:', response.content[0].text);
    console.log('Model used:', response.model);
    
  } catch (error) {
    console.error('❌ API call failed:', error.message);
    process.exit(1);
  }
}

testAPI();