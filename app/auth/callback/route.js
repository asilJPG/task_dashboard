import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  if (code) {
    // Exchange code if needed
  }
  
  return NextResponse.redirect(new URL(next, request.url))
}
