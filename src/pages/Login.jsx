import { login } from '../spotify/auth'

export default function Login() {
  return (
    <div style={{
      minHeight: '100%',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {/* Masthead */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <span className="mono" style={{ color: 'var(--muted)' }}>EST. MMXXVI</span>
        <span className="mono" style={{ color: 'var(--muted)' }}>WELCOME</span>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginBottom: '0.5rem' }} />
      <div style={{ borderTop: '3px solid var(--ink)', marginBottom: '1.5rem' }} />

      {/* Hero block */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div className="mono" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>A LISTENING GAME</div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              fontSize: 'clamp(3rem, 15vw, 5rem)',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              margin: 0,
            }}>
              Side
            </h1>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              fontStyle: 'italic',
              fontSize: 'clamp(3.5rem, 18vw, 6rem)',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              color: 'var(--accent)',
              margin: 0,
            }}>
              A.
            </h1>
          </div>

          {/* Vinyl graphic */}
          <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
            <Vinyl size={110} />
          </div>
        </div>

        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          fontSize: '1.05rem',
          lineHeight: 1.5,
          color: 'var(--ink2)',
          marginBottom: '1rem',
          maxWidth: 300,
        }}>
          A music timeline quiz for parties, families <span style={{ color: 'var(--accent)' }}>and</span> obscure DJs.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ flex: 1, borderTop: '1px solid var(--accent)', opacity: 0.4 }} />
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>
            PLACE THE SONG · NAME THE ARTIST · WIN THE CARD
          </span>
        </div>

        {/* How it goes */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 18, height: 18, border: '1px solid var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--accent2)', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700 }}>§</span>
            </div>
            <span className="serif" style={{ fontSize: '1rem' }}>How it goes</span>
          </div>
          {[
            'En sang spiller. Du ser ikke hvad det er.',
            'Træk kortet til det rigtige sted på tidslinjen.',
            'Gæt titel eller kunstner — og vind kortet.',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--accent)',
                lineHeight: 1.2,
                minWidth: '1rem',
              }}>{i + 1}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5, fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div>
        <div style={{ borderTop: '3px solid var(--ink)', marginBottom: '0' }} />
        <button
          onClick={login}
          style={{
            width: '100%',
            background: '#1db954',
            color: '#000',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 0,
          }}
        >
          <span>LOG IND MED SPOTIFY</span>
          <SpotifyLogo />
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0 0', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: '0.6rem' }}>KRÆVER SPOTIFY PREMIUM</span>
          <span className="mono" style={{ fontSize: '0.6rem' }}>SIDE 01 / 04</span>
        </div>
      </div>
    </div>
  )
}

function Vinyl({ size = 100 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: '#2a261f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      flexShrink: 0,
    }}>
      {/* Groove rings */}
      {[0.82, 0.68, 0.54].map((r, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: size * r, height: size * r,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.06)',
        }} />
      ))}
      {/* Label */}
      <div style={{
        width: size * 0.38, height: size * 0.38,
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: size * 0.07,
          color: 'rgba(255,255,255,0.85)',
          letterSpacing: '0.08em',
          textAlign: 'center',
          lineHeight: 1.3,
        }}>SIDE{'\n'}A</span>
        {/* Center hole */}
        <div style={{
          position: 'absolute',
          width: size * 0.07, height: size * 0.07,
          borderRadius: '50%',
          background: 'var(--bg)',
        }} />
      </div>
    </div>
  )
}

function SpotifyLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}
