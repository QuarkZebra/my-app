// API Route: POST /api/310s/save
//
// Saves a quiz result to the quiz_answers table in Supabase.
// Requires the user to be authenticated (reads session from cookies).
// Body: { topic, question_text, user_answer, correct_answer, confidence_level, is_correct }

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/app/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()

  // Get the logged-in user from their session cookie
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()

  const { error } = await supabase.from('quiz_answers').insert({
    user_id: user.id,
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
