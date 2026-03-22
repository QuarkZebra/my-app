// API Route: GET /api/310s/question
//
// Calls the Anthropic API to generate a fresh Red Seal 310S exam question.
// Returns JSON: { topic, question, options: [{id, text, sub}], correct, explanation }
//
// TODO: Make sure ANTHROPIC_API_KEY is set in your .env.local file.

import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

// Initialize the Anthropic client.
// It automatically reads from process.env.ANTHROPIC_API_KEY.
const anthropic = new Anthropic()

const PROMPT = `You are generating a practice question for the Canadian Red Seal 310S Industrial Electrician certification exam.

Generate ONE multiple choice question. The question should cover a topic from the 310S exam such as:
- Canadian Electrical Code (CEC) rules and calculations
- Motor controls and starters
- Transformers (sizing, connections, calculations)
- Power distribution systems
- Conduit fill calculations
- Grounding and bonding
- Overcurrent protection
- Three-phase power calculations
- PLC basics
- Electrical safety

Respond with ONLY valid JSON (no markdown, no extra text) in this exact format:
{
  "topic": "short topic name, e.g. 'Motor Controls'",
  "question": "the full question text",
  "options": [
    { "id": "A", "text": "the answer text", "sub": "a brief clarifying detail or code reference" },
    { "id": "B", "text": "the answer text", "sub": "a brief clarifying detail or code reference" },
    { "id": "C", "text": "the answer text", "sub": "a brief clarifying detail or code reference" },
    { "id": "D", "text": "the answer text", "sub": "a brief clarifying detail or code reference" }
  ],
  "correct": "A",
  "explanation": "2-3 sentence explanation of why the correct answer is right, with a CEC reference if applicable"
}`

export async function GET() {
  // Make sure the API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set. Add it to your .env.local file.' },
      { status: 500 }
    )
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: PROMPT }],
    })

    // The response content is an array; the first item should be a text block
    const block = message.content[0]
    if (block.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic')
    }

    // Parse the JSON string Claude returned
    const data = JSON.parse(block.text)

    return NextResponse.json(data)
  } catch (err) {
    console.error('Question generation error:', err)
    return NextResponse.json(
      { error: 'Failed to generate question. Check server logs.' },
      { status: 500 }
    )
  }
}
