import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Log all parameters for debugging
  const params = Object.fromEntries(searchParams.entries())
  console.log('OAuth callback parameters:', params)
  
  return NextResponse.json({
    message: 'OAuth callback test',
    parameters: params,
    timestamp: new Date().toISOString()
  })
} 