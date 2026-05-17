import { useState, useEffect, useRef } from 'react'
import { fetchTracks } from '../spotify/api'
import { initPlayer, playSong, pauseSong } from '../spotify/player'

const TEAM_COLORS = ['#c4533a', '#3a5d4a', '#2a4a7a', '#a86e2a']

const PHASE = {
  LOADING: 'loading',
  READY: 'ready',
  LISTENING: 'listening',
  PLACED: 'placed',
  REVEALED: 'revealed',
  DONE: 'done',
}

function randomAnchorYear(decades) {
  const DECADE_RANGES = {
    '60s': [1960,1969], '70s': [1970,1979], '80s': [1980,1989],
    '90s': [1990,1999], '00s': [2000,2009], '10s': [2010,2019], '20s': [2020,2025],
  }
  const all = decades.flatMap(d => {
    const [from, to] = DECADE_RANGES[d]
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  })
  return all[Math.floor(Math.random() * all.length)]
}

export default function Game({ settings, onQuit }) {
  const [phase, setPhase] = useState(PHASE.LOADING)
  const [tracks, setTracks] = useState([])
  const [trackIdx, setTrackIdx] = useState(0)
  const [teamIdx, setTeamIdx] = useState(0)
  const [teams, setTeams] = useState(() =>
    [settings.team1, settings.team2].map((name, i) => ({
      name, color: TEAM_COLORS[i], timeline: [], score: 0,
    }))
  )
  const [placedSlot, setPlacedSlot] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  // drag state
  const [drag, setDrag] = useState(null)
  const [hoverSlot, setHoverSlot] = useState(null)
  const slotsRef = useRef([])

  const songLen = 180
  useEffect(() => {
    if (!playing || phase === PHASE.REVEALED) return
    const t = setInterval(() => setProgress(p => (p + 1) % songLen), 1000)
    return () => clearInterval(t)
  }, [playing, phase])

  useEffect(() => {
    async function init() {
      try {
        await initPlayer()
        const t = await fetchTracks(settings)
        if (t.length === 0) throw new Error('Ingen sange fundet med de valgte indstillinger.')
        setTracks(t)
        const a1 = randomAnchorYear(settings.decades)
        let a2 = randomAnchorYear(settings.decades)
        while (a2 === a1) a2 = randomAnchorYear(settings.decades)
        setTeams([
          { name: settings.team1, color: TEAM_COLORS[0], timeline: [{ year: a1, isAnchor: true }], score: 0 },
          { name: settings.team2, color: TEAM_COLORS[1], timeline: [{ year: a2, isAnchor: true }], score: 0 },
        ])
        setPhase(PHASE.READY)
      } catch (e) {
        setError(e.message)
      }
    }
    init()
  }, [])

  const currentTrack = tracks[trackIdx]
  const currentTeam = teams[teamIdx]
  const totalRounds = Math.min(settings.rounds, tracks.length)

  async function handlePlay() {
    try {
      await playSong(currentTrack.uri)
      setPhase(PHASE.LISTENING)
      setPlaying(true)
      setProgress(0)
    } catch (e) {
      setError(e.message)
    }
  }

  // drag handlers
  const onPointerDown = (e) => {
    if (phase !== PHASE.LISTENING) return
    e.preventDefault()
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.setPointerCapture?.(e.pointerId)
    setDrag({
      x: e.clientX, y: e.clientY,
      offX: e.clientX - (r.left + r.width / 2),
      offY: e.clientY - (r.top + r.height / 2),
    })
  }

  const onPointerMove = (e) => {
    if (!drag) return
    setDrag(d => ({ ...d, x: e.clientX, y: e.clientY }))
    const slots = slotsRef.current.filter(Boolean)
    let hit = null, bestDist = Infinity
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i].getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      if (Math.abs(e.clientY - cy) < 140) {
        const dist = Math.abs(e.clientX - cx)
        if (dist < bestDist && dist < 80) { bestDist = dist; hit = i }
      }
    }
    setHoverSlot(hit)
  }

  const onPointerUp = () => {
    if (!drag) return
    if (hoverSlot != null) {
      setPlacedSlot(hoverSlot)
      setPhase(PHASE.PLACED)
    }
    setDrag(null)
    setHoverSlot(null)
  }

  function handleReveal() {
    const timeline = currentTeam.timeline
    const year = currentTrack.year
    const prevYear = placedSlot > 0 ? timeline[placedSlot - 1].year : -Infinity
    const nextYear = placedSlot < timeline.length ? timeline[placedSlot].year : Infinity
    const correct = year >= prevYear && year <= nextYear
    setIsCorrect(correct)

    if (correct) {
      const newCard = { title: currentTrack.title, artist: currentTrack.artist, year, albumArt: currentTrack.albumArt }
      const newTimeline = [...timeline.slice(0, placedSlot), newCard, ...timeline.slice(placedSlot)]
      setTeams(prev => prev.map((t, i) =>
        i === teamIdx ? { ...t, timeline: newTimeline, score: t.score + 1 } : t
      ))
    }
    setPhase(PHASE.REVEALED)
    setPlaying(false)
  }

  function handleNext() {
    const nextIdx = trackIdx + 1
    if (nextIdx >= totalRounds) {
      setPhase(PHASE.DONE)
    } else {
      setTrackIdx(nextIdx)
      setTeamIdx(t => 1 - t)
      setPlacedSlot(null)
      setIsCorrect(null)
      setProgress(0)
      setPlaying(false)
      setPhase(PHASE.READY)
    }
  }

  // ─── Error ───────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '2rem', textAlign: 'center', background: 'var(--bg)' }}>
        <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.72rem' }}>FEJL</span>
        <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '1rem', color: 'var(--ink2)', lineHeight: 1.5, maxWidth: 320 }}>{error}</p>
        <button onClick={onQuit} style={{ border: '1px solid var(--ink)', background: 'transparent', padding: '0.75rem 2rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
          ← TILBAGE
        </button>
      </div>
    )
  }

  // ─── Loading ─────────────────────────────────────────────────
  if (phase === PHASE.LOADING) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', background: 'var(--bg)' }}>
        <Vinyl size={80} spinning color="var(--muted)" />
        <span className="mono" style={{ fontSize: '0.68rem', animation: 'pulse 1.5s ease-in-out infinite' }}>FORBINDER TIL SPOTIFY…</span>
      </div>
    )
  }

  // ─── Done ────────────────────────────────────────────────────
  if (phase === PHASE.DONE) {
    const winner = teams[0].score > teams[1].score ? teams[0]
      : teams[1].score > teams[0].score ? teams[1] : null

    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ padding: '1.25rem 1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span className="mono" style={{ fontSize: '0.62rem' }}>SIDE A · ISSUE NO. 047</span>
            <span className="mono" style={{ fontSize: '0.62rem' }}>— end of side a —</span>
            <span className="mono" style={{ fontSize: '0.62rem' }}>GAME OVER</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: '1rem' }} />
        </div>

        <div style={{ padding: '0 1.5rem' }}>
          <div className="mono" style={{ color: 'var(--accent)', fontSize: '0.62rem', marginBottom: '0.5rem' }}>AND THE NEEDLE LIFTS ON</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic', fontWeight: 900,
              fontSize: '3.5rem', color: 'var(--accent)',
              lineHeight: 1,
            }}>{winner ? winner.name : 'Uafgjort'}</span>
            {winner && <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', paddingBottom: '0.5rem' }}>'s team</span>}
          </div>

          {/* Scores */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {teams.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '0.9rem' }}>{t.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', fontWeight: 700 }}>
                  {t.score}<span style={{ opacity: 0.4, fontSize: '0.7rem' }}>/{totalRounds}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Winning timeline */}
          {winner && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', marginBottom: '0.75rem' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ border: '1px solid var(--accent2)', padding: '1px 4px' }}>
                    <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--accent2)' }}>A1</span>
                  </div>
                  <span className="serif" style={{ fontSize: '0.95rem' }}>Vindende tidslinje · {winner.name.toUpperCase()}</span>
                </div>
                <span className="mono" style={{ fontSize: '0.6rem' }}>{winner.timeline.filter(c => !c.isAnchor).length} KORT</span>
              </div>
              <div style={{ overflowX: 'auto', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', width: 'max-content' }}>
                  {winner.timeline.filter(c => !c.isAnchor).map((card, i) => (
                    <MiniCard key={i} card={card} color={winner.color} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '1rem 1.5rem 2rem', marginTop: '1rem' }}>
          <div style={{ borderTop: '3px solid var(--ink)' }} />
          <button onClick={onQuit} className="btn-primary">
            <span>Side A</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Nyt spil</span>
          </button>
        </div>
      </div>
    )
  }

  // ─── Main game ────────────────────────────────────────────────
  const spinning = playing && (phase === PHASE.LISTENING || phase === PHASE.PLACED)
  const revealed = phase === PHASE.REVEALED
  const team = currentTeam

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', userSelect: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Header */}
      <header style={{
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={onQuit} style={{ background: 'none', border: '1px solid var(--border)', padding: '0.35rem 0.6rem', cursor: 'pointer' }}>
          <span className="mono" style={{ fontSize: '0.62rem' }}>⏸</span>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '0.6rem' }}>RUNDE {trackIdx + 1} · TUR</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1rem', color: team.color }}>
            {team.name}s hold
          </div>
        </div>
        <button onClick={onQuit} style={{ background: 'none', border: '1px solid var(--border)', padding: '0.35rem 0.6rem', cursor: 'pointer' }}>
          <span className="mono" style={{ fontSize: '0.8rem' }}>⋯</span>
        </button>
      </header>

      {/* Scores */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {teams.map((t, i) => (
          <div
            key={i}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: i === teamIdx ? t.color + '12' : 'transparent',
              borderRight: i === 0 ? '1px solid var(--border)' : 'none',
              opacity: i === teamIdx ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', flex: 1 }}>{t.name}</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '0.95rem' }}>
              {t.score}<span style={{ opacity: 0.35, fontSize: '0.7rem' }}>/{totalRounds}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Stage: turntable + mystery card */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.25rem 1rem 0.5rem', position: 'relative' }}>
        <Vinyl size={140} spinning={spinning} color={team.color} year={revealed ? currentTrack?.year : null} />

        {/* Mystery card — shown during READY and LISTENING (unless dragging) */}
        {(phase === PHASE.READY || (phase === PHASE.LISTENING && !drag)) && (
          <MysteryCardEl
            onPointerDown={onPointerDown}
            draggable={phase === PHASE.LISTENING}
          />
        )}

        {/* Floating ghost during drag */}
        {drag && (
          <MysteryCardEl
            floating
            style={{
              position: 'fixed',
              left: drag.x - drag.offX,
              top: drag.y - drag.offY,
              transform: 'translate(-50%, -50%) rotate(-3deg)',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Playback bar */}
      {phase !== PHASE.READY && phase !== PHASE.REVEALED && (
        <div style={{ padding: '0 1.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setPlaying(p => !p)}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--ink)', color: 'var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', cursor: 'pointer', flexShrink: 0,
            }}
          >{playing ? '❚❚' : '▶'}</button>
          <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(progress / songLen) * 100}%`, background: 'var(--accent)', transition: 'width 1s linear' }} />
          </div>
          <span className="mono" style={{ fontSize: '0.62rem', flexShrink: 0 }}>
            {Math.floor(progress / 60)}:{String(progress % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* Hint text */}
      <div style={{ padding: '0 1.25rem 0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', minHeight: 32 }}>
        <span style={{ color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', marginTop: 1 }}>
          {phase === PHASE.LISTENING ? '↓' : '·'}
        </span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--ink2)', lineHeight: 1.4 }}>
          {phase === PHASE.READY && 'Tryk Spil — og træk kortet til tidslinjen.'}
          {phase === PHASE.LISTENING && 'Lyt — og træk kortet ned i tidslinjen.'}
          {phase === PHASE.PLACED && 'Placeret. Diskutér titel og kunstner — afslør så svaret.'}
          {phase === PHASE.REVEALED && isCorrect && <><em>Korrekt placeret.</em> Kortet er jeres.</>}
          {phase === PHASE.REVEALED && !isCorrect && <><em>Forkert placering.</em> Kortet går tilbage i bunken.</>}
        </span>
      </div>

      {/* Timeline */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '0.5rem 1.25rem 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ border: '1px solid var(--accent2)', padding: '1px 4px' }}>
            <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--accent2)' }}>A1</span>
          </div>
          <span className="serif" style={{ fontSize: '0.85rem' }}>Tidslinje</span>
          <span className="mono" style={{ fontSize: '0.6rem', marginLeft: 'auto', color: 'var(--muted)' }}>
            {team.timeline.filter(c => !c.isAnchor).length} KORT · {team.name.toUpperCase()}
          </span>
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '0 1.25rem' }} />

        {/* Scrollable row */}
        <div style={{ overflowX: 'auto', padding: '0.6rem 1.25rem', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, width: 'max-content', minWidth: '100%' }}>
            {buildTimelineItems(team.timeline).map((it, i) => {
              if (it.kind === 'slot') {
                const j = it.idx
                const isHover = hoverSlot === j
                const isPlaced = phase !== PHASE.LISTENING && placedSlot === j
                return (
                  <div
                    key={`s${j}`}
                    ref={el => (slotsRef.current[j] = el)}
                    style={{
                      width: isPlaced ? 80 : 28,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isHover ? 'rgba(196,83,58,0.1)' : 'transparent',
                      border: isHover ? '1px solid var(--accent)' : '1px dashed var(--border)',
                      borderRadius: 2,
                      margin: '0 2px',
                      transition: 'all 0.15s',
                      minHeight: 90,
                    }}
                  >
                    {isPlaced ? (
                      phase === PHASE.REVEALED
                        ? <RevealedTLCard song={currentTrack} correct={isCorrect} teamColor={team.color} />
                        : <MiniMysteryCard />
                    ) : (
                      <span style={{ color: isHover ? 'var(--accent)' : 'var(--border)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem' }}>+</span>
                    )}
                  </div>
                )
              }
              return <TLCard key={`c${it.idx}`} card={it.card} teamColor={team.color} />
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 1.25rem 0.5rem' }}>
          <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>← TIDLIGERE</span>
          <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>NYERE →</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{ borderTop: '3px solid var(--ink)' }} />
        {phase === PHASE.READY && (
          <button onClick={handlePlay} className="btn-reveal">
            <div><div className="mono" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>KLAR?</div>
            <span>Spil sangen</span></div>
            <span>→</span>
          </button>
        )}
        {phase === PHASE.LISTENING && (
          <div style={{ padding: '0.85rem 1.25rem', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>VENTER</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--ink2)' }}>Træk kortet til en plads</span>
          </div>
        )}
        {phase === PHASE.PLACED && (
          <button onClick={handleReveal} className="btn-reveal">
            <div><div className="mono" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>KLAR?</div>
            <span>Afslør sangen</span></div>
            <span>→</span>
          </button>
        )}
        {phase === PHASE.REVEALED && (
          <button onClick={handleNext} className="btn-primary">
            <div>
              <div className="mono" style={{ fontSize: '0.6rem', color: 'rgba(196,200,180,0.7)', marginBottom: 2 }}>
                {isCorrect ? '+1 KORT' : 'INGEN GEVINST'}
              </div>
              <span>Næste hold → {teams[1 - teamIdx].name}</span>
            </div>
            <span>→</span>
          </button>
        )}
      </div>
    </div>
  )
}

function buildTimelineItems(timeline) {
  const items = []
  for (let i = 0; i <= timeline.length; i++) {
    items.push({ kind: 'slot', idx: i })
    if (i < timeline.length) items.push({ kind: 'card', card: timeline[i], idx: i })
  }
  return items
}

// ─── Vinyl component ─────────────────────────────────────────
function Vinyl({ size, spinning, color, year }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: '#1c1810',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      boxShadow: '0 6px 28px rgba(0,0,0,0.25)',
      animation: spinning ? 'spin 2.4s linear infinite' : 'none',
      flexShrink: 0,
    }}>
      {[0.84, 0.70, 0.57].map((r, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: size * r, height: size * r,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }} />
      ))}
      {/* Tonearm */}
      <div style={{
        position: 'absolute',
        top: size * 0.04,
        right: size * -0.04,
        width: 3,
        height: size * 0.52,
        background: '#8a8278',
        borderRadius: 2,
        transformOrigin: 'top center',
        transform: 'rotate(-30deg)',
        zIndex: 2,
      }} />
      {/* Label */}
      <div style={{
        width: size * 0.38, height: size * 0.38,
        borderRadius: '50%',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
        position: 'relative',
      }}>
        {year ? (
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: 'italic', fontWeight: 900,
            fontSize: size * 0.12,
            color: '#fff',
            letterSpacing: '-0.02em',
          }}>{year}</span>
        ) : (
          <span style={{ fontSize: size * 0.14, color: 'rgba(255,255,255,0.8)' }}>♪</span>
        )}
        <div style={{
          position: 'absolute',
          width: size * 0.06, height: size * 0.06,
          borderRadius: '50%',
          background: 'var(--bg)',
        }} />
      </div>
    </div>
  )
}

// ─── Mystery card (draggable) ────────────────────────────────
function MysteryCardEl({ onPointerDown, draggable, floating, style }) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        width: 80, height: 110,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 6px 6px',
        touchAction: 'none',
        cursor: draggable ? 'grab' : 'default',
        position: floating ? 'fixed' : 'absolute',
        bottom: floating ? undefined : -50,
        boxShadow: floating ? '0 8px 24px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.12)',
        ...style,
      }}
    >
      <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--accent2)', alignSelf: 'flex-start' }}>SIDE A</span>
      <span style={{
        fontFamily: "'Playfair Display', serif",
        fontStyle: 'italic', fontWeight: 900,
        fontSize: '2.2rem', color: 'var(--muted)',
        lineHeight: 1,
      }}>?</span>
      <div style={{ textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: '0.48rem', color: 'var(--muted)' }}>AFSPILLER…</div>
        {draggable && <div className="mono" style={{ fontSize: '0.48rem', color: 'var(--accent)', marginTop: 2 }}>↕ TRÆK</div>}
      </div>
    </div>
  )
}

// ─── Timeline card ────────────────────────────────────────────
function TLCard({ card, teamColor }) {
  if (card.isAnchor) {
    return (
      <div style={{
        width: 80, height: 90, flexShrink: 0,
        background: 'var(--card)',
        border: `1px solid ${teamColor}`,
        borderRadius: 3,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4, margin: '0 2px',
      }}>
        <span className="mono" style={{ fontSize: '0.5rem', color: teamColor }}>STARTÅR</span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.4rem', color: teamColor, lineHeight: 1 }}>{card.year}</span>
      </div>
    )
  }
  return (
    <div style={{
      width: 80, height: 90, flexShrink: 0,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 3,
      display: 'flex', flexDirection: 'column',
      padding: '6px 6px 5px',
      position: 'relative',
      margin: '0 2px',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: teamColor, position: 'absolute', top: 5, right: 5 }} />
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.5rem', color: 'var(--accent)', lineHeight: 1, marginBottom: 'auto' }}>{card.year}</span>
      <div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.artist}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.52rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
      </div>
    </div>
  )
}

function MiniMysteryCard() {
  return (
    <div style={{
      width: 72, height: 86,
      background: 'var(--surface)',
      border: '1px dashed var(--accent)',
      borderRadius: 3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.8rem', color: 'var(--muted)' }}>?</span>
    </div>
  )
}

function RevealedTLCard({ song, correct, teamColor }) {
  return (
    <div style={{
      width: 72, height: 86,
      background: correct ? 'rgba(58,93,74,0.08)' : 'rgba(196,83,58,0.08)',
      border: `1px solid ${correct ? 'var(--green)' : 'var(--accent)'}`,
      borderRadius: 3,
      display: 'flex', flexDirection: 'column',
      padding: '5px',
      position: 'relative',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: teamColor, position: 'absolute', top: 4, right: 4 }} />
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.3rem', color: correct ? 'var(--green)' : 'var(--accent)', lineHeight: 1, marginBottom: 'auto' }}>{song?.year}</span>
      <div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song?.artist}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song?.title}</div>
        <div className="mono" style={{ fontSize: '0.5rem', marginTop: 2, color: correct ? 'var(--green)' : 'var(--accent)' }}>
          {correct ? 'KEEPER' : 'FORKERT'}
        </div>
      </div>
    </div>
  )
}

function MiniCard({ card, color }) {
  return (
    <div style={{
      width: 75, height: 95,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 3,
      display: 'flex', flexDirection: 'column',
      padding: '6px 6px 5px',
      position: 'relative',
      flexShrink: 0,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, position: 'absolute', top: 5, right: 5 }} />
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.4rem', color: 'var(--accent)', lineHeight: 1, marginBottom: 'auto' }}>{card.year}</span>
      <div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.artist}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
      </div>
    </div>
  )
}
