// API Route: POST /api/310s/chat
// Streaming chat endpoint for the AI tutor.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const { messages, questionContext } = await req.json()

  const systemPrompt = `You are an expert tutor for the Canadian Red Seal 310S Automotive Service Technician exam.
You explain automotive concepts clearly and practically, connecting theory to real-world service work.
When possible, reference relevant OEM procedures, torque specs, or diagnostic standards.
Keep your responses focused and reasonably concise — this student is studying, not reading a textbook.

${questionContext ? `Current question context:\n${questionContext}` : ''}

Help the student deeply understand the automotive concepts involved, not just memorize the answer. Topics include engine diagnosis, electrical systems, brakes, suspension, transmission, HVAC, hybrid/EV systems, and shop safety.`

  const anthropicStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = `0:${JSON.stringify(event.delta.text)}\n`
            controller.enqueue(encoder.encode(chunk))
          }
        }
      } catch (err) {
        console.error('Streaming error:', err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
    },
  })
}
