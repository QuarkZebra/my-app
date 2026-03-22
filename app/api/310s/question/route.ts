// API Route: GET /api/310s/question
// Accepts optional query params: blockId, blockName, blockSub
// Returns JSON: { topic, question, options: [{id, text, sub}], correct, explanation }

import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic()

const BLOCK_TOPICS: Record<string, string[]> = {
  A: ['shop safety procedures', 'personal protective equipment', 'WHMIS and SDS', 'hand and power tools', 'vehicle hoisting and lifting', 'documentation and work orders'],
  B: ['engine diagnosis and repair', 'fuel system diagnosis', 'ignition system diagnosis', 'diesel engine operation', 'cooling system service', 'lubrication systems', 'engine performance', 'intake and exhaust systems'],
  C: ['CAN bus network operation', 'OBD-II diagnostics', 'module communication protocols', 'network diagnostic tools', 'scan tool data interpretation', 'serial data communication'],
  D: ['automatic transmission diagnosis', 'manual transmission service', 'clutch system diagnosis', 'differential and axle service', 'driveshaft and CV joint service', 'transfer case operation', 'four-wheel drive systems'],
  E: ['automotive electrical circuits', 'battery testing and charging', 'charging system diagnosis', 'starting system diagnosis', 'lighting and wiring', 'HVAC system diagnosis', 'air conditioning service', 'body electrical systems'],
  F: ['brake system diagnosis', 'ABS and stability control', 'power steering diagnosis', 'suspension alignment', 'tire wear diagnosis', 'wheel bearing service', 'steering system inspection'],
  G: ['airbag and SRS systems', 'passive restraint systems', 'body panel repair', 'glass and trim service', 'door and latch mechanisms'],
  H: ['hybrid vehicle systems', 'electric vehicle operation', 'high-voltage safety procedures', 'regenerative braking', 'HEV battery management', 'EV charging systems'],
}

export async function GET(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const blockId = searchParams.get('blockId') || 'B'
  const blockName = searchParams.get('blockName') || 'Engine & engine support'
  const blockSub = searchParams.get('blockSub') || 'Gasoline & diesel diagnosis/repair'

  const topics = BLOCK_TOPICS[blockId] || BLOCK_TOPICS['B']
  const topicList = topics.map(t => `- ${t}`).join('\n')

  const prompt = `You are generating a practice question for the Canadian Red Seal 310S Automotive Service Technician certification exam.

Generate ONE multiple choice question for exam Block ${blockId}: ${blockName} (${blockSub}).

This block covers topics such as:
${topicList}

The question must be about automotive service, NOT electrical work or industrial topics. This is the 310S Automotive Service Technician exam.

Respond with ONLY valid JSON (no markdown, no extra text) in this exact format:
{
  "topic": "short specific topic name, e.g. 'Fuel Injector Diagnosis'",
  "question": "the full question text — practical, exam-style",
  "options": [
    { "id": "A", "text": "the answer text", "sub": "a brief clarifying detail or specification" },
    { "id": "B", "text": "the answer text", "sub": "a brief clarifying detail or specification" },
    { "id": "C", "text": "the answer text", "sub": "a brief clarifying detail or specification" },
    { "id": "D", "text": "the answer text", "sub": "a brief clarifying detail or specification" }
  ],
  "correct": "A",
  "explanation": "2-3 sentence explanation of why the correct answer is right, referencing the relevant automotive principle or standard"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = message.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type')

    const data = JSON.parse(block.text)
    return NextResponse.json(data)
  } catch (err) {
    console.error('Question generation error:', err)
    return NextResponse.json({ error: 'Failed to generate question.' }, { status: 500 })
  }
}
