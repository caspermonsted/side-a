import { useState, useEffect } from 'react'

const DIFFICULTIES = ['easy', 'medium', 'hard']

export default function Leaderboard({ context, onBack }) {
  const [difficulty, setDifficulty] = useState(context?.difficulty || 'medium')
  const [period, setPeriod] = useState('30d')
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/scores?difficulty=${difficulty}&period=${period}`)
      .then(r => r.json())
      .then(data => { setScores(data); setLoading(false) })
      .catch(() => { setScores([]); setLoading(false) })
  }, [difficulty, period])

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--border)',
      }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: '0.58rem', padding: '0.25rem 0.5rem' }}>← BACK</button>
        <span className="mono" style={{ fontSize: '0.62rem', letterSpacing: '0.18em' }}>HIGH SCORES</span>
        <span style={{ width: 60 }} />
      </div>

      {/* Hero */}
      <div style={{ padding: '1rem 1.25rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div className="mono" style={{ fontSize: '0.58rem', letterSpacing: '0.2em', color: 'var(--label)', marginBottom: '0.2rem' }}>SIDE A · SOLO</div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontWeight: 900,
          fontSize: 'clamp(2.8rem, 14vw, 4rem)', lineHeight: 0.9,
          letterSpacing: '-0.04em', color: 'var(--ink)', margin: '0 0 0.5rem',
        }}>Hall of<br />Fame</h1>
      </div>

      {/* Period toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {[{ value: '30d', label: 'LAST 30 DAYS' }, { value: 'all', label: 'ALL TIME' }].map(opt => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            style={{
              flex: 1, padding: '0.5rem',
              background: period === opt.value ? 'var(--surface)' : 'transparent',
              color: period === opt.value ? 'var(--ink)' : 'var(--muted)',
              border: 'none', borderRight: opt.value === '30d' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em',
            }}
          >{opt.label}</button>
        ))}
      </div>

      {/* Difficulty tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {DIFFICULTIES.map(d => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            style={{
              flex: 1, padding: '0.65rem',
              background: difficulty === d ? 'var(--ink)' : 'transparent',
              color: difficulty === d ? 'var(--bg)' : 'var(--ink)',
              border: 'none', borderRight: d !== 'hard' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em',
            }}
          >{d.toUpperCase()}</button>
        ))}
      </div>

      {/* Scores */}
      <div style={{ flex: 1 }}>
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>LOADING…</span>
          </div>
        )}

        {!loading && scores.length === 0 && (
          <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--ink2)', marginBottom: '0.5rem' }}>No scores yet.</div>
            <div className="mono" style={{ fontSize: '0.58rem', color: 'var(--muted)' }}>BE THE FIRST TO PLAY</div>
          </div>
        )}

        {!loading && scores.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              background: i === 0 ? 'var(--surface)' : 'transparent',
            }}
          >
            {/* Rank */}
            <div style={{
              width: 32, flexShrink: 0, textAlign: 'center',
              fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900,
              fontSize: i === 0 ? '1.5rem' : '1.1rem',
              color: i === 0 ? 'var(--accent)' : 'var(--muted)',
              lineHeight: 1,
            }}>
              {i + 1}
            </div>

            {/* Name + date */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
              <div className="mono" style={{ fontSize: '0.52rem', color: 'var(--muted)', marginTop: 2 }}>
                {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: '1.8rem', lineHeight: 1, color: i === 0 ? 'var(--accent)' : 'var(--ink)' }}>
                {s.score}
              </div>
              <div className="mono" style={{ fontSize: '0.48rem', color: 'var(--muted)' }}>CARDS</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>{period === '30d' ? 'TOP 10 · LAST 30 DAYS' : 'TOP 10 · ALL TIME'}</span>
        <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>MMXXVI</span>
      </div>
    </div>
  )
}
