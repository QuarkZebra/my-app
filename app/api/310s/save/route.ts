// API Route: POST /api/310s/save
// Saves a quiz result to the quiz_answers table in Supabase.
// Supports both cookie-based auth (web) and Bearer token auth (mobile).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/app/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  let userId: string | null = null

  // ── Try Bearer token first (mobile app) ──────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) userId = user.id
  }

  // ── Fall back to cookie-based auth (web app) ──────────────────────────────
  if (!userId) {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  }

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()

  // Use service role or anon client to insert with the resolved user_id
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { error } = await supabase.from('quiz_answers').insert({
    user_id: userId,
    topic: body.topic,
    question_text: body.question_text,
    user_answer: body.user_answer,
    correct_answer: body.correct_answer,
    confidence_level: body.confidence_level,
    is_correct: body.is_correct,
  })

  if (error) {
    console.error('Save quiz answer error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}