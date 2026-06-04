import { countryLabel } from '../country'

export default function ModeSelect({ onParty, onSolo, onScores, country, onChangeCountry }) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Top strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--border)',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.18em', color: 'var(--label)',
      }}>
        <span>SIDE A</span>
        <span style={{ fontSize: '0.9rem' }}>◐</span>
        <span>33⅓ RPM</span>
      </div>

      {/* Heading */}
      <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', color: 'var(--label)', marginBottom: '0.2rem' }}>
          SELECT YOUR SIDE
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontWeight: 900,
          fontSize: 'clamp(2.5rem, 12vw, 3.5rem)', lineHeight: 0.9,
          letterSpacing: '-0.04em', color: 'var(--ink)', margin: 0,
        }}>How are<br />you playing?</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '0.75rem' }}>

        {/* SIDE A — Party */}
        <button
          onClick={onParty}
          style={{
            background: 'var(--ink)', color: 'var(--bg)',
            border: 'none', padding: '1.5rem 1.25rem',
            cursor: 'pointer', textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Vinyl decoration */}
          <div style={{
            position: 'absolute', right: -30, top: '50%', transform: 'translateY(-50%)',
            width: 120, height: 120, borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, #2a221c 0 35%, #0f0d0b 35% 100%)',
            opacity: 0.35,
          }}>
            <div style={{ position: 'absolute', inset: '50%', width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: '50%', background: 'var(--ink)' }} />
          </div>

          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.2em', color: 'rgba(196,200,180,0.6)', marginBottom: '0.4rem' }}>
              SIDE A
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900,
              fontSize: 'clamp(3rem, 14vw, 4rem)', lineHeight: 0.9, letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
            }}>Party</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', color: 'rgba(196,200,180,0.7)' }}>
              2–4 TEAMS · RACE TO WIN
            </div>
          </div>
          <span style={{ fontSize: '1.5rem', flexShrink: 0, zIndex: 1 }}>→</span>
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', color: 'var(--muted)', letterSpacing: '0.15em' }}>FLIP THE RECORD</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* SIDE B — Solo */}
        <button
          onClick={onSolo}
          style={{
            background: 'var(--surface)', color: 'var(--ink)',
            border: '1px solid var(--border)', padding: '1.5rem 1.25rem',
            cursor: 'pointer', textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Vinyl decoration */}
          <div style={{
            position: 'absolute', right: -30, top: '50%', transform: 'translateY(-50%)',
            width: 120, height: 120, borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, #2a221c 0 35%, #1a1612 35% 100%)',
            opacity: 0.12,
          }}>
            <div style={{ position: 'absolute', inset: '50%', width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: '50%', background: 'var(--surface)' }} />
          </div>

          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '0.4rem' }}>
              SIDE B
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900,
              fontSize: 'clamp(3rem, 14vw, 4rem)', lineHeight: 0.9, letterSpacing: '-0.03em',
              marginBottom: '0.75rem', color: 'var(--ink)',
            }}>Solo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                {[0,1,2].map(i => <span key={i} style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>♥</span>)}
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                3 HEARTS · LEADERBOARD
              </span>
            </div>
          </div>
          <span style={{ fontSize: '1.5rem', flexShrink: 0, zIndex: 1 }}>→</span>
        </button>

        {/* High scores link */}
        <button
          onClick={onScores}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            padding: '0.5rem',
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.15em', color: 'var(--muted)' }}>
            ◆ HIGH SCORES
          </span>
        </button>

      </div>

      <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>PUBLISHED BY THE HOUSE</span>
        {country && (
          <button
            onClick={onChangeCountry}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.4rem' }}
          >
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.48rem',
              letterSpacing: '0.15em', border: '1px solid var(--border)',
              padding: '1px 4px', color: 'var(--muted)',
            }}>
              {country}
            </span>
            <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--muted)', letterSpacing: '0.12em' }}>
              {countryLabel(country).toUpperCase()} · CHANGE
            </span>
          </button>
        )}
        <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>MMXXVI</span>
      </div>
    </div>
  )
}
