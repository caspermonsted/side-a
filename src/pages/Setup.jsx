import { useState } from 'react'

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const GENRES = [
  { value: 'all', label: 'Alle' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'dance', label: 'Dance' },
  { value: 'r&b', label: 'R&B/Soul' },
]
const DIFFICULTIES = [
  { value: 'easy',   num: '01', label: 'Let',    sub: 'STORE HITS' },
  { value: 'medium', num: '02', label: 'Medium', sub: 'KENDTE SANGE' },
  { value: 'hard',   num: '03', label: 'Svær',   sub: 'OBSKURT' },
]

export default function Setup({ onStart, onLogout }) {
  const [team1, setTeam1] = useState('Hold 1')
  const [team2, setTeam2] = useState('Hold 2')
  const [decades, setDecades] = useState(['80s', '90s', '00s', '10s'])
  const [difficulty, setDifficulty] = useState('medium')
  const [genre, setGenre] = useState('all')
  const [rounds, setRounds] = useState(20)

  function toggleDecade(d) {
    setDecades(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  function handleStart() {
    if (!team1.trim() || !team2.trim() || decades.length === 0) return
    onStart({ team1: team1.trim(), team2: team2.trim(), decades, difficulty, genre, rounds })
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>
      {/* Masthead */}
      <div style={{ padding: '1.25rem 1.5rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span className="mono" style={{ fontSize: '0.62rem' }}>NO. 047 · MAJ MMXXVI</span>
          <button className="btn-ghost mono" onClick={onLogout} style={{ fontSize: '0.62rem', padding: '0.3rem 0.6rem' }}>LOG UD</button>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '0.4rem' }} />
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 900, fontStyle: 'italic',
          fontSize: '1.5rem', textAlign: 'center',
          letterSpacing: '-0.01em', lineHeight: 1,
          marginBottom: '0.4rem',
        }}>THE LISTENING POST</div>
        <div style={{ borderTop: '3px solid var(--ink)', marginBottom: '0.5rem' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontSize: '0.62rem' }}>EN MUSIKQUIZ I FLERE AKTER</span>
          <span className="mono" style={{ fontSize: '0.62rem' }}>SIDE 02 / 04</span>
        </div>
      </div>

      {/* Headline */}
      <div style={{ padding: '1.25rem 1.5rem 0' }}>
        <div className="mono" style={{ color: 'var(--accent2)', marginBottom: '0.4rem', fontSize: '0.62rem' }}>FORSPIL</div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 900,
          fontSize: '3.5rem', lineHeight: 0.92,
          letterSpacing: '-0.03em', margin: '0 0 0.6rem',
        }}>Nyt spil.</h1>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          fontSize: '0.88rem', lineHeight: 1.45,
          color: 'var(--ink2)', marginBottom: '1.5rem',
        }}>
          Indstil aftenens parametre — og lad nålen falde.
        </p>
      </div>

      {/* HOLD */}
      <SetupSection num="I" label="HOLD" caption="To deltagere">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { val: team1, set: setTeam1, ph: 'Hold 1', num: '01' },
            { val: team2, set: setTeam2, ph: 'Hold 2', num: '02' },
          ].map(({ val, set, ph, num }) => (
            <div key={num} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              borderBottom: '1px solid var(--border)', padding: '0.5rem 0',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--accent2)', width: 24 }}>{num}</span>
              <input
                type="text"
                value={val}
                onChange={e => set(e.target.value)}
                placeholder={ph}
                maxLength={20}
                style={{ border: 'none', borderBottom: 'none', padding: '0.25rem 0', fontSize: '1.2rem' }}
              />
            </div>
          ))}
        </div>
      </SetupSection>

      {/* ÅRTIER */}
      <SetupSection num="II" label="ÅRTIER" caption={`${decades.length} valgt`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
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
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '1.15rem',
                  padding: '0.75rem 0',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {d}
                {active && (
                  <span style={{
                    position: 'absolute', top: 3, right: 5,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.5rem', color: 'var(--accent)',
                    fontStyle: 'normal',
                  }}>✓</span>
                )}
              </button>
            )
          })}
        </div>
      </SetupSection>

      {/* SVÆRHEDSGRAD */}
      <SetupSection num="III" label="SVÆRHEDSGRAD" caption="Kun ét niveau">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {DIFFICULTIES.map((opt, i) => {
            const active = difficulty === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto 18px',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  padding: '0.85rem 0',
                  borderTop: i === 0 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: 'var(--accent2)', letterSpacing: '0.1em' }}>{opt.num}</span>
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: 'italic', fontWeight: 700,
                  fontSize: '1.3rem', color: 'var(--ink)',
                }}>{opt.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--muted)' }}>{opt.sub}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent2)', textAlign: 'right' }}>{active ? '●' : '○'}</span>
              </button>
            )
          })}
        </div>
      </SetupSection>

      {/* GENRE */}
      <SetupSection num="IV" label="GENRE" caption="Repertoire">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {GENRES.map(g => {
            const active = genre === g.value
            return (
              <button
                key={g.value}
                onClick={() => setGenre(g.value)}
                style={{
                  border: `1px solid ${active ? 'var(--accent2)' : 'var(--border)'}`,
                  background: active ? 'var(--accent2)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--ink)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  letterSpacing: '0.1em',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                }}
              >{g.label}</button>
            )
          })}
        </div>
      </SetupSection>

      {/* RUNDER */}
      <SetupSection num="V" label="RUNDER" caption="Per spil">
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[10, 20, 30].map(n => (
            <button
              key={n}
              onClick={() => setRounds(n)}
              style={{
                flex: 1,
                border: `1px solid ${rounds === n ? 'var(--ink)' : 'var(--border)'}`,
                background: rounds === n ? 'var(--ink)' : 'transparent',
                color: rounds === n ? 'var(--bg)' : 'var(--ink)',
                fontFamily: "'Playfair Display', serif",
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: '1.3rem',
                padding: '0.6rem 0',
                cursor: 'pointer',
              }}
            >{n}</button>
          ))}
        </div>
      </SetupSection>

      {/* Start */}
      <div style={{ padding: '1rem 1.5rem 2rem' }}>
        <div style={{ borderTop: '3px solid var(--ink)', marginBottom: 0 }} />
        <button
          onClick={handleStart}
          disabled={!team1.trim() || !team2.trim() || decades.length === 0}
          className="btn-primary"
        >
          <span>Lad spillet begynde</span>
          <span>→</span>
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.6rem' }}>
          <span className="mono" style={{ fontSize: '0.6rem' }}>EDITED BY THE HOUSE</span>
          <span className="mono" style={{ fontSize: '0.6rem' }}>PRINTED IN COPENHAGEN</span>
        </div>
      </div>
    </div>
  )
}

function SetupSection({ num, label, caption, children }) {
  return (
    <div style={{ padding: '0 1.5rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic', fontWeight: 700,
          fontSize: '0.85rem', color: 'var(--accent2)',
        }}>§ {num}</span>
        <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink)', fontWeight: 600 }}>{label}</span>
        <div style={{ flex: 1, borderTop: '1px solid var(--border)', margin: '0 4px' }} />
        <span className="mono" style={{ fontSize: '0.6rem' }}>{caption}</span>
      </div>
      {children}
    </div>
  )
}
