'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from 'ai/react'
import { createClient } from '@/app/lib/supabase'

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#0d0f14',
  surface: '#141720',
  surface2: '#1b1f2e',
  surface3: '#222640',
  border: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.12)',
  accent: '#2d6ef7',
  accent2: '#4f8aff',
  accentGlow: 'rgba(45,110,247,0.2)',
  text: '#eef0f8',
  muted: '#6b748f',
  muted2: '#8a94b0',
  success: '#1ec776',
  successBg: 'rgba(30,199,118,0.1)',
  danger: '#f04f4f',
  dangerBg: 'rgba(240,79,79,0.1)',
  warn: '#e8a020',
  warnBg: 'rgba(232,160,32,0.1)',
}

// ── Types ────────────────────────────────────────────────────────────────────
type View = 'home' | 'quiz-config' | 'quiz-active' | 'learn' | 'progress' | 'ask'
type Option = { id: string; text: string; sub: string }
type Question = { topic: string; question: string; options: Option[]; correct: string; explanation: string }

// ── Exam block definitions ───────────────────────────────────────────────────
const BLOCKS = [
  { id: 'A', name: 'Common occupational skills',    sub: 'Safety, tools, documentation',       examQ: 9,  high: false },
  { id: 'B', name: 'Engine & engine support',        sub: 'Gasoline & diesel diagnosis/repair',  examQ: 22, high: true  },
  { id: 'C', name: 'Vehicle module communications', sub: 'CAN bus, networking systems',          examQ: 12, high: false },
  { id: 'D', name: 'Driveline systems',             sub: 'Transmission, drivetrain',             examQ: 17, high: true  },
  { id: 'E', name: 'Electrical & comfort control',  sub: 'Electrical systems & HVAC',            examQ: 23, high: true  },
  { id: 'F', name: 'Steering, suspension & braking',sub: 'Brakes, tires, wheels, hubs',          examQ: 23, high: true  },
  { id: 'G', name: 'Restraint systems & body',      sub: 'Airbags, SRS, body, trim',             examQ: 10, high: false },
  { id: 'H', name: 'Hybrid & electric vehicles',    sub: 'HEV/EV diagnosis & repair',            examQ: 9,  high: false },
]
const TOTAL_EXAM = 125
const DEFAULT_TOTAL = 20

// ── Helpers ──────────────────────────────────────────────────────────────────
function proportionalCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  let assigned = 0
  BLOCKS.forEach(b => {
    const n = Math.round((b.examQ / TOTAL_EXAM) * DEFAULT_TOTAL)
    counts[b.id] = n
    assigned += n
  })
  const diff = DEFAULT_TOTAL - assigned
  if (diff !== 0) counts['B'] = Math.max(0, (counts['B'] || 0) + diff)
  return counts
}

function confidenceLabel(v: number): string {
  if (v === 0) return 'Slide to set confidence'
  if (v <= 25) return 'Maybe'
  if (v <= 50) return 'Probably'
  if (v <= 75) return 'Confident'
  return 'Certain!'
}

function purpleTint(v: number): string {
  if (v === 0) return 'transparent'
  return `rgba(109, 40, 217, ${v / 300})`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Prep310sPage() {
  const [view, setView] = useState<View>('home')

  // Quiz config
  const [blockCounts, setBlockCounts] = useState<Record<string, number>>(proportionalCounts)
  const [examProp, setExamProp] = useState(true)
  const [focusWeak, setFocusWeak] = useState(false)

  // Quiz session
  const [quizPlan, setQuizPlan] = useState<string[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [currentQ, setCurrentQ] = useState<Question | null>(null)
  const [loadingQ, setLoadingQ] = useState(false)
  const [confidences, setConfidences] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 })
  const [touched, setTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quizResults, setQuizResults] = useState<{ block: string; correct: boolean }[]>([])
  const [quizzesTaken, setQuizzesTaken] = useState(0)
  const [showTutor, setShowTutor] = useState(false)

  // Supabase data
  const [statsData, setStatsData] = useState<{ questionsAnswered: number; savedCount: number; accuracy: number | null; bestScore: number | null }>({
    questionsAnswered: 0, savedCount: 0, accuracy: null, bestScore: null,
  })
  const [learnItems, setLearnItems] = useState<any[]>([])
  const [blockProgress, setBlockProgress] = useState<Record<string, { correct: number; total: number }>>({})

  const chatEndRef = useRef<HTMLDivElement>(null)
  const askEndRef = useRef<HTMLDivElement>(null)

  const questionContext = currentQ
    ? `Topic: ${currentQ.topic}. Question: ${currentQ.question}. Correct answer: ${currentQ.correct} — ${currentQ.options.find(o => o.id === currentQ!.correct)?.text}. Explanation: ${currentQ.explanation}`
    : ''

  const { messages: tutorMsgs, input: tutorInput, handleInputChange: tutorInputChange, handleSubmit: sendTutor, isLoading: tutorLoading } = useChat({
    api: '/api/310s/chat',
    body: { questionContext },
  })

  const { messages: askMsgs, input: askInput, handleInputChange: askInputChange, handleSubmit: sendAsk, isLoading: askLoading } = useChat({
    api: '/api/310s/chat',
    body: { questionContext: '' },
  })

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [tutorMsgs])
  useEffect(() => { askEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [askMsgs])

  useEffect(() => {
    if (view === 'home' || view === 'learn' || view === 'progress') {
      loadSupabaseData()
    }
  }, [view])

  async function loadSupabaseData() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!data) return

      const total = data.length
      const correct = data.filter((r: any) => r.is_correct).length
      const wrong = data.filter((r: any) => !r.is_correct)

      // Parse block from topic field: "B: Engine topic" → block = 'B'
      const bp: Record<string, { correct: number; total: number }> = {}
      BLOCKS.forEach(b => { bp[b.id] = { correct: 0, total: 0 } })
      data.forEach((r: any) => {
        const match = r.topic?.match(/^([A-H]): /)
        if (match) {
          const bid = match[1]
          if (bp[bid]) {
            bp[bid].total++
            if (r.is_correct) bp[bid].correct++
          }
        }
      })

      setStatsData({
        questionsAnswered: total,
        savedCount: wrong.length,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
        bestScore: null, // would need session tracking
      })
      setLearnItems(wrong.slice(0, 60))
      setBlockProgress(bp)
    } catch (err) {
      console.error('Supabase load error:', err)
    }
  }

  function applyExamProportional() {
    setBlockCounts(proportionalCounts())
    setExamProp(true)
    setFocusWeak(false)
  }

  function applyFocusWeak() {
    // Weight weak blocks (where DB shows < 70%) more heavily
    const counts: Record<string, number> = {}
    const totalSlots = DEFAULT_TOTAL
    BLOCKS.forEach(b => {
      const bp = blockProgress[b.id]
      const pct = bp && bp.total > 0 ? Math.round((bp.correct / bp.total) * 100) : 70
      counts[b.id] = pct < 70 ? 3 : 1
    })
    // Normalize to DEFAULT_TOTAL
    const sum = Object.values(counts).reduce((a, b) => a + b, 0)
    BLOCKS.forEach(b => {
      counts[b.id] = Math.max(0, Math.round((counts[b.id] / sum) * totalSlots))
    })
    setBlockCounts(counts)
  }

  function startQuiz() {
    const plan: string[] = []
    BLOCKS.forEach(b => {
      for (let i = 0; i < (blockCounts[b.id] || 0); i++) plan.push(b.id)
    })
    if (plan.length === 0) return
    const shuffled = shuffle(plan)
    setQuizPlan(shuffled)
    setQuizIndex(0)
    setQuizResults([])
    setCurrentQ(null)
    setView('quiz-active')
    setQuizzesTaken(prev => prev + 1)
    fetchQuestion(shuffled[0])
  }

  async function fetchQuestion(blockId: string) {
    setLoadingQ(true)
    setCurrentQ(null)
    setConfidences({ A: 0, B: 0, C: 0, D: 0 })
    setTouched(false)
    setSubmitted(false)
    setShowTutor(false)

    const block = BLOCKS.find(b => b.id === blockId)!
    try {
      const res = await fetch(
        `/api/310s/question?blockId=${blockId}&blockName=${encodeURIComponent(block.name)}&blockSub=${encodeURIComponent(block.sub)}`
      )
      if (!res.ok) throw new Error('API error')
      setCurrentQ(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingQ(false)
    }
  }

  const sortedByConf = Object.entries(confidences).sort((a, b) => b[1] - a[1])
  const [topId, topConf] = sortedByConf[0]
  const selected = touched ? topId : null
  const isCorrect = selected === currentQ?.correct

  async function handleSubmit() {
    if (!currentQ || !selected) return
    setSubmitted(true)
    setQuizResults(prev => [...prev, { block: quizPlan[quizIndex], correct: selected === currentQ!.correct }])
    setSaving(true)
    try {
      await fetch('/api/310s/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `${quizPlan[quizIndex]}: ${currentQ.topic}`,
          question_text: currentQ.question,
          user_answer: selected,
          correct_answer: currentQ.correct,
          confidence_level: topConf,
          is_correct: selected === currentQ.correct,
        }),
      })
    } catch {}
    setSaving(false)
  }

  function nextQuestion() {
    const next = quizIndex + 1
    if (next >= quizPlan.length) {
      setView('progress')
      loadSupabaseData()
    } else {
      setQuizIndex(next)
      fetchQuestion(quizPlan[next])
    }
  }

  const totalQ = Object.values(blockCounts).reduce((a, b) => a + b, 0)

  // ── Nav helper ─────────────────────────────────────────────────────────────
  const activeTab =
    view === 'home' ? 'home' :
    view === 'quiz-config' || view === 'quiz-active' ? 'quiz' :
    view === 'learn' ? 'learn' :
    view === 'progress' ? 'progress' : 'ask'

  const navItems = [
    { id: 'home', label: 'Home', target: 'home' as View },
    { id: 'quiz', label: 'Quiz', target: 'quiz-config' as View },
    { id: 'learn', label: 'Learn', target: 'learn' as View },
    { id: 'progress', label: 'Progress', target: 'progress' as View },
    { id: 'ask', label: 'Ask', target: 'ask' as View },
  ]

  // ── Session score (for progress view this session) ─────────────────────────
  const sessionCorrect = quizResults.filter(r => r.correct).length
  const sessionScore = quizResults.length > 0 ? Math.round((sessionCorrect / quizResults.length) * 100) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: "'Barlow', sans-serif", fontSize: 15, lineHeight: 1.6 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        *,:before,:after{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:#0d0f14}
        ::-webkit-scrollbar-thumb{background:#222640;border-radius:3px}
        .nav-btn{transition:all 0.15s;border:none;cursor:pointer;font-family:'Barlow',sans-serif}
        .nav-btn:hover{color:#eef0f8!important;background:#1b1f2e!important}
        .action-card{transition:all 0.2s;position:relative;overflow:hidden;cursor:pointer}
        .action-card:hover{border-color:rgba(79,138,255,0.35)!important;transform:translateY(-2px)}
        .action-card .ac-arrow{transition:all 0.2s;color:#222640}
        .action-card:hover .ac-arrow{color:#4f8aff;right:12px!important}
        .gen-btn{transition:all 0.15s}
        .gen-btn:hover:not(:disabled){background:#4f8aff!important;transform:translateY(-1px)}
        .reset-btn{transition:color 0.15s}
        .reset-btn:hover{color:#eef0f8!important}
        .sw-track{position:absolute;inset:0;border-radius:12px;background:#222640;border:1px solid rgba(255,255,255,0.12);cursor:pointer;transition:all 0.2s}
        .sw-track::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#6b748f;top:3px;left:3px;transition:all 0.2s}
        input[type=checkbox]:checked+.sw-track{background:#2d6ef7;border-color:#2d6ef7}
        input[type=checkbox]:checked+.sw-track::after{left:21px;background:#fff}
        input[type=range]{width:100%;height:4px;-webkit-appearance:none;appearance:none;border-radius:2px;outline:none;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#4f8aff;border:2px solid #0d0f14;cursor:pointer;transition:transform 0.1s}
        input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.2)}
        .conf-slider::-webkit-slider-thumb{background:#7c3aed!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp 0.22s ease}
        .spinner{display:inline-block;width:20px;height:20px;border:2px solid #222640;border-top-color:#4f8aff;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:8px}
      `}</style>

      {/* Tutor overlay */}
      {showTutor && currentQ && (
        <div className="fade-up" style={{ position: 'fixed', inset: 0, zIndex: 50, background: C.bg, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={() => setShowTutor(false)} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Barlow', sans-serif" }}>← Back</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: C.text }}>AI Tutor</div>
              <div style={{ fontSize: 12, color: C.muted }}>{currentQ.topic}</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, animation: 'pulse 2s infinite' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tutorMsgs.length === 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', maxWidth: 360, color: C.text, fontSize: 14 }}>
                Hi! I'm your 310S automotive tutor. Ask me anything about <strong style={{ color: C.accent2 }}>{currentQ.topic}</strong> or the question you just answered.
              </div>
            )}
            {tutorMsgs.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ background: msg.role === 'user' ? C.accentGlow : C.surface, border: `1px solid ${msg.role === 'user' ? 'rgba(79,138,255,0.2)' : C.border}`, borderRadius: 10, padding: '10px 14px', maxWidth: 480, fontSize: 14, color: C.text, lineHeight: 1.7 }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {tutorLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 150, 300].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: C.muted, animation: `bounce 1s ${d}ms infinite` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendTutor} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <input value={tutorInput} onChange={tutorInputChange} placeholder="Ask about this topic..." autoFocus style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: "'Barlow', sans-serif" }} />
            <button type="submit" disabled={!tutorInput.trim() || tutorLoading} style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '10px 18px', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, cursor: !tutorInput.trim() || tutorLoading ? 'not-allowed' : 'pointer', opacity: !tutorInput.trim() || tutorLoading ? 0.5 : 1 }}>Send</button>
          </form>
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56, borderBottom: `1px solid ${C.border}`, background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: '0.04em' }}>
          🔧 <span><span style={{ color: C.accent2 }}>310S</span> Prep</span>
          <span style={{ fontSize: 10, fontWeight: 600, background: C.accentGlow, color: C.accent2, border: '1px solid rgba(79,138,255,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.08em' }}>RED SEAL</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {navItems.map(item => (
            <button key={item.id} className="nav-btn" onClick={() => setView(item.target)}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, color: activeTab === item.id ? C.accent2 : C.muted, background: activeTab === item.id ? C.accentGlow : 'none' }}>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '36px 28px' }} className="fade-up">

        {/* ── HOME ── */}
        {view === 'home' && (
          <>
            <div style={{ marginBottom: 36, paddingBottom: 36, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.accent2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Ontario 310S · Red Seal</div>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 800, lineHeight: 1.0, letterSpacing: '0.01em', marginBottom: 14 }}>
                Your personal<br /><em style={{ fontStyle: 'normal', color: C.accent2 }}>exam prep</em> hub.
              </h1>
              <p style={{ color: C.muted2, maxWidth: 460, lineHeight: 1.7 }}>AI-generated practice quizzes built around the 8 official exam blocks. Wrong answers are saved automatically — so every quiz makes the next one smarter.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              {[
                { icon: '📋', title: 'Start a Quiz', desc: 'Build a custom test from any mix of the 8 blocks. Weighted by exam proportion or your weak spots.', target: 'quiz-config' as View },
                { icon: '📖', title: 'Learn', desc: 'Explanations for questions you got wrong — saved automatically after every quiz.', target: 'learn' as View },
                { icon: '📊', title: 'Track Progress', desc: 'Per-block scores and trends. See exactly where to focus your time.', target: 'progress' as View },
                { icon: '💬', title: 'Ask', desc: 'Short, point-by-point answers to any automotive or exam topic. Then get tested on it.', target: 'ask' as View },
              ].map((card, i) => (
                <div key={card.title} className="action-card" onClick={() => setView(card.target)}
                  style={{ background: C.surface, border: `1px solid ${i === 0 ? 'rgba(45,110,247,0.25)' : C.border}`, borderRadius: 12, padding: '22px 20px' }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>{card.icon}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{card.title}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{card.desc}</div>
                  <div className="ac-arrow" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 20 }}>›</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { val: quizzesTaken, lbl: 'Quizzes taken' },
                { val: statsData.questionsAnswered, lbl: 'Questions answered' },
                { val: statsData.accuracy != null ? `${statsData.accuracy}%` : '—', lbl: 'Accuracy' },
                { val: statsData.savedCount, lbl: 'Saved explanations' },
              ].map(s => (
                <div key={s.lbl} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: C.accent2 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── QUIZ CONFIG ── */}
        {view === 'quiz-config' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Configure quiz</div>
              <div style={{ fontSize: 13, color: C.muted }}>Adjust questions per block. Slide to 0 to skip a block entirely.</div>
            </div>

            {/* Mode toggles */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
              {[
                { key: 'exam', label: 'Exam-proportional', desc: 'Weight questions to match the real 310S distribution across all blocks', checked: examProp, onChange: (v: boolean) => { setExamProp(v); setFocusWeak(false); if (v) applyExamProportional() } },
                { key: 'weak', label: 'Focus on weak areas', desc: 'Load up blocks where your score is below 70% — ease off the strong ones', checked: focusWeak, onChange: (v: boolean) => { setFocusWeak(v); setExamProp(false); if (v) applyFocusWeak() } },
              ].map((row, i) => (
                <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: row.checked ? 'rgba(45,110,247,0.06)' : 'transparent', borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{row.desc}</div>
                  </div>
                  <label style={{ position: 'relative', width: 44, height: 24, flexShrink: 0 }}>
                    <input type="checkbox" checked={row.checked} onChange={e => row.onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                    <span className="sw-track" />
                  </label>
                </div>
              ))}
            </div>

            {/* Total + reset */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700 }}>
                  Total: <span style={{ color: C.accent2 }}>{totalQ}</span> questions
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>~{Math.round(totalQ * 1.5)} min · {examProp ? 'exam-proportional' : focusWeak ? 'weak area focus' : 'custom'}</div>
              </div>
              <button className="reset-btn" onClick={applyExamProportional} style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>Reset</button>
            </div>

            {/* Block rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {BLOCKS.map(block => {
                const count = blockCounts[block.id] || 0
                const bp = blockProgress[block.id]
                const pct = bp && bp.total > 0 ? Math.round((bp.correct / bp.total) * 100) : null
                const isWeak = pct != null && pct < 70
                return (
                  <div key={block.id} style={{ background: C.surface, border: `1px solid ${isWeak ? 'rgba(240,79,79,0.3)' : count > 0 ? 'rgba(45,110,247,0.28)' : C.border}`, borderRadius: 10, padding: '14px 16px', opacity: count === 0 ? 0.5 : 1, background: isWeak ? `rgba(240,79,79,0.03)` : C.surface }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: isWeak ? C.dangerBg : C.surface2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: isWeak ? C.danger : C.accent2 }}>{block.id}</div>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{block.name}</div>
                      {block.high && <span style={{ fontSize: 10, fontWeight: 600, background: C.accentGlow, color: C.accent2, padding: '2px 8px', borderRadius: 4 }}>high weight</span>}
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: isWeak ? C.danger : C.accent2, minWidth: 26, textAlign: 'right' }}>{count}</div>
                      <span style={{ fontSize: 11, color: C.muted }}>q</span>
                    </div>
                    <input type="range" min={0} max={10} value={count}
                      onChange={e => { setBlockCounts(prev => ({ ...prev, [block.id]: Number(e.target.value) })); setExamProp(false); setFocusWeak(false) }}
                      style={{ background: `linear-gradient(to right, ${isWeak ? C.danger : C.accent2} ${count * 10}%, ${C.surface3} ${count * 10}%)` }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: C.muted }}>
                      <span>{block.sub}</span>
                      <span>·</span>
                      <span>{block.examQ}/125 on exam</span>
                      {pct != null
                        ? <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: pct < 70 ? C.dangerBg : pct < 85 ? C.warnBg : C.successBg, color: pct < 70 ? C.danger : pct < 85 ? C.warn : C.success }}>{pct}%</span>
                        : <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: C.surface3, color: C.muted }}>No data yet</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="gen-btn" onClick={startQuiz} disabled={totalQ === 0}
              style={{ width: '100%', padding: 15, background: C.accent, border: 'none', borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', cursor: totalQ > 0 ? 'pointer' : 'not-allowed', opacity: totalQ > 0 ? 1 : 0.5, letterSpacing: '0.04em' }}>
              Start Quiz →
            </button>
          </>
        )}

        {/* ── QUIZ ACTIVE ── */}
        {view === 'quiz-active' && (
          <>
            {/* Progress header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{quizResults.filter(r => r.correct).length} correct</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: C.accent2, whiteSpace: 'nowrap' }}>
                    {quizIndex + 1} / {quizPlan.length}
                  </span>
                </div>
                <div style={{ height: 5, background: C.surface2, borderRadius: 3, marginTop: 6 }}>
                  <div style={{ height: '100%', background: C.accent, borderRadius: 3, width: `${(quizIndex / quizPlan.length) * 100}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>

            {loadingQ ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted, fontSize: 14 }}>
                <span className="spinner" />{`Generating question…`}
              </div>
            ) : currentQ ? (
              <>
                {/* Question card */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, background: C.accentGlow, color: C.accent2, borderRadius: 4, padding: '2px 8px', marginRight: 6 }}>
                      {BLOCKS.find(b => b.id === quizPlan[quizIndex])?.name}
                    </span>
                    <span style={{ fontSize: 11, background: C.warnBg, color: C.warn, borderRadius: 4, padding: '2px 8px' }}>{currentQ.topic}</span>
                  </div>
                  <p style={{ fontSize: 16, lineHeight: 1.7, color: C.text }}>{currentQ.question}</p>
                </div>

                {/* Answer options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {currentQ.options.map(opt => {
                    const conf = confidences[opt.id]
                    const isThisCorrect = opt.id === currentQ!.correct
                    const isThisSelected = opt.id === selected
                    const borderColor = submitted
                      ? isThisCorrect ? C.success : isThisSelected ? C.danger : C.border
                      : C.border
                    return (
                      <div key={opt.id} style={{ borderRadius: 10, padding: '14px 16px', border: `1px solid ${borderColor}`, transition: 'all 0.3s', background: `linear-gradient(${purpleTint(conf)}, ${purpleTint(conf)}), ${C.surface}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: C.surface3, color: C.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2 }}>{opt.id}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: C.text }}>{opt.text}</div>
                            <div style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{opt.sub}</div>
                          </div>
                          {submitted && <span style={{ fontSize: 20, flexShrink: 0 }}>{isThisCorrect ? '✅' : isThisSelected ? '❌' : ''}</span>}
                        </div>
                        <input type="range" className="conf-slider" min={0} max={100} value={conf} disabled={submitted}
                          onChange={e => { setConfidences(prev => ({ ...prev, [opt.id]: Number(e.target.value) })); if (!touched) setTouched(true) }}
                          style={{ background: `linear-gradient(to right, #7c3aed ${conf}%, ${C.surface3} ${conf}%)`, opacity: submitted ? 0.5 : 1 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: conf > 0 ? '#a78bfa' : C.muted }}>{confidenceLabel(conf)}</span>
                          {conf > 0 && <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#a78bfa' }}>{conf}%</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Submit */}
                {!submitted && (
                  <button onClick={handleSubmit} disabled={!touched}
                    style={{ width: '100%', padding: 15, borderRadius: 10, border: 'none', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', background: touched ? '#7c3aed' : C.surface2, cursor: touched ? 'pointer' : 'not-allowed', opacity: touched ? 1 : 0.6, letterSpacing: '0.04em' }}>
                    {touched ? `Submit — going with ${selected}` : 'Move a slider to submit'}
                  </button>
                )}

                {/* Result + explanation */}
                {submitted && (
                  <>
                    <div style={{ background: isCorrect ? C.successBg : C.dangerBg, border: `1px solid ${isCorrect ? C.success : C.danger}`, borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{isCorrect ? '✅ Correct!' : `❌ Not quite — the answer was ${currentQ!.correct}`}</div>
                      <div style={{ background: C.surface2, borderLeft: `3px solid ${C.accent}`, borderRadius: '0 8px 8px 0', padding: '12px 14px', fontSize: 13, lineHeight: 1.75, color: C.text }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: C.accent2, marginBottom: 6 }}>Explanation</div>
                        {currentQ!.explanation}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setShowTutor(true)}
                        style={{ flex: 1, padding: 13, borderRadius: 8, border: `1px solid rgba(124,58,237,0.4)`, background: 'rgba(124,58,237,0.12)', color: C.text, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
                        Explore Further with AI Tutor
                      </button>
                      <button onClick={nextQuestion}
                        style={{ flex: 1, padding: 13, borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
                        {quizIndex + 1 >= quizPlan.length ? 'Finish Quiz →' : 'Next Question →'}
                      </button>
                    </div>
                    {saving && <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 8 }}>Saving result…</div>}
                  </>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.danger }}>
                Failed to load question. <button onClick={() => fetchQuestion(quizPlan[quizIndex])} style={{ color: C.accent2, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
              </div>
            )}
          </>
        )}

        {/* ── LEARN ── */}
        {view === 'learn' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Learn</div>
              <div style={{ fontSize: 13, color: C.muted }}>Explanations for questions you answered incorrectly — auto-saved after every quiz, organized by block.</div>
            </div>

            {learnItems.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: C.muted, fontSize: 14, fontStyle: 'italic' }}>
                No saved explanations yet. Take a quiz to build your review list.
              </div>
            ) : (
              <>
                {BLOCKS.map(block => {
                  // Items for this block: topic starts with "B: " etc.
                  const items = learnItems.filter(r => r.topic?.startsWith(`${block.id}: `))
                  return (
                    <div key={block.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: C.accent2, flexShrink: 0 }}>{block.id}</div>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{block.name}</div>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: items.length > 0 ? C.accentGlow : C.surface3, color: items.length > 0 ? C.accent2 : C.muted }}>{items.length} missed</span>
                      </div>
                      {items.map((item, i) => (
                        <div key={i} style={{ background: C.surface2, borderLeft: `3px solid ${C.accent}`, borderRadius: '0 6px 6px 0', margin: '0 16px 10px', padding: '10px 14px', fontSize: 13, lineHeight: 1.7 }}>
                          <div style={{ fontSize: 12, color: C.muted2, marginBottom: 6, fontWeight: 500 }}>Q: {item.question_text}</div>
                          <div style={{ color: C.text }}>✓ Correct answer: <strong style={{ color: C.success }}>{item.correct_answer}</strong></div>
                          {item.created_at && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>{new Date(item.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* ── PROGRESS ── */}
        {view === 'progress' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Progress</div>
              <div style={{ fontSize: 13, color: C.muted }}>Score breakdown by exam block. The passing threshold is 70%.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { val: quizzesTaken, lbl: 'Quizzes taken' },
                { val: statsData.accuracy != null ? `${statsData.accuracy}%` : '—', lbl: 'Overall accuracy' },
                { val: sessionScore != null ? `${sessionScore}%` : '—', lbl: 'This session' },
              ].map(s => (
                <div key={s.lbl} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: C.accent2 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {statsData.questionsAnswered === 0 && quizResults.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: C.muted, fontSize: 14, fontStyle: 'italic' }}>
                No quiz history yet. Take a quiz to see your per-block breakdown.
              </div>
            ) : (
              <>
                {BLOCKS.map(block => {
                  // Combine session results + DB results
                  const sessionBlock = quizResults.filter(r => r.block === block.id)
                  const dbBlock = blockProgress[block.id] || { correct: 0, total: 0 }
                  const totalAnswered = dbBlock.total + sessionBlock.length
                  const totalCorrect = dbBlock.correct + sessionBlock.filter(r => r.correct).length
                  const pct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null
                  const barColor = pct == null ? C.muted : pct < 70 ? C.danger : pct < 85 ? C.warn : C.success

                  return (
                    <div key={block.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, color: C.accent2, flexShrink: 0 }}>{block.id}</div>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{block.name}</div>
                        {block.high && <span style={{ fontSize: 10, fontWeight: 600, background: C.accentGlow, color: C.accent2, padding: '2px 8px', borderRadius: 4 }}>high weight</span>}
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, minWidth: 44, textAlign: 'right', color: barColor }}>{pct != null ? `${pct}%` : '—'}</div>
                      </div>
                      <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct ?? 0}%`, background: barColor, borderRadius: 3, transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{totalAnswered} questions answered · {block.sub}</div>
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>— 70% passing threshold</div>
              </>
            )}
          </>
        )}

        {/* ── ASK ── */}
        {view === 'ask' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Ask</div>
              <div style={{ fontSize: 13, color: C.muted }}>Short, point-by-point answers on any automotive or exam topic.</div>
            </div>

            <div style={{ minHeight: 200, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {askMsgs.length === 0 && (
                <div style={{ color: C.muted, fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
                  Ask anything about the 310S exam — diagnostic procedures, component function, circuit theory, anything.
                </div>
              )}
              {askMsgs.map(msg => (
                <div key={msg.id} className="fade-up" style={{ maxWidth: '90%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ background: msg.role === 'user' ? C.accentGlow : C.surface, border: `1px solid ${msg.role === 'user' ? 'rgba(79,138,255,0.2)' : C.border}`, borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px', padding: '12px 16px', fontSize: 14, lineHeight: 1.7, color: C.text }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {askLoading && (
                <div style={{ alignSelf: 'flex-start' }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px 10px 10px 2px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 150, 300].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: C.muted }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={askEndRef} />
            </div>

            <form onSubmit={sendAsk} style={{ display: 'flex', gap: 8 }}>
              <input value={askInput} onChange={askInputChange} placeholder="e.g. How does a variable valve timing system work?" style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 16px', fontFamily: "'Barlow', sans-serif", fontSize: 14, color: C.text, outline: 'none' }} onFocus={e => { e.target.style.borderColor = C.accent }} onBlur={e => { e.target.style.borderColor = C.border }} />
              <button type="submit" disabled={!askInput.trim() || askLoading} style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '11px 20px', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, cursor: !askInput.trim() || askLoading ? 'not-allowed' : 'pointer', opacity: !askInput.trim() || askLoading ? 0.5 : 1, whiteSpace: 'nowrap' }}>Ask ↗</button>
            </form>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Tip: ask follow-up questions to reinforce your understanding</div>
          </>
        )}

      </div>
    </div>
  )
}
