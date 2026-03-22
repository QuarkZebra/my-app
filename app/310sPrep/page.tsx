'use client'

// ── 310S Prep Quiz Page ─────────────────────────────────────────────────────
//
// Protected by middleware (same auth as the rest of the app).
// Fetches a question from /api/310s/question (Anthropic API).
// Lets you rate your confidence on each answer option with a slider.
// Submits your highest-confidence pick, shows result + AI explanation.
// Opens a full-screen AI tutor chat for deeper learning.

import { useState, useEffect, useRef } from 'react'
import { useChat } from 'ai/react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

type Option = {
  id: string    // "A" | "B" | "C" | "D"
  text: string  // The answer text
  sub: string   // Sub-description / code reference
}

type Question = {
  topic: string
  question: string
  options: Option[]
  correct: string       // "A" | "B" | "C" | "D"
  explanation: string
}

// ── Helper: Confidence label based on slider value ───────────────────────────

function confidenceLabel(value: number): string {
  if (value === 0) return 'Slide to set confidence'
  if (value <= 25) return 'Maybe'
  if (value <= 50) return 'Probably'
  if (value <= 75) return 'Confident'
  return 'Certain!'
}

// ── Helper: Purple tint opacity based on slider value ────────────────────────
// Returns a CSS rgba string. At 100% confidence it reaches ~33% opacity purple.

function purpleTint(value: number): string {
  if (value === 0) return 'transparent'
  return `rgba(109, 40, 217, ${value / 300})`
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Prep310sPage() {
  // ── State ──────────────────────────────────────────────────────────────────

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // One confidence value per option (0–100), keyed by option id ("A"/"B"/etc)
  const [confidences, setConfidences] = useState<Record<string, number>>({
    A: 0, B: 0, C: 0, D: 0,
  })

  // Whether the user has moved any slider at all (enables submit button)
  const [touched, setTouched] = useState(false)

  // Whether the user has submitted their answer
  const [submitted, setSubmitted] = useState(false)

  // Whether to show the full-screen tutor chat overlay
  const [showTutor, setShowTutor] = useState(false)

  // Whether the save API call is in progress
  const [saving, setSaving] = useState(false)

  // Ref for auto-scrolling the chat to the bottom
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Derived values ─────────────────────────────────────────────────────────

  // Find the option with the highest confidence score.
  // Sort by confidence descending, take the first one.
  const sortedByConfidence = Object.entries(confidences).sort(
    (a, b) => b[1] - a[1]
  )
  const [topOptionId, topConfidence] = sortedByConfidence[0]

  // The "selected" answer is only valid if the user actually moved a slider
  const selectedAnswer = touched ? topOptionId : null
  const isCorrect = selectedAnswer === question?.correct

  // Context string passed to the AI tutor so it knows what we're discussing
  const questionContext = question
    ? `Topic: ${question.topic}. Question: ${question.question}. ` +
      `Correct answer: ${question.correct} — ${question.options.find(o => o.id === question.correct)?.text}. ` +
      `Explanation: ${question.explanation}`
    : ''

  // ── Tutor chat (Vercel AI SDK useChat hook) ────────────────────────────────
  // useChat handles the message list, input state, streaming responses,
  // and sends POST requests to /api/310s/chat automatically.
  // We pass `body` so our route handler gets questionContext on every request.

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: sendChatMessage,
    isLoading: tutorLoading,
  } = useChat({
    api: '/api/310s/chat',
    body: { questionContext },
  })

  // ── Effects ────────────────────────────────────────────────────────────────

  // Fetch a question when the component first loads
  useEffect(() => {
    fetchQuestion()
  }, [])

  // Scroll chat to bottom whenever a new message arrives
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function fetchQuestion() {
    setLoading(true)
    setError(null)
    setSubmitted(false)
    setTouched(false)
    setConfidences({ A: 0, B: 0, C: 0, D: 0 })

    try {
      const res = await fetch('/api/310s/question')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to fetch question')
      }
      const data = await res.json()
      setQuestion(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Called when any confidence slider moves
  function handleSliderChange(optionId: string, value: number) {
    setConfidences(prev => ({ ...prev, [optionId]: value }))
    if (!touched) setTouched(true)
  }

  // Called when user clicks Submit
  async function handleSubmit() {
    if (!question || !selectedAnswer) return
    setSubmitted(true)

    // Save result to Supabase in the background (non-blocking)
    setSaving(true)
    try {
      await fetch('/api/310s/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: question.topic,
          question_text: question.question,
          user_answer: selectedAnswer,
          correct_answer: question.correct,
          confidence_level: topConfidence,
          is_correct: isCorrect,
        }),
      })
    } catch (err) {
      // Save failure shouldn't block the UI
      console.error('Failed to save quiz result:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⚡</div>
          <p style={{ color: '#9ca3af' }}>Generating your question...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <button
            onClick={fetchQuestion}
            className="px-6 py-2 rounded-lg text-white font-semibold"
            style={{ backgroundColor: '#7c3aed' }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#111827', color: '#e5e7eb' }}>
      {/* ── Tutor Chat Overlay ─────────────────────────────────────────────── */}
      {/* Full-screen panel that slides over the quiz when "Explore with AI" is clicked */}
      {showTutor && (
        <TutorPanel
          messages={messages}
          input={input}
          onInputChange={handleInputChange}
          onSubmit={sendChatMessage}
          isLoading={tutorLoading}
          chatEndRef={chatEndRef}
          question={question}
          onClose={() => setShowTutor(false)}
        />
      )}

      {/* ── Main Quiz Content ──────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link
          href="/"
          style={{ color: '#6b7280' }}
          className="text-sm hover:text-gray-400 transition-colors mb-6 inline-block"
        >
          ← Home
        </Link>

        {/* ── Question Card ──────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-6 mb-6 border"
          style={{ backgroundColor: '#1f2937', borderColor: '#374151' }}
        >
          {/* Topic pill */}
          <span
            className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full mb-4 inline-block"
            style={{ backgroundColor: 'rgba(124, 58, 237, 0.2)', color: '#a78bfa' }}
          >
            {question.topic}
          </span>

          <p className="text-lg font-medium leading-relaxed" style={{ color: '#f3f4f6' }}>
            {question.question}
          </p>
        </div>

        {/* ── Answer Option Cards ────────────────────────────────────────── */}
        <div className="space-y-3 mb-6">
          {question.options.map((option) => {
            const confidence = confidences[option.id]
            const isThisCorrect = option.id === question.correct
            const isThisSelected = option.id === selectedAnswer

            return (
              <OptionCard
                key={option.id}
                option={option}
                confidence={confidence}
                submitted={submitted}
                isCorrect={isThisCorrect}
                isSelected={isThisSelected}
                onSliderChange={(val) => handleSliderChange(option.id, val)}
              />
            )
          })}
        </div>

        {/* ── Submit Button ──────────────────────────────────────────────── */}
        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={!touched}
            className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all"
            style={{
              backgroundColor: touched ? '#7c3aed' : '#374151',
              cursor: touched ? 'pointer' : 'not-allowed',
              opacity: touched ? 1 : 0.5,
            }}
          >
            {touched
              ? `Submit — going with ${selectedAnswer}`
              : 'Move a slider to submit'}
          </button>
        )}

        {/* ── Result Banner (shown after submit) ────────────────────────── */}
        {submitted && (
          <div
            className="rounded-xl p-5 mb-4 border"
            style={{
              backgroundColor: isCorrect
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              borderColor: isCorrect ? '#10b981' : '#ef4444',
            }}
          >
            <p className="font-bold text-xl mb-2">
              {isCorrect ? '✅ Correct!' : `❌ Not quite — the answer was ${question.correct}`}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>
              {question.explanation}
            </p>
          </div>
        )}

        {/* ── Post-Submit Buttons ────────────────────────────────────────── */}
        {submitted && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowTutor(true)}
              className="flex-1 py-3 rounded-xl font-semibold text-white border transition-colors"
              style={{ borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.15)' }}
            >
              Explore Further with AI Tutor
            </button>
            <button
              onClick={fetchQuestion}
              className="flex-1 py-3 rounded-xl font-bold text-white transition-colors"
              style={{ backgroundColor: '#7c3aed' }}
            >
              Next Question →
            </button>
          </div>
        )}

        {/* Small save indicator */}
        {saving && (
          <p className="text-center text-xs mt-3" style={{ color: '#6b7280' }}>
            Saving result...
          </p>
        )}
      </div>
    </div>
  )
}

// ── OptionCard Component ─────────────────────────────────────────────────────
// Each answer option with its confidence slider.
// Extracted into its own component to keep the main component readable.

type OptionCardProps = {
  option: Option
  confidence: number
  submitted: boolean
  isCorrect: boolean    // Is THIS option the right answer?
  isSelected: boolean   // Did the user pick THIS option (highest confidence)?
  onSliderChange: (value: number) => void
}

function OptionCard({
  option,
  confidence,
  submitted,
  isCorrect,
  isSelected,
  onSliderChange,
}: OptionCardProps) {
  // The card's border changes after submission to show right/wrong
  const borderColor = submitted
    ? isCorrect
      ? '#10b981'   // green — this was the right answer
      : isSelected
        ? '#ef4444' // red — user picked this but it's wrong
        : '#374151' // neutral — not selected, not correct
    : '#374151'     // pre-submit: always neutral border

  return (
    <div
      className="rounded-xl p-4 border transition-all duration-300"
      style={{
        backgroundColor: '#1f2937',
        borderColor,
        // Overlay a purple tint that gets more intense as confidence increases.
        // We use a box-shadow trick + background layer to stack colors.
        // The background is a gradient from the purple tint over the base card color.
        background: `linear-gradient(${purpleTint(confidence)}, ${purpleTint(confidence)}), #1f2937`,
        backgroundBlendMode: 'normal',
      }}
    >
      {/* Option label + text */}
      <div className="flex items-start gap-3 mb-3">
        {/* The A/B/C/D badge */}
        <span
          className="font-bold text-sm w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: '#374151', color: '#a78bfa' }}
        >
          {option.id}
        </span>

        <div className="flex-1">
          {/* Answer text */}
          <p className="font-semibold" style={{ color: '#f3f4f6' }}>
            {option.text}
          </p>
          {/* Sub-description / CEC reference */}
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            {option.sub}
          </p>
        </div>

        {/* Post-submit indicator */}
        {submitted && (
          <span className="text-xl flex-shrink-0">
            {isCorrect ? '✅' : isSelected ? '❌' : ''}
          </span>
        )}
      </div>

      {/* Confidence slider — disabled after submission */}
      <div className="mt-1">
        <input
          type="range"
          min={0}
          max={100}
          value={confidence}
          disabled={submitted}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          className="confidence-slider w-full"
          // The track is a gradient: purple fills from left up to current value,
          // then dark gray for the remaining track.
          style={{
            background: `linear-gradient(to right, #7c3aed ${confidence}%, #374151 ${confidence}%)`,
            opacity: submitted ? 0.5 : 1,
          }}
        />

        {/* Label row: confidence word on left, percentage on right */}
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs" style={{ color: confidence > 0 ? '#a78bfa' : '#6b7280' }}>
            {confidenceLabel(confidence)}
          </span>
          {confidence > 0 && (
            <span className="text-xs font-mono" style={{ color: '#a78bfa' }}>
              {confidence}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── TutorPanel Component ─────────────────────────────────────────────────────
// Full-screen chat overlay. Uses the useChat state passed down from the parent
// (so the message history is preserved when the user toggles the panel).

type TutorPanelProps = {
  messages: ReturnType<typeof useChat>['messages']
  input: string
  onInputChange: ReturnType<typeof useChat>['handleInputChange']
  onSubmit: ReturnType<typeof useChat>['handleSubmit']
  isLoading: boolean
  chatEndRef: React.RefObject<HTMLDivElement | null>
  question: Question
  onClose: () => void
}

function TutorPanel({
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  chatEndRef,
  question,
  onClose,
}: TutorPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: '#111827' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: '#374151' }}
      >
        <button
          onClick={onClose}
          className="font-semibold transition-colors"
          style={{ color: '#9ca3af' }}
        >
          ← Back
        </button>
        <div className="flex-1">
          <p className="font-bold" style={{ color: '#f3f4f6' }}>AI Tutor</p>
          <p className="text-xs" style={{ color: '#6b7280' }}>{question.topic}</p>
        </div>
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: '#10b981' }}
        />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* If no messages yet, show a context-aware welcome prompt */}
        {messages.length === 0 && (
          <div
            className="rounded-xl px-4 py-3 max-w-sm"
            style={{ backgroundColor: '#1f2937', color: '#d1d5db' }}
          >
            <p className="text-sm">
              Hi! I&apos;m your 310S tutor. Ask me anything about{' '}
              <strong style={{ color: '#a78bfa' }}>{question.topic}</strong> or
              the question you just answered.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="rounded-xl px-4 py-3 max-w-xs sm:max-w-sm text-sm leading-relaxed"
              style={{
                // User messages: purple bubble; assistant messages: dark card
                backgroundColor: msg.role === 'user' ? '#7c3aed' : '#1f2937',
                color: '#f3f4f6',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator — shown while waiting for the AI to respond */}
        {isLoading && (
          <div className="flex justify-start">
            <div
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: '#1f2937' }}
            >
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      backgroundColor: '#6b7280',
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Invisible div at the bottom that we scroll into view */}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={onSubmit}
        className="flex gap-2 px-4 py-3 border-t flex-shrink-0"
        style={{ borderColor: '#374151' }}
      >
        <input
          type="text"
          value={input}
          onChange={onInputChange}
          placeholder="Ask about this topic..."
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          style={{
            backgroundColor: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151',
          }}
          // Auto-focus when the tutor panel opens
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-3 rounded-xl font-semibold text-white transition-opacity"
          style={{
            backgroundColor: '#7c3aed',
            opacity: !input.trim() || isLoading ? 0.5 : 1,
            cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
