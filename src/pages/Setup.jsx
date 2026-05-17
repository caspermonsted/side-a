import { useState } from 'react'

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const GENRES = [
  { value: 'all', label: 'Alle genrer' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'dance', label: 'Dance' },
  { value: 'r&b', label: 'R&B / Soul' },
]
const DIFFICULTIES = [
  { value: 'easy', label: 'Let', desc: 'Store hits' },
  { value: 'medium', label: 'Medium', desc: 'Kendte sange' },
  { value: 'hard', label: 'Svær', desc: 'Obskurt' },
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
    if (!team1.trim() || !team2.trim()) return
    if (decades.length === 0) return
    onStart({ team1: team1.trim(), team2: team2.trim(), decades, difficulty, genre, rounds })
  }

  return (
    <div className="page" style={{ gap: '0', paddingTop: '2rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Nyt spil</h1>
        <button className="btn-ghost" onClick={onLogout} style={{ fontSize: '0.78rem' }}>Log ud</button>
      </div>

      <Section label="Hold">
        <input type="text" value={team1} onChange={e => setTeam1(e.target.value)} placeholder="Hold 1" maxLength={20} />
        <input type="text" value={team2} onChange={e => setTeam2(e.target.value)} placeholder="Hold 2" maxLength={20} style={{ marginTop: '0.5rem' }} />
      </Section>

      <Section label="Årtier">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {DECADES.map(d => (
            <Chip key={d} active={decades.includes(d)} onClick={() => toggleDecade(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Sværhedsgrad">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {DIFFICULTIES.map(d => (
            <button
              key={d.value}
              onClick={() => setDifficulty(d.value)}
              style={{
                flex: 1,
                padding: '0.75rem 0.25rem',
                borderRadius: 'var(--radius)',
                background: difficulty === d.value ? 'var(--accent)' : 'var(--card)',
                border: `1px solid ${difficulty === d.value ? 'var(--accent)' : 'var(--border)'}`,
                color: difficulty === d.value ? '#fff' : 'var(--text)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.label}</span>
              <span style={{ fontSize: '0.72rem', color: difficulty === d.value ? 'rgba(255,255,255,0.75)' : 'var(--text3)' }}>{d.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section label="Genre">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {GENRES.map(g => (
            <Chip key={g.value} active={genre === g.value} onClick={() => setGenre(g.value)}>
              {g.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Antal runder">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[10, 20, 30].map(n => (
            <Chip key={n} active={rounds === n} onClick={() => setRounds(n)} style={{ flex: 1, justifyContent: 'center' }}>
              {n}
            </Chip>
          ))}
        </div>
      </Section>

      <button
        className="btn-primary"
        onClick={handleStart}
        disabled={!team1.trim() || !team2.trim() || decades.length === 0}
        style={{ marginTop: '1.5rem' }}
      >
        Start spil →
      </button>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div className="label" style={{ marginBottom: '0.6rem' }}>{label}</div>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.45rem 0.9rem',
        borderRadius: 50,
        background: active ? 'var(--accent)' : 'var(--card)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color: active ? '#fff' : 'var(--text2)',
        fontSize: '0.9rem',
        fontWeight: active ? 700 : 400,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
