import { COUNTRY_OPTIONS } from '../country'

const SUBTITLES = {
  DK: 'DANISH HITS MIXED IN',
  INT: 'WORLDWIDE CHART-TOPPERS',
}

export default function CountryModal({ onSelect }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(28, 24, 16, 0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{
        background: 'var(--bg)',
        maxWidth: 360, width: '100%',
        border: '1px solid var(--border)',
        padding: '1.75rem 1.5rem',
      }}>

        {/* Label */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.55rem', letterSpacing: '0.22em', color: 'var(--label)',
          marginBottom: '0.5rem',
        }}>
          ONE-TIME SETUP
        </div>

        {/* Heading */}
        <h2 style={{
          fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
          fontWeight: 900, fontSize: '1.9rem', lineHeight: 1.05,
          letterSpacing: '-0.03em', color: 'var(--ink)',
          margin: '0 0 0.4rem',
        }}>
          Where are<br />you playing?
        </h2>

        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.58rem', letterSpacing: '0.1em', color: 'var(--muted)',
          margin: '0 0 1.4rem',
        }}>
          WE'LL MIX IN LOCAL HITS ALONGSIDE<br />THE INTERNATIONAL CLASSICS
        </p>

        {/* Country buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {COUNTRY_OPTIONS.map(opt => (
            <button
              key={opt.code}
              onClick={() => onSelect(opt.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.1rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '2rem', lineHeight: 1, flexShrink: 0 }}>{opt.flag}</span>
              <div>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
                  fontWeight: 800, fontSize: '1.2rem', color: 'var(--ink)', lineHeight: 1,
                }}>
                  {opt.label}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.52rem', letterSpacing: '0.12em',
                  color: 'var(--muted)', marginTop: '0.25rem',
                }}>
                  {SUBTITLES[opt.code]}
                </div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--border)', fontSize: '0.9rem' }}>→</span>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '1.1rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--muted)',
          }}>
            SAVED — CHANGE ANYTIME FROM THE HOME SCREEN
          </span>
        </div>

      </div>
    </div>
  )
}
