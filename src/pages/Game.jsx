import { useState, useEffect, useCallback } from 'react'
import { fetchTracks } from '../spotify/api'
import { initPlayer, playSong, pauseSong } from '../spotify/player'
import Timeline from '../components/Timeline'

const PHASE = {
  LOADING: 'loading',
  READY: 'ready',
  PLAYING: 'playing',
  PLACING: 'placing',
  REVEALING: 'revealing',
  DONE: 'done',
}

export default function Game({ settings, onQuit }) {
  const [phase, setPhase] = useState(PHASE.LOADING)
  const [tracks, setTracks] = useState([])
  const [trackIdx, setTrackIdx] = useState(0)
  const [teamIdx, setTeamIdx] = useState(0)
  const [teams, setTeams] = useState([
    { name: settings.team1, timeline: [], score: 0 },
    { name: settings.team2, timeline: [], score: 0 },
  ])
  const [selectedGap, setSelectedGap] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [error, setError] = useState(null)
  const [playerReady, setPlayerReady] = useState(false)

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

  useEffect(() => {
    async function init() {
      try {
        await initPlayer()
        setPlayerReady(true)
        const t = await fetchTracks(settings)
        if (t.length === 0) throw new Error('Ingen sange fundet med de valgte indstillinger.')
        setTracks(t)
        const anchor1 = randomAnchorYear(settings.decades)
        let anchor2 = randomAnchorYear(settings.decades)
        while (anchor2 === anchor1) anchor2 = randomAnchorYear(settings.decades)
        setTeams([
          { name: settings.team1, timeline: [{ title: null, artist: null, year: anchor1, isAnchor: true }], score: 0 },
          { name: settings.team2, timeline: [{ title: null, artist: null, year: anchor2, isAnchor: true }], score: 0 },
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
  const roundNumber = trackIdx + 1
  const totalRounds = Math.min(settings.rounds, tracks.length)

  async function handlePlay() {
    try {
      await playSong(currentTrack.uri)
      setPhase(PHASE.PLAYING)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleStop() {
    try { await pauseSong() } catch {}
    setPhase(PHASE.PLACING)
  }

  function handleConfirm() {
    if (selectedGap === null) return
    const timeline = currentTeam.timeline
    const year = currentTrack.year

    const prevYear = selectedGap > 0 ? timeline[selectedGap - 1].year : -Infinity
    const nextYear = selectedGap < timeline.length ? timeline[selectedGap].year : Infinity

    const correct = year >= prevYear && year <= nextYear
    setIsCorrect(correct)

    if (correct) {
      const newCard = {
        title: currentTrack.title,
        artist: currentTrack.artist,
        year: currentTrack.year,
        albumArt: currentTrack.albumArt,
      }
      const newTimeline = [...timeline.slice(0, selectedGap), newCard, ...timeline.slice(selectedGap)]
      setTeams(prev => prev.map((t, i) =>
        i === teamIdx ? { ...t, timeline: newTimeline, score: t.score + 1 } : t
      ))
    }

    setPhase(PHASE.REVEALING)
  }

  function handleNext() {
    const nextIdx = trackIdx + 1
    if (nextIdx >= totalRounds) {
      setPhase(PHASE.DONE)
    } else {
      setTrackIdx(nextIdx)
      setTeamIdx(t => 1 - t)
      setSelectedGap(null)
      setIsCorrect(null)
      setPhase(PHASE.READY)
    }
  }

  if (error) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>⚠️</div>
        <p style={{ color: 'var(--accent)', whiteSpace: 'pre-wrap', fontSize: '0.8rem', textAlign: 'left' }}>{error}</p>
        <button className="btn-secondary" onClick={onQuit} style={{ width: 'auto', padding: '0.75rem 2rem' }}>
          Tilbage
        </button>
      </div>
    )
  }

  if (phase === PHASE.LOADING) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>🎵</div>
        <p style={{ color: 'var(--muted)' }}>Henter sange og forbinder til Spotify...</p>
      </div>
    )
  }

  if (phase === PHASE.DONE) {
    const winner = teams[0].score > teams[1].score ? teams[0]
      : teams[1].score > teams[0].score ? teams[1]
      : null

    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🏆</div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900 }}>Spillet er slut!</h2>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {teams.map((t, i) => (
            <div key={i} style={{
              background: 'var(--card)',
              border: `2px solid ${winner?.name === t.name ? 'var(--accent2)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '1rem 1.5rem',
              minWidth: 120,
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{t.name}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent2)' }}>{t.score}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>point</div>
            </div>
          ))}
        </div>
        {winner
          ? <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{winner.name} vinder! 🎉</p>
          : <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Uafgjort! 🤝</p>
        }
        <button className="btn-primary" onClick={onQuit} style={{ maxWidth: 280 }}>
          Ny opsætning
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Runde {roundNumber}/{totalRounds}</div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{currentTeam.name}</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {teams.map((t, i) => (
            <div key={i} style={{ textAlign: 'center', opacity: i === teamIdx ? 1 : 0.4 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t.name}</div>
              <div style={{ fontWeight: 900, color: 'var(--accent2)' }}>{t.score}</div>
            </div>
          ))}
        </div>
        <button onClick={onQuit} style={{
          background: 'none', color: 'var(--muted)', padding: '0.25rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--border)'
        }}>
          Afslut
        </button>
      </div>

      {/* Current song card */}
      {currentTrack && (
        <div style={{
          margin: '1rem 1rem 0',
          background: 'var(--surface)',
          border: `2px solid ${phase === PHASE.REVEALING && isCorrect ? 'var(--green)' : phase === PHASE.REVEALING ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
        }}>
          {phase === PHASE.REVEALING && currentTrack.albumArt && (
            <img src={currentTrack.albumArt} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          )}
          {phase !== PHASE.REVEALING && (
            <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
              🎵
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {phase === PHASE.REVEALING ? (
              <>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.title}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.artist}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
                Hør sangen og placer den på tidslinjen
              </div>
            )}
            {phase === PHASE.REVEALING && (
              <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--accent2)' }}>
                  {currentTrack.year}
                </span>
                <span style={{ fontWeight: 700, color: isCorrect ? 'var(--green)' : 'var(--accent)' }}>
                  {isCorrect ? '✓ Korrekt! +1' : '✗ Forkert'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {phase === PHASE.READY && (
          <button className="btn-green" onClick={handlePlay}>
            ▶ Spil sang
          </button>
        )}
        {phase === PHASE.PLAYING && (
          <button className="btn-primary" onClick={handleStop}>
            ⏸ Stop – Vælg placering
          </button>
        )}
        {phase === PHASE.PLACING && (
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={selectedGap === null}
          >
            {selectedGap === null ? 'Vælg en placering nedenfor' : 'Bekræft placering'}
          </button>
        )}
        {phase === PHASE.REVEALING && (
          <button className="btn-green" onClick={handleNext}>
            Næste tur → {teams[1 - teamIdx].name}
          </button>
        )}
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, padding: '0 1rem 1.5rem', overflowY: 'auto' }}>
        {currentTeam.timeline.length === 0 && phase !== PHASE.PLACING ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            {phase === PHASE.READY ? 'Tidslinjen er tom — spil det første kort!' : ''}
          </p>
        ) : null}

        <Timeline
          cards={currentTeam.timeline}
          selectedGap={selectedGap}
          onSelectGap={setSelectedGap}
          disabled={phase !== PHASE.PLACING}
        />
      </div>
    </div>
  )
}
