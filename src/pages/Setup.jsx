import { useState } from 'react'

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const GENRES = [
  { value: 'all', label: 'All genres' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'dance', label: 'Dance' },
  { value: 'r&b', label: 'R&B/Soul' },
]
const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   meta: 'Big hits',      desc: 'Songs everyone knows.' },
  { value: 'medium', label: 'Medium', meta: 'Well-known',    desc: 'A fitting crowd.' },
  { value: 'hard',   label: 'Hard',   meta: 'Obscure',       desc: 'For enthusiasts only.' },
]
const TEAM_COLORS = ['#c4533a', '#3a5d4a', '#d4a13a', '#5a4a8a', '#2a4a7a', '#a8527a']

export default function Setup({ onStart, onBack }) {
  const [teams, setTeams] = useState([
    { name: 'Team 1' },
    { name: 'Team 2' },
  ])
  const [decades, setDecades] = useState(['80s', '90s', '00s', '10s'])
  const [difficulty, setDifficulty] = useState('medium')
  const [genre, setGenre] = useState('all')
  const [target, setTarget] = useState(10)

  function toggleDecade(d) {
    setDecades(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  function handleStart() {
    if (teams.some(t => !t.name.trim()) || decades.length === 0) return
    onStart({
      teams: teams.map((t, i) => ({ name: t.name.trim(), color: TEAM_COLORS[i] })),
      decades, difficulty, genre, target,
    })
  }

  function addTeam() {
    if (teams.length >= 4) return
    setTeams(prev => [...prev, { name: `Team ${prev.length + 1}` }])
  }

  function removeTeam() {
    if (teams.length <= 2) return
    setTeams(prev => prev.slice(0, -1))
  }

  function setTeamName(i, val) {
    setTeams(prev => prev.map((t, j) => j === i ? { ...t, name: val } : t))
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>

      {/* Top strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.6rem 1.25rem',
        borderBottom: '1px solid var(--border)',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem',
        letterSpacing: '0.18em', color: 'var(--label)',
      }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: '0.58rem', padding: '0.25rem 0.5rem' }}>← BACK</button>
        <span>SIDE A · PARTY</span>
        <span>33⅓ RPM</span>
      </div>

      {/* Hero */}
      <div style={{
        position: 'relative',
        padding: '1rem 1.25rem 1.75rem',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
          fontSize: '0.85rem', color: 'var(--label)', marginBottom: '0.25rem',
        }}>01</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--label)', marginBottom: '0.3rem' }}>
          A NEW RELEASE
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 900,
          fontSize: 'clamp(4rem, 20vw, 5.5rem)',
          lineHeight: 0.88,
          letterSpacing: '-0.04em',
          color: 'var(--ink)',
          margin: '0 0 0.75rem',
        }}>
          New<br />game
        </h1>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.16em', color: 'var(--ink)' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.8rem', letterSpacing: 0 }}>composed by</span>
          &nbsp;&nbsp;YOU &amp; YOUR GUESTS
        </div>

        {/* Vinyl sleeve */}
        <div style={{ position: 'absolute', right: -20, top: 12, opacity: 0.45, pointerEvents: 'none' }}>
          <div style={{
            width: 130, height: 130, borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, #2a221c 0 35%, #181410 35% 100%)',
            position: 'relative',
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          }}>
            <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', inset: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', inset: '50% 50%', width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: '50%', background: 'var(--accent)' }} />
            <div style={{ position: 'absolute', inset: '50% 50%', width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
        </div>
      </div>

      {/* A1 — Optrædende */}
      <SectionBlock number="A1" title="Players" sub={`${teams.length} team${teams.length > 1 ? 's' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {teams.map((t, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto',
              gap: '0.75rem', alignItems: 'center',
              background: 'var(--surface)', padding: '0.75rem 0.9rem',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: TEAM_COLORS[i],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
                fontWeight: 800, fontSize: '1.2rem', color: '#fff', flexShrink: 0,
              }}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <input
                type="text"
                value={t.name}
                onChange={e => setTeamName(i, e.target.value)}
                maxLength={20}
                style={{ fontSize: '1.1rem', padding: '0' }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: 'var(--muted)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={removeTeam}
              disabled={teams.length <= 2}
              style={{
                flex: 1, padding: '0.6rem',
                border: '1px solid var(--border)', background: 'transparent',
                cursor: teams.length <= 2 ? 'default' : 'pointer',
                opacity: teams.length <= 2 ? 0.3 : 1,
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em',
              }}
            >− Remove team</button>
            <button
              onClick={addTeam}
              disabled={teams.length >= 4}
              style={{
                flex: 1, padding: '0.6rem',
                border: '1px solid var(--border)', background: 'transparent',
                cursor: teams.length >= 4 ? 'default' : 'pointer',
                opacity: teams.length >= 4 ? 0.3 : 1,
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em',
              }}
            >+ Add team</button>
          </div>
        </div>
      </SectionBlock>

      {/* A2 — Årtier */}
      <SectionBlock number="A2" title="Decades" sub={`${decades.length} selected · 1960–2025`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {DECADES.map(d => {
            const active = decades.includes(d)
            return (
              <button
                key={d}
                onClick={() => toggleDecade(d)}
                style={{
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--ink)',
                  padding: '0.6rem 0.9rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'baseline', gap: '1px',
                }}
              >
                <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.25rem' }}>
                  {d.replace('s', '')}
                </span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.75rem' }}>'s</span>
              </button>
            )
          })}
        </div>
      </SectionBlock>

      {/* A3 — Sværhedsgrad */}
      <SectionBlock number="A3" title="Difficulty" sub="One level per session">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {DIFFICULTIES.map(opt => {
            const active = difficulty === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.9rem 1rem',
                  background: active ? 'var(--ink)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                  color: active ? 'var(--bg)' : 'var(--ink)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.25rem' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', marginTop: '0.15rem', opacity: active ? 0.65 : 1 }}>
                    {opt.meta} · <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', letterSpacing: 0, fontSize: '0.7rem' }}>{opt.desc}</span>
                  </div>
                </div>
                <span style={{ fontSize: '1rem', color: active ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }}>
                  {active ? '●' : '○'}
                </span>
              </button>
            )
          })}
        </div>
      </SectionBlock>

      {/* A4 — Repertoire */}
      <SectionBlock number="A4" title="Repertoire" sub="Genres">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {GENRES.map(g => {
            const active = genre === g.value
            return (
              <button
                key={g.value}
                onClick={() => setGenre(g.value)}
                style={{
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--ink)',
                  borderRadius: 999,
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: 'italic', fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >{g.label}</button>
            )
          })}
        </div>
      </SectionBlock>

      {/* A5 — Cards to win */}
      <SectionBlock number="A5" title="Cards to win" sub="First to this wins">
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[3, 5, 10].map(n => {
            const active = target === n
            return (
              <button
                key={n}
                onClick={() => setTarget(n)}
                style={{
                  flex: 1, padding: '0.75rem',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--ink)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
                }}
              >
                <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.8rem', lineHeight: 1 }}>{n}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.52rem', opacity: 0.6 }}>
                  {n === 3 ? 'QUICK' : n === 5 ? 'MEDIUM' : 'FULL'}
                </span>
              </button>
            )
          })}
        </div>
      </SectionBlock>

      {/* Start */}
      <div style={{ padding: '0.5rem 1.25rem 2rem' }}>
        <button
          onClick={handleStart}
          disabled={teams.some(t => !t.name.trim()) || decades.length === 0 || teams.length < 2}
          style={{
            width: '100%', border: '1px solid var(--ink)',
            background: 'var(--ink)', color: 'var(--bg)',
            padding: '1.1rem 1.25rem', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            textAlign: 'left',
          }}
        >
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', color: '#d4a13a', marginBottom: '0.2rem' }}>
              DROP THE NEEDLE
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.4rem' }}>
              Begin the game
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', flexShrink: 0,
          }}>▶</div>
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', paddingTop: '0.75rem' }}>
          <span className="mono" style={{ fontSize: '0.58rem' }}>PUBLISHED BY THE HOUSE</span>
          <span className="mono" style={{ fontSize: '0.58rem' }}>·</span>
          <span className="mono" style={{ fontSize: '0.58rem' }}>MMXXVI</span>
        </div>
      </div>
    </div>
  )
}

function SectionBlock({ number, title, sub, children }) {
  return (
    <div style={{ padding: '1rem 1.25rem 0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
            letterSpacing: '0.18em', color: 'var(--label)',
            border: '1px solid var(--label)', padding: '1px 5px',
          }}>{number}</span>
          <h2 style={{
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
            fontWeight: 800, fontSize: '1.4rem', margin: 0, letterSpacing: '-0.02em',
          }}>{title}</h2>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--muted)' }}>{sub}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--ink)', marginBottom: '0.75rem' }} />
      {children}
    </div>
  )
}
