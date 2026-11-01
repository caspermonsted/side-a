import { useState, useEffect, useRef } from 'react'
import { searchArtists, prepareArtist } from '../spotify/homeTurf'

const PLAYER_COLORS = ['#c4533a', '#3a5d4a', '#2a4a7a', '#a86e2a']
const MONO = "'JetBrains Mono', monospace"
const SERIF = "'Playfair Display', serif"

function formatFans(n) {
  if (!n) return '0 fans'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M fans`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K fans`
  return `${n} fans`
}

export default function HomeTurfSetup({ initial, onStart, onBack }) {
  // "Play again" comes back here with the previous players and artists filled in.
  const [players, setPlayers] = useState(() => initial?.teams?.length
    ? initial.teams.map(t => ({ name: t.name, artist: t.artist, pool: { loading: true } }))
    : [
        { name: 'Player 1', artist: null, pool: null },
        { name: 'Player 2', artist: null, pool: null },
      ])
  const [target, setTarget] = useState(initial?.target ?? 10)

  useEffect(() => {
    players.forEach((p, i) => { if (p.artist) pickArtist(i, p.artist) })
  }, [])

  function update(i, patch) {
    setPlayers(prev => prev.map((p, j) => j === i ? { ...p, ...patch } : p))
  }

  async function pickArtist(i, artist) {
    update(i, { artist, pool: { loading: true } })
    try {
      const pool = await prepareArtist(artist.id)
      // Ignore the answer if the player changed artist in the meantime.
      setPlayers(prev => prev.map((p, j) => j === i && p.artist?.id === artist.id ? { ...p, pool } : p))
    } catch (e) {
      setPlayers(prev => prev.map((p, j) => j === i && p.artist?.id === artist.id ? { ...p, pool: { error: e.message } } : p))
    }
  }

  function addPlayer() {
    if (players.length >= 4) return
    setPlayers(prev => [...prev, { name: `Player ${prev.length + 1}`, artist: null, pool: null }])
  }

  function removePlayer() {
    if (players.length <= 2) return
    setPlayers(prev => prev.slice(0, -1))
  }

  const takenBy = id => players.findIndex(p => p.artist?.id === id)
  const allReady = players.every(p => p.name.trim() && p.artist && p.pool?.ok)

  function handleStart() {
    if (!allReady) return
    onStart({
      homeTurf: true,
      teams: players.map((p, i) => ({
        name: p.name.trim(),
        color: PLAYER_COLORS[i],
        artist: { id: p.artist.id, name: p.pool.artist?.name || p.artist.name, picture: p.artist.picture },
      })),
      target,
      decades: [],
      difficulty: 'home-turf',
    })
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>
      {/* Top strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--border)',
        fontFamily: MONO, fontSize: '0.62rem', letterSpacing: '0.18em', color: 'var(--label)',
      }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: '0.58rem', padding: '0.25rem 0.5rem' }}>← BACK</button>
        <span>HOME TURF</span>
        <span>33⅓ RPM</span>
      </div>

      {/* Hero */}
      <div style={{ padding: '1rem 1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--label)', marginBottom: '0.3rem' }}>
          PICK YOUR ARTIST
        </div>
        <h1 style={{
          fontFamily: SERIF, fontWeight: 900, fontSize: 'clamp(3.2rem, 16vw, 4.5rem)',
          lineHeight: 0.88, letterSpacing: '-0.04em', color: 'var(--ink)', margin: '0 0 0.75rem',
        }}>Home<br />turf</h1>
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--ink2)', margin: 0, lineHeight: 1.45 }}>
          Every player picks an artist and only hears songs by them. Name the title <em>and</em> place it right on your timeline to win the card.
        </p>
      </div>

      <SectionBlock number="H1" title="Players" sub={`${players.length} players`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {players.map((p, i) => (
            <PlayerRow
              key={i}
              index={i}
              player={p}
              color={PLAYER_COLORS[i]}
              onName={name => update(i, { name })}
              onPick={artist => {
                const owner = takenBy(artist.id)
                if (owner !== -1 && owner !== i) {
                  update(i, { artist: null, pool: { taken: players[owner].name || `Player ${owner + 1}`, takenName: artist.name } })
                  return
                }
                pickArtist(i, artist)
              }}
              onClear={() => update(i, { artist: null, pool: null })}
            />
          ))}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <SmallButton onClick={removePlayer} disabled={players.length <= 2}>− Remove player</SmallButton>
            <SmallButton onClick={addPlayer} disabled={players.length >= 4}>+ Add player</SmallButton>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock number="H2" title="Cards to win" sub="First to this wins">
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[3, 5, 10].map(n => {
            const active = target === n
            return (
              <button key={n} onClick={() => setTarget(n)} style={{
                flex: 1, padding: '0.75rem',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--ink)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
              }}>
                <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 900, fontSize: '1.8rem', lineHeight: 1 }}>{n}</span>
                <span style={{ fontFamily: MONO, fontSize: '0.52rem', opacity: 0.6 }}>{n === 3 ? 'QUICK' : n === 5 ? 'MEDIUM' : 'FULL'}</span>
              </button>
            )
          })}
        </div>
      </SectionBlock>

      <div style={{ padding: '0.5rem 1.25rem 2rem' }}>
        <button
          onClick={handleStart}
          disabled={!allReady}
          data-testid="ht-start"
          style={{
            width: '100%', border: '1px solid var(--ink)',
            background: 'var(--ink)', color: 'var(--bg)',
            padding: '1.1rem 1.25rem', cursor: allReady ? 'pointer' : 'default',
            opacity: allReady ? 1 : 0.45,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
          }}
        >
          <div>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.18em', color: '#d4a13a', marginBottom: '0.2rem' }}>
              {allReady ? 'DROP THE NEEDLE' : 'EVERY PLAYER NEEDS AN ARTIST'}
            </div>
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 800, fontSize: '1.4rem' }}>Begin the game</div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
          }}>▶</div>
        </button>
      </div>
    </div>
  )
}

function PlayerRow({ index, player, color, onName, onPick, onClear }) {
  const { artist, pool } = player
  return (
    <div data-testid={`ht-player-${index}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem 0.9rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 800, fontSize: '1.1rem', color: '#fff', flexShrink: 0,
        }}>{player.name.charAt(0).toUpperCase()}</div>
        <input
          type="text" value={player.name} maxLength={20}
          onChange={e => onName(e.target.value)}
          style={{ fontSize: '1.05rem', padding: 0, minWidth: 0 }}
          aria-label={`Player ${index + 1} name`}
        />
        <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: 'var(--muted)' }}>{String(index + 1).padStart(2, '0')}</span>
      </div>

      <div style={{ marginTop: '0.6rem' }}>
        {artist ? (
          <ArtistChip artist={artist} pool={pool} color={color} onClear={onClear} />
        ) : (
          <>
            <ArtistSearch onPick={onPick} />
            {pool?.taken && (
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.35rem' }}>
                {pool.takenName} is already {pool.taken}'s home turf — pick another artist.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ArtistChip({ artist, pool, color, onClear }) {
  let status, statusColor = 'var(--muted)'
  if (!pool || pool.loading) status = 'Digging through the discography…'
  else if (pool.error) { status = `Couldn't load songs: ${pool.error}`; statusColor = 'var(--accent)' }
  else if (!pool.ok) { status = `Only ${pool.count} playable songs — needs ${pool.minSongs}. Pick another artist.`; statusColor = 'var(--accent)' }
  else { status = `✓ ${pool.count} songs ready`; statusColor = 'var(--green)' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderTop: `2px solid ${color}`, paddingTop: '0.6rem' }}>
      {artist.picture
        ? <img src={artist.picture} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.name}</div>
        <div data-testid="ht-status" style={{ fontFamily: MONO, fontSize: '0.58rem', letterSpacing: '0.04em', color: statusColor, marginTop: 2, lineHeight: 1.4 }}>
          {pool?.loading && <span style={{ display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }}>♪ </span>}
          {status}
        </div>
      </div>
      <button className="btn-ghost" onClick={onClear} style={{ fontSize: '0.55rem', padding: '0.3rem 0.5rem', flexShrink: 0 }}>CHANGE</button>
    </div>
  )
}

function ArtistSearch({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)
  const ctrl = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    ctrl.current?.abort()
    const query = q.trim()
    if (query.length < 2) { setResults([]); setLoading(false); setError(null); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const c = new AbortController()
      ctrl.current = c
      try {
        const r = await searchArtists(query, c.signal)
        if (!c.signal.aborted) { setResults(r.slice(0, 6)); setError(null) }
      } catch (e) {
        if (e.name !== 'AbortError') setError('Search failed — try again.')
      } finally {
        if (!c.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [q])

  return (
    <div>
      <input
        type="search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search for an artist…"
        aria-label="Search for an artist"
        style={{
          width: '100%', boxSizing: 'border-box', fontSize: '0.95rem',
          padding: '0.55rem 0.7rem', border: '1px solid var(--border)', background: 'var(--bg)',
        }}
      />
      {loading && <div style={{ fontFamily: MONO, fontSize: '0.58rem', color: 'var(--muted)', marginTop: '0.4rem' }}>SEARCHING…</div>}
      {error && <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.4rem' }}>{error}</div>}
      {!loading && results.length > 0 && (
        <div style={{ marginTop: '0.4rem', border: '1px solid var(--border)', background: 'var(--bg)' }}>
          {results.map(a => (
            <button
              key={a.id}
              onClick={() => { onPick(a); setQ(''); setResults([]) }}
              data-testid="ht-result"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.45rem 0.6rem', background: 'transparent', border: 'none',
                borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              {a.picture
                ? <img src={a.picture} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />}
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '0.92rem', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>{a.name}</span>
              <span style={{ fontFamily: MONO, fontSize: '0.55rem', color: 'var(--muted)', flexShrink: 0 }}>{formatFans(a.fans)}</span>
            </button>
          ))}
        </div>
      )}
      {!loading && !error && q.trim().length >= 2 && results.length === 0 && (
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.4rem' }}>No artists found.</div>
      )}
    </div>
  )
}

function SmallButton({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '0.6rem', border: '1px solid var(--border)', background: 'transparent',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
      fontFamily: MONO, fontSize: '0.65rem', letterSpacing: '0.1em',
    }}>{children}</button>
  )
}

function SectionBlock({ number, title, sub, children }) {
  return (
    <div style={{ padding: '1rem 1.25rem 0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--label)', border: '1px solid var(--label)', padding: '1px 5px' }}>{number}</span>
          <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 800, fontSize: '1.4rem', margin: 0, letterSpacing: '-0.02em' }}>{title}</h2>
        </div>
        <span style={{ fontFamily: MONO, fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--muted)' }}>{sub}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--ink)', marginBottom: '0.75rem' }} />
      {children}
    </div>
  )
}
