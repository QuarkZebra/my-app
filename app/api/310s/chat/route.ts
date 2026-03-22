// API Route: POST /api/310s/chat
//
// Streaming chat endpoint for the AI tutor feature.
// We bypass the ai package's AnthropicStream adapter (version conflict) and
// instead pipe the Anthropic SDK's native stream directly into a Web ReadableStream.
// The client-side useChat hook (ai/react) can consume plain text streams.
//
// The client sends: { messages: [...], questionContext: "..." }
//
// TODO: Make sure ANTHROPIC_API_KEY is set in your .env.local file.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const { messages, questionContext } = await req.json()

  const systemPrompt = `You are an expert tutor for the Canadian Red Seal 310S Industrial Electrician exam.
You explain concepts clearly and practically, connecting theory to real-world electrical work.
When possible, reference the Canadian Electrical Code (CEC) by rule number.
Keep your responses focused and reasonably concise — this student is studying, not reading a textbook.

${questionContext ? `Current question context:\n${questionContext}` : ''}

Help the student deeply understand the concepts involved, not just memorize the answer.`

  // Start an Anthropic stream using the .stream() helper
  const anthropicStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    // The useChat hook sends messages in { role, content } format — Anthropic accepts this directly
    messages,
  })

  // The ai@3 useChat hook expects a specific stream format called "data stream protocol".
  // Each chunk is a line like: 0:"text here"\n
  // where "0:" signals a text chunk. We produce this format manually.
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Iterate over the Anthropic stream events as they arrive
        for await (const event of anthropicStream) {
          // We only care about text delta events
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            // Format: 0:"escaped text"\n  (the ai@3 data stream protocol for text chunks)
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
      // This header tells the useChat hook the stream is using the data stream protocol
      'x-vercel-ai-data-stream': 'v1',
    },
  })
}
