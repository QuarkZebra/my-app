'use client'

import { useState, useEffect, useRef } from 'react'

const WORDS = [
  { text: 'Conceive.', delay: 0 },
  { text: 'Explore.', delay: 0 },
  { text: 'Learn.', delay: 0 },
  { text: 'Create.', delay: 0 },
]

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [visibleWords, setVisibleWords] = useState<number[]>([])
  const [showBrand, setShowBrand] = useState(false)
  const wordRefs = useRef<(HTMLDivElement | null)[]>([])
  const brandRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Intersection observer for scroll-triggered reveals
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            if (!isNaN(index)) {
              setVisibleWords((prev) =>
                prev.includes(index) ? prev : [...prev, index]
              )
            }
            if (entry.target.getAttribute('data-brand') === 'true') {
              setShowBrand(true)
            }
          }
        })
      },
      { threshold: 0.5 }
    )

    wordRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })
    if (brandRef.current) observer.observe(brandRef.current)

    return () => observer.disconnect()
  }, [])

  return (
    <main className="relative">
      {/* ── FIXED BACKGROUND ── */}
      {/* Mobile image */}
      <div
        className="fixed inset-0 z-0 md:hidden"
        style={{
          backgroundImage: 'url(/hero-m.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(10,12,24,0.25) 0%, rgba(10,12,24,0.15) 40%, rgba(10,12,24,0.5) 80%, rgba(10,12,24,0.85) 100%)',
          }}
        />
      </div>
      {/* Desktop image */}
      <div
        className="fixed inset-0 z-0 hidden md:block"
        style={{
          backgroundImage: 'url(/hero-d.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(10,12,24,0.25) 0%, rgba(10,12,24,0.15) 40%, rgba(10,12,24,0.5) 80%, rgba(10,12,24,0.85) 100%)',
          }}
        />
      </div>

      {/* ── TOP NAV ── */}
      <nav className="fixed top-3 left-3 right-3 z-50 flex items-center justify-between px-16 py-12 md:px-28 md:py-16">
        {/* Logo */}
        <div
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
          className="text-lg md:text-xl font-light tracking-wide"
        >
          <span style={{ color: 'var(--cream-bright)' }}>Crezate</span>
        </div>

        {/* Resources dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-6 py-4 rounded-lg transition-all duration-200"
            style={{
              background: menuOpen ? 'rgba(240,236,228,0.12)' : 'rgba(240,236,228,0.06)',
              border: '1px solid rgba(240,236,228,0.1)',
              color: 'var(--cream-dim)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 300,
              letterSpacing: '0.04em',
            }}
          >
            Resources
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 py-2 rounded-xl overflow-hidden"
              style={{
                background: 'rgba(18, 20, 36, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(240,236,228,0.08)',
                minWidth: '200px',
                animation: 'menuIn 0.15s ease',
              }}
            >
              <div
                className="px-4 py-1.5 text-xs uppercase tracking-widest"
                style={{ color: 'rgba(240,236,228,0.25)', fontFamily: 'var(--font-body)', fontWeight: 300 }}
              >
                Apps
              </div>
              <a
                href="/310sPrep"
                className="block px-4 py-2.5 transition-colors duration-150"
                style={{
                  color: 'var(--cream-dim)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 300,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(240,236,228,0.06)'
                  e.currentTarget.style.color = 'var(--cream-bright)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--cream-dim)'
                }}
              >
                310S Red Seal Prep
                <span className="block text-xs mt-0.5" style={{ color: 'rgba(240,236,228,0.2)' }}>
                  Practice exam questions
                </span>
              </a>
            </div>
          )}
        </div>
      </nav>

      {/* ── SCROLL CONTENT ── */}
      {/* First viewport: just the image, maybe a subtle scroll hint */}
      <section className="relative z-10 h-screen flex items-end justify-center pb-12">
        <div
          className="animate-bounce"
          style={{ color: 'var(--cream-dim)', opacity: 0.4 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </section>

      {/* Word reveals */}
      {WORDS.map((word, i) => (
        <section
          key={word.text}
          className="relative z-10 h-[70vh] flex items-center justify-center"
        >
          <div
            ref={(el) => { wordRefs.current[i] = el }}
            data-index={i}
            className="transition-all duration-1000 ease-out"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3rem, 8vw, 7rem)',
              fontWeight: 300,
              letterSpacing: '0.03em',
              color: 'var(--cream)',
              opacity: visibleWords.includes(i) ? 0.75 : 0,
              transform: visibleWords.includes(i) ? 'translateY(0)' : 'translateY(40px)',
            }}
          >
            {word.text}
          </div>
        </section>
      ))}

      {/* Final brand reveal */}
      <section className="relative z-10 h-screen flex items-center justify-center">
        <div
          ref={brandRef}
          data-brand="true"
          className="text-center transition-all duration-1200 ease-out"
          style={{
            opacity: showBrand ? 1 : 0,
            transform: showBrand ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.97)',
            transitionDuration: '1.2s',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(4.5rem, 12vw, 10rem)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--cream-bright)',
              lineHeight: 1,
            }}
          >
            Crezate
          </div>
          <div
            className="mt-4"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
              fontWeight: 200,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'var(--cream-dim)',
            }}
          >
            Create your own path
          </div>
        </div>
      </section>

      {/* Inline keyframes */}
      <style jsx global>{`
        @keyframes menuIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  )
}
