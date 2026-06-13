import { useState } from 'react'

const ALL_DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   meta: 'Big hits',    desc: 'Songs everyone knows.' },
  { value: 'medium', label: 'Medium', meta: 'Well-known',  desc: 'A fitting crowd.' },
  { value: 'hard',   label: 'Hard',   meta: 'Obscure',     desc: 'For enthusiasts only.' },
]

export default function SoloSetup({ onStart, onBack, onScores }) {
  const [difficulty, setDifficulty] = useState('easy')

  function handleStart() {
    onStart({
      solo: true,
      teams: [{ name: 'You' }],
      decades: ALL_DECADES, difficulty,
      target: 999,
    })
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>

      {/* Top strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--border)',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.18em', color: 'var(--label)',
      }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: '0.58rem', padding: '0.25rem 0.5rem' }}>← BACK</button>
        <span>SIDE B · SOLO</span>
        <button className="btn-ghost" onClick={onScores} style={{ fontSize: '0.58rem', padding: '0.25rem 0.5rem' }}>◆ SCORES</button>
      </div>

      {/* Hero */}
      <div style={{ position: 'relative', padding: '1rem 1.25rem 1.75rem', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--label)', marginBottom: '0.25rem' }}>01</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--label)', marginBottom: '0.3rem' }}>SIDE B</div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontWeight: 900,
          fontSize: 'clamp(4rem, 20vw, 5.5rem)', lineHeight: 0.88,
          letterSpacing: '-0.04em', color: 'var(--ink)', margin: '0 0 0.75rem',
        }}>Solo<br />run</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[0,1,2].map(i => <span key={i} style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>♥</span>)}
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--ink)' }}>
            3 HEARTS · BEAT THE BOARD
          </span>
        </div>

        {/* Vinyl decoration */}
        <div style={{ position: 'absolute', right: -20, top: 12, opacity: 0.45, pointerEvents: 'none' }}>
          <div style={{
            width: 130, height: 130, borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, #2a221c 0 35%, #181410 35% 100%)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          }}>
            <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', inset: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', inset: '50%', width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: '50%', background: 'var(--accent)' }} />
            <div style={{ position: 'absolute', inset: '50%', width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
        </div>
      </div>

      {/* A1 — Difficulty */}
      <SectionBlock number="A1" title="Difficulty" sub="One level per session">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {DIFFICULTIES.map(opt => {
            const active = difficulty === opt.value
            return (
              <button key={opt.value} onClick={() => setDifficulty(opt.value)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.9rem 1rem',
                background: active ? 'var(--ink)' : 'var(--surface)',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                color: active ? 'var(--bg)' : 'var(--ink)',
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.25rem' }}>{opt.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', marginTop: '0.15rem', opacity: active ? 0.65 : 1 }}>
                    {opt.meta} · <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', letterSpacing: 0, fontSize: '0.7rem' }}>{opt.desc}</span>
                  </div>
                </div>
                <span style={{ fontSize: '1rem', color: active ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }}>{active ? '●' : '○'}</span>
              </button>
            )
          })}
        </div>
      </SectionBlock>

      {/* Note about difficulty & leaderboard */}
      <div style={{ padding: '0 1.25rem 0.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.6rem 0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', fontSize: '0.75rem', flexShrink: 0, marginTop: 1 }}>◆</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            Scores are ranked by difficulty. Easy, Medium and Hard have separate leaderboards.
          </span>
        </div>
      </div>

      {/* Start */}
      <div style={{ padding: '0.5rem 1.25rem 2rem' }}>
        <button
          onClick={handleStart}
          style={{
            width: '100%', border: '1px solid var(--ink)',
            background: 'var(--ink)', color: 'var(--bg)',
            padding: '1.1rem 1.25rem', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
          }}
        >
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', color: '#d4a13a', marginBottom: '0.2rem' }}>DROP THE NEEDLE</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.4rem' }}>Begin solo run</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>▶</div>
        </button>
      </div>
    </div>
  )
}

function SectionBlock({ number, title, sub, children }) {
  return (
    <div style={{ padding: '1rem 1.25rem 0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--label)', border: '1px solid var(--label)', padding: '1px 5px' }}>{number}</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.4rem', margin: 0, letterSpacing: '-0.02em' }}>{title}</h2>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--muted)' }}>{sub}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--ink)', marginBottom: '0.75rem' }} />
      {children}
    </div>
  )
}
