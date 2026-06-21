import { useState, useEffect, useRef } from 'react'
import { fetchTracks, fetchPreviewUrl } from '../spotify/api'
import { playSong, resumeSong, pauseSong } from '../spotify/player'

const platform = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'ios' : 'desktop'
import { log } from '../log'
import { sessionStart, sessionEnd, sessionError, sessionPlayPressed, sessionSongPlayed } from '../session'

const DEMO_TRACKS = [
  { uri: 'd1', title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, albumArt: null },
  { uri: 'd2', title: 'Like a Prayer', artist: 'Madonna', year: 1989, albumArt: null },
  { uri: 'd3', title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, albumArt: null },
  { uri: 'd4', title: 'Rolling in the Deep', artist: 'Adele', year: 2010, albumArt: null },
  { uri: 'd5', title: 'Shape of You', artist: 'Ed Sheeran', year: 2017, albumArt: null },
  { uri: 'd6', title: 'Stayin\' Alive', artist: 'Bee Gees', year: 1977, albumArt: null },
  { uri: 'd7', title: 'Billie Jean', artist: 'Michael Jackson', year: 1982, albumArt: null },
  { uri: 'd8', title: 'Mr. Brightside', artist: 'The Killers', year: 2003, albumArt: null },
  { uri: 'd9', title: 'Gold Digger', artist: 'Kanye West', year: 2005, albumArt: null },
  { uri: 'd10', title: 'Blinding Lights', artist: 'The Weeknd', year: 2019, albumArt: null },
  { uri: 'd11', title: 'Hotel California', artist: 'Eagles', year: 1977, albumArt: null },
  { uri: 'd12', title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', year: 1987, albumArt: null },
  { uri: 'd13', title: 'Baby One More Time', artist: 'Britney Spears', year: 1998, albumArt: null },
  { uri: 'd14', title: 'Crazy in Love', artist: 'Beyoncé', year: 2003, albumArt: null },
  { uri: 'd15', title: 'Happy', artist: 'Pharrell Williams', year: 2013, albumArt: null },
  { uri: 'd16', title: 'Born to Run', artist: 'Bruce Springsteen', year: 1975, albumArt: null },
  { uri: 'd17', title: 'Push It', artist: 'Salt-N-Pepa', year: 1987, albumArt: null },
  { uri: 'd18', title: 'Lose Yourself', artist: 'Eminem', year: 2002, albumArt: null },
  { uri: 'd19', title: 'Since U Been Gone', artist: 'Kelly Clarkson', year: 2004, albumArt: null },
  { uri: 'd20', title: 'Old Town Road', artist: 'Lil Nas X', year: 2019, albumArt: null },
  { uri: 'd21', title: 'Johnny B. Goode', artist: 'Chuck Berry', year: 1958, albumArt: null },
  { uri: 'd22', title: 'Superstition', artist: 'Stevie Wonder', year: 1972, albumArt: null },
  { uri: 'd23', title: 'Roxanne', artist: 'The Police', year: 1978, albumArt: null },
  { uri: 'd24', title: 'Vogue', artist: 'Madonna', year: 1990, albumArt: null },
  { uri: 'd25', title: 'Waterfalls', artist: 'TLC', year: 1994, albumArt: null },
  { uri: 'd26', title: 'Yeah!', artist: 'Usher', year: 2004, albumArt: null },
  { uri: 'd27', title: 'Somebody That I Used to Know', artist: 'Gotye', year: 2011, albumArt: null },
  { uri: 'd28', title: 'Levitating', artist: 'Dua Lipa', year: 2020, albumArt: null },
  { uri: 'd29', title: 'As It Was', artist: 'Harry Styles', year: 2022, albumArt: null },
  { uri: 'd30', title: 'I Will Always Love You', artist: 'Whitney Houston', year: 1992, albumArt: null },
]

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const TEAM_COLORS = ['#c4533a', '#3a5d4a', '#2a4a7a', '#a86e2a']

const PHASE = {
  LOADING: 'loading',
  READY: 'ready',
  LISTENING: 'listening',
  PLACED: 'placed',
  REVEALED: 'revealed',
  JUDGED: 'judged',
  HANDOFF: 'handoff',
  DONE: 'done',
  GAMEOVER: 'gameover',
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

export default function Game({ settings, onQuit, onScores }) {
  const isSolo = !!settings.solo
  const [phase, setPhase] = useState(PHASE.LOADING)
  const [tracks, setTracks] = useState([])
  const [trackIdx, setTrackIdx] = useState(0)
  const [teamIdx, setTeamIdx] = useState(0)
  const [teams, setTeams] = useState(() =>
    settings.teams.map((t, i) => ({
      name: t.name, color: TEAM_COLORS[i], timeline: [], score: 0,
    }))
  )
  const [placedSlot, setPlacedSlot] = useState(null)
  const [yearCorrect, setYearCorrect] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [roundCount, setRoundCount] = useState(0)
  const [loadStep, setLoadStep] = useState(0)
  const [lives, setLives] = useState(3)
  const [playerName, setPlayerName] = useState('')
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const [challengeCount, setChallengeCount] = useState(0)
  const [challengeLoading, setChallengeLoading] = useState(false)
  const [challengeResult, setChallengeResult] = useState(null)
  const [finalRoundTeams, setFinalRoundTeams] = useState(0)
  const [suddenDeathQueue, setSuddenDeathQueue] = useState([])
  const [nextTeamIdx, setNextTeamIdx] = useState(null)

  // drag state
  const [drag, setDrag] = useState(null)
  const [hoverSlot, setHoverSlot] = useState(null)
  const slotsRef = useRef([])
  const seenIds = useRef(new Set())
  const fetchingMore = useRef(false)
  const topupFails = useRef(0)
  const playPresses = useRef(0)

  const [personalBest] = useState(() => {
    if (!settings.solo) return null
    const v = localStorage.getItem(`solo_best_${settings.difficulty}`)
    return v !== null ? parseInt(v, 10) : null
  })
  const alreadyBeatBest = useRef(false)
  const [encouragementMsg, setEncouragementMsg] = useState(null)


  const songLen = 180
  useEffect(() => {
    if (!playing || phase === PHASE.REVEALED || phase === PHASE.JUDGED) return
    const t = setInterval(() => setProgress(p => (p + 1) % songLen), 1000)
    return () => clearInterval(t)
  }, [playing, phase])

  useEffect(() => {
    if (phase !== PHASE.LOADING) return
    const steps = [0, 1, 2, 3, 4]
    const timers = steps.map(i => setTimeout(() => setLoadStep(i + 1), i * 600))
    return () => timers.forEach(clearTimeout)
  }, [phase])

  // If a track has no previewUrl when it reaches READY, try fetching it once before skipping.
  // This breaks the cascade: without the async fetch, a miss at track N causes N+1, N+2, …
  // to all auto-skip synchronously (none entered LISTENING so none were prefetched).
  // With it, each miss costs one Deezer round-trip — the cascade becomes a slow crawl.
  useEffect(() => {
    if (phase !== PHASE.READY || settings.demo || !currentTrack) return
    if (currentTrack.previewUrl) return
    let cancelled = false
    const id = currentTrack.id
    fetchPreviewUrl(currentTrack.title, currentTrack.artist).then(url => {
      if (cancelled) return
      if (url) {
        setTracks(prev => prev.map((t, i) => i === trackIdx ? { ...t, previewUrl: url } : t))
      } else {
        fetch(`/api/songs/${id}/deezer-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: false }),
        }).catch(() => {})
        setTrackIdx(t => t + 1)
      }
    }).catch(() => { if (!cancelled) setTrackIdx(t => t + 1) })
    return () => { cancelled = true }
  }, [phase, trackIdx])

  // While a song is playing, prefetch the next 3 tracks' Deezer URLs in the background.
  // Lookahead of 3 prevents the cascade auto-skip bug: if a track misses Deezer and
  // auto-skips (never entering LISTENING), the next track would also have no URL and
  // cascade-skip through the entire pool. With 3-track lookahead, a miss only skips 1
  // track before the buffer catches up. (3 consecutive misses at 2.9% rate = 0.0024%.)
  useEffect(() => {
    if (phase !== PHASE.LISTENING || settings.demo) return
    for (let ahead = 1; ahead <= 3; ahead++) {
      const next = tracks[trackIdx + ahead]
      if (!next || next.previewUrl) continue
      const idx = trackIdx + ahead
      fetchPreviewUrl(next.title, next.artist).then(url => {
        if (url) setTracks(prev => prev.map((t, i) => i === idx ? { ...t, previewUrl: url } : t))
        fetch(`/api/songs/${next.id}/deezer-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: !!url }),
        }).catch(() => {})
      })
    }
  }, [phase, trackIdx])

  // Trigger early (> 20 remaining), fetch generously (60), and back off after
  // repeated failures so we don't hammer the API with doomed rate-limit retries.
  useEffect(() => {
    if (settings.demo || fetchingMore.current) return
    const remaining = tracks.length - trackIdx
    if (remaining > 20 || tracks.length === 0) return
    if (topupFails.current >= 3) {
      // All songs exhausted — clear seen list and recycle rather than ending prematurely
      seenIds.current.clear()
      topupFails.current = 0
    }
    fetchingMore.current = true
    // Don't enrichPreviews in top-up — Deezer rate limits cause empty results for Danish songs.
    // Tracks without previews are auto-skipped by the useEffect above when they reach READY.
    fetchTracks({ ...settings, count: 120, exclude: seenIds.current, enrichPreviews: false })
      .then(more => {
        if (more.length > 0) {
          topupFails.current = 0
          more.forEach(t => seenIds.current.add(t.id))
          setTracks(prev => [...prev, ...more])
        } else {
          // Empty result: every song has been seen — count as failure so we recycle sooner
          topupFails.current++
        }
      })
      .catch(() => { topupFails.current++ })
      .finally(() => { fetchingMore.current = false })
  }, [trackIdx, tracks.length])

  useEffect(() => {
    async function init() {
      try {
        let t
        if (settings.demo) {
          t = shuffled(DEMO_TRACKS)
        } else {
          t = await fetchTracks({ ...settings, count: 60, enrichPreviews: 5 })
          if (t.length === 0) throw new Error('No songs found. Try selecting more decades.')
          t.forEach(track => seenIds.current.add(track.id))
          log('game_start', {
            platform,
            decades: settings.decades,
            difficulty: settings.difficulty,
            tracks_loaded: t.length,
          })
          sessionStart({
            platform,
            num_teams: settings.teams.length,
            difficulty: settings.difficulty,
            decades: settings.decades,
            target: settings.target ?? 10,
            tracks_loaded: t.length,
          })
        }
        setTracks(t)
        const anchorYears = []
        while (anchorYears.length < settings.teams.length) {
          const y = randomAnchorYear(settings.decades)
          if (!anchorYears.includes(y)) anchorYears.push(y)
        }
        setTeams(settings.teams.map((team, i) => ({
          name: team.name, color: TEAM_COLORS[i],
          timeline: [{ year: anchorYears[i], isAnchor: true }],
          score: 0,
        })))
        setPhase(PHASE.READY)
      } catch (e) {
        log('error', { platform, message: e.message, phase: 'init' })
        sessionError(e.message)
        setError(e.message)
      }
    }
    init()
  }, [])

  const currentTrack = tracks[trackIdx]
  const currentTeam = teams[teamIdx]

  async function handlePlay() {
    playPresses.current++
    if (!settings.demo) sessionPlayPressed()
    if (!currentTrack) {
      if (isSolo) { setPhase(PHASE.GAMEOVER); return }
      // Team mode: recycle the seen-list and fetch a fresh batch rather than ending the game
      if (!fetchingMore.current) {
        seenIds.current.clear()
        topupFails.current = 0
        fetchingMore.current = true
        fetchTracks({ ...settings, count: 120, exclude: seenIds.current, enrichPreviews: false })
          .then(more => {
            if (more.length > 0) {
              more.forEach(t => seenIds.current.add(t.id))
              setTracks(prev => [...prev, ...more])
            }
          })
          .catch(() => {})
          .finally(() => { fetchingMore.current = false })
      }
      return
    }
    try {
      if (!settings.demo) await playSong(currentTrack)
      setPhase(PHASE.LISTENING)
      setPlaying(true)
      setProgress(0)
    } catch (e) {
      if (e.name === 'AbortError' || e.name === 'NotSupportedError') {
        // Transient browser audio state error — not a real failure.
        // Stay in READY so the user can press Play again.
        return
      }
      if (e.message.includes('No preview')) {
        // Skip this track. In team games never end here — top-up keeps adding songs.
        // In solo, only end if truly out of songs.
        if (isSolo && trackIdx + 1 >= tracks.length) {
          setPhase(PHASE.GAMEOVER)
        } else {
          setTrackIdx(t => t + 1)
        }
      } else {
        sessionError(e.message)
        setError(e.message)
      }
    }
  }

  // drag handlers
  const onPointerDown = (e) => {
    if (phase !== PHASE.LISTENING && phase !== PHASE.PLACED) return
    e.preventDefault()
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.setPointerCapture?.(e.pointerId)
    // Pick the card back up — return to LISTENING so the slot reopens
    if (phase === PHASE.PLACED) {
      setPlacedSlot(null)
      setPhase(PHASE.LISTENING)
    }
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
    const yc = year >= prevYear && year <= nextYear
    setYearCorrect(yc)
    setPlaying(false)
    if (!settings.demo) pauseSong()

    // Wrong year in party mode — no point asking about artist, skip straight to JUDGED
    if (!isSolo && !yc) {
      if (!settings.demo) sessionSongPlayed({ id: currentTrack.id, title: currentTrack.title, artist: currentTrack.artist, year: currentTrack.year, year_correct: false, artist_correct: false })
      setIsCorrect(false)
      setPhase(PHASE.JUDGED)
      return
    }

    setPhase(PHASE.REVEALED)

    if (isSolo) {
      if (yc) {
        const newCard = { title: currentTrack.title, artist: currentTrack.artist, year: currentTrack.year, albumArt: currentTrack.albumArt }
        const newTimeline = [...timeline.slice(0, placedSlot), newCard, ...timeline.slice(placedSlot)]
        const newScore = teams[0].score + 1
        setTeams(prev => prev.map((t, i) =>
          i === teamIdx ? { ...t, timeline: newTimeline, score: newScore } : t
        ))
        if (personalBest !== null) {
          if (newScore === personalBest - 1 && personalBest >= 2) {
            setEncouragementMsg(`One more to beat your best of ${personalBest} on ${settings.difficulty}`)
          } else if (!alreadyBeatBest.current && newScore > personalBest) {
            setEncouragementMsg(`New personal best on ${settings.difficulty}!`)
            alreadyBeatBest.current = true
          }
        }
      } else {
        setLives(l => l - 1)
      }
    }
  }

  function handleJudge(guessedTitle) {
    const correct = yearCorrect && guessedTitle
    if (!settings.demo) sessionSongPlayed({ id: currentTrack.id, title: currentTrack.title, artist: currentTrack.artist, year: currentTrack.year, year_correct: yearCorrect, artist_correct: !!guessedTitle })
    setIsCorrect(correct)
    if (correct) {
      const timeline = currentTeam.timeline
      const newCard = { title: currentTrack.title, artist: currentTrack.artist, year: currentTrack.year, albumArt: currentTrack.albumArt }
      const newTimeline = [...timeline.slice(0, placedSlot), newCard, ...timeline.slice(placedSlot)]
      setTeams(prev => prev.map((t, i) =>
        i === teamIdx ? { ...t, timeline: newTimeline, score: t.score + 1 } : t
      ))
    }
    setPhase(PHASE.JUDGED)
  }

  const TARGET = settings.target ?? 10

  function handleSoloNext() {
    if (!settings.demo) sessionSongPlayed({ id: currentTrack.id, title: currentTrack.title, artist: currentTrack.artist, year: currentTrack.year, year_correct: yearCorrect, artist_correct: null })
    if (lives <= 0 || trackIdx + 1 >= tracks.length) {
      const finalScore = teams[0].score
      if (personalBest === null || finalScore > personalBest) {
        localStorage.setItem(`solo_best_${settings.difficulty}`, finalScore)
      }
      if (!settings.demo) {
        sessionEnd({
          completed: true,
          rounds_played: trackIdx + 1,
          final_scores: teams.map(t => ({ name: t.name, score: t.score })),
          play_presses: playPresses.current,
        })
      }
      setPhase(PHASE.GAMEOVER)
    } else {
      handleBeginTurn()
    }
  }

  async function handleSubmitScore() {
    const score = teams[0].score
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim(), score, difficulty: settings.difficulty, decades: settings.decades }),
      })
    } catch {}
    setScoreSubmitted(true)
  }

  function endOrContinue() {
    const topScore = Math.max(...teams.map(t => t.score))
    const tiedIndices = teams.map((_, i) => i).filter(i => teams[i].score === topScore)
    if (tiedIndices.length > 1) {
      // Tie → sudden death: each tied team plays one full turn, then re-check
      setSuddenDeathQueue(tiedIndices)
      setNextTeamIdx(tiedIndices[0])
      setRoundCount(r => r + 1)
      setPhase(PHASE.HANDOFF)
    } else {
      log('game_end', {
        platform,
        rounds: trackIdx + 1,
        scores: teams.map(t => ({ name: t.name, score: t.score })),
      })
      if (!settings.demo) {
        sessionEnd({
          completed: true,
          rounds_played: trackIdx + 1,
          final_scores: teams.map(t => ({ name: t.name, score: t.score })),
        })
      }
      setFinalRoundTeams(0)
      setSuddenDeathQueue([])
      setPhase(PHASE.DONE)
    }
  }

  function handleNext() {
    const isFinalRound = finalRoundTeams > 0
    const isSuddenDeath = suddenDeathQueue.length > 0

    if (isSuddenDeath) {
      const newQueue = suddenDeathQueue.slice(1)
      if (newQueue.length === 0) {
        setSuddenDeathQueue([])
        endOrContinue()
      } else {
        setSuddenDeathQueue(newQueue)
        setNextTeamIdx(newQueue[0])
        setRoundCount(r => r + 1)
        setPhase(PHASE.HANDOFF)
      }
      return
    }

    if (isFinalRound) {
      const remaining = finalRoundTeams - 1
      if (remaining <= 0) {
        setFinalRoundTeams(0)
        endOrContinue()
      } else {
        setFinalRoundTeams(remaining)
        setRoundCount(r => r + 1)
        setPhase(PHASE.HANDOFF)
      }
      return
    }

    // Normal play: check if someone just hit the target
    const topScore = Math.max(...teams.map(t => t.score))
    if (topScore >= TARGET) {
      const teamsAfter = teams.length - 1 - teamIdx // teams that haven't played this cycle yet
      if (teamsAfter > 0) {
        setFinalRoundTeams(teamsAfter)
        setRoundCount(r => r + 1)
        setPhase(PHASE.HANDOFF)
      } else {
        endOrContinue()
      }
      return
    }

    setRoundCount(r => r + 1)
    if (teams.length === 1) {
      handleBeginTurn()
    } else {
      setPhase(PHASE.HANDOFF)
    }
  }

  function handleQuit() {
    if (!settings.demo) {
      sessionEnd({
        completed: false,
        rounds_played: trackIdx,
        final_scores: teams.map(t => ({ name: t.name, score: t.score })),
      })
    }
    onQuit()
  }

  async function handleChallenge() {
    if (challengeCount >= 2 || challengeLoading || !currentTrack) return
    setChallengeLoading(true)
    setChallengeResult(null)
    try {
      const r = await fetch('/api/challenge-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: currentTrack.id,
          artist: currentTrack.artist,
          title: currentTrack.title,
          currentYear: currentTrack.year,
        }),
      })
      const data = await r.json()
      if (!data.changed) setChallengeCount(c => c + 1)
      setChallengeResult(data)

      if (data.changed) {
        // Update track year in state
        setTracks(prev => prev.map((t, i) => i === trackIdx ? { ...t, year: data.year } : t))

        // Recalculate yearCorrect with new year
        const timeline = currentTeam.timeline
        const prevYear = placedSlot > 0 ? timeline[placedSlot - 1].year : -Infinity
        const nextYear = placedSlot < timeline.length ? timeline[placedSlot].year : Infinity
        const newYearCorrect = data.year >= prevYear && data.year <= nextYear
        setYearCorrect(newYearCorrect)

        if (isSolo) {
          // Undo the scoring effect from handleReveal and re-apply with updated year
          if (!yearCorrect && newYearCorrect) {
            // Was wrong → now correct: restore the life, add card to timeline, +1 score
            setLives(l => l + 1)
            const newCard = { title: currentTrack.title, artist: currentTrack.artist, year: data.year, albumArt: currentTrack.albumArt }
            setTeams(prev => prev.map((t, i) => {
              if (i !== teamIdx) return t
              const tl = [...t.timeline.slice(0, placedSlot), newCard, ...t.timeline.slice(placedSlot)]
              return { ...t, timeline: tl, score: t.score + 1 }
            }))
          } else if (yearCorrect && !newYearCorrect) {
            // Was correct → now wrong: remove card from timeline, -1 score, lose a life
            setTeams(prev => prev.map((t, i) => {
              if (i !== teamIdx) return t
              const tl = [...t.timeline.slice(0, placedSlot), ...t.timeline.slice(placedSlot + 1)]
              return { ...t, timeline: tl, score: t.score - 1 }
            }))
            setLives(l => l - 1)
          }
          // Stay in REVEALED — solo player just sees the updated result
        } else {
          // Team mode: give second placement attempt — go back to PLACED
          setIsCorrect(null)
          setPhase(PHASE.PLACED)
        }
      }
    } catch {
      setChallengeResult({ error: 'Challenge failed — try again.' })
    } finally {
      setChallengeLoading(false)
    }
  }

  function handleBeginTurn() {
    if (!settings.demo) pauseSong()
    setTrackIdx(t => t + 1)
    if (nextTeamIdx !== null) {
      setTeamIdx(nextTeamIdx)
      setNextTeamIdx(null)
    } else {
      setTeamIdx(t => (t + 1) % teams.length)
    }
    setPlacedSlot(null)
    setYearCorrect(null)
    setIsCorrect(null)
    setProgress(0)
    setPlaying(false)
    setChallengeResult(null)
    setEncouragementMsg(null)
    setPhase(PHASE.READY)
  }

  // ─── Error ───────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '2rem', textAlign: 'center', background: 'var(--bg)' }}>
        <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.72rem' }}>ERROR</span>
        <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '1rem', color: 'var(--ink2)', lineHeight: 1.5, maxWidth: 320 }}>{error}</p>
        <button onClick={onQuit} style={{ border: '1px solid var(--ink)', background: 'transparent', padding: '0.75rem 2rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
          ← BACK
        </button>
      </div>
    )
  }

  // ─── Loading ─────────────────────────────────────────────────
  if (phase === PHASE.LOADING) {
    const steps = [
      'Connecting to Spotify…',
      'Crate-digging for tracks…',
      'Filtering by decade…',
      'Shuffling the setlist…',
      'Dropping the needle…',
    ]
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <Vinyl size={120} spinning color={TEAM_COLORS[0]} />
        <div style={{ marginTop: '2rem', width: '100%', maxWidth: 300 }}>
          <div className="mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '0.18em' }}>
            PREPARING YOUR SET
          </div>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              marginBottom: '0.4rem',
              opacity: loadStep > i ? 1 : 0.2,
              transition: 'opacity 0.4s ease',
            }}>
              <span style={{ color: loadStep > i ? 'var(--green)' : 'var(--border)', fontSize: '0.75rem', flexShrink: 0 }}>
                {loadStep > i ? '✓' : '·'}
              </span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--ink2)' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Handoff ─────────────────────────────────────────────────
  if (phase === PHASE.HANDOFF) {
    const isFinalRound = finalRoundTeams > 0
    const isSuddenDeath = suddenDeathQueue.length > 0
    const nextTeam = teams[nextTeamIdx ?? (teamIdx + 1) % teams.length]
    const prevTeam = teams[teamIdx]
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span className="mono" style={{ fontSize: '0.6rem' }}>SIDE A · ROUND {roundCount + 1}</span>
          <span className="mono" style={{ fontSize: '0.6rem' }}>{isSuddenDeath ? 'SUDDEN DEATH' : isFinalRound ? 'FINAL ROUND' : 'HANDOFF'}</span>
        </div>

        {/* Sudden death / final round banner */}
        {isSuddenDeath && (
          <div style={{ padding: '0.75rem 1.25rem', background: 'var(--accent)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--bg)', letterSpacing: '0.15em' }}>⚡ SUDDEN DEATH</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--bg)', opacity: 0.9 }}>
              It's a tie! Each team plays one more song — first to pull ahead wins. Still tied? Repeat.
            </span>
          </div>
        )}
        {isFinalRound && !isSuddenDeath && (
          <div style={{ padding: '0.5rem 1.25rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.15em' }}>FINAL ROUND — One more chance</span>
          </div>
        )}

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', gap: '0.5rem', textAlign: 'center' }}>
          <Vinyl size={110} spinning={false} color={nextTeam.color} />
          <div style={{ marginTop: '1.5rem' }}>
            <div className="mono" style={{ fontSize: '0.58rem', letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: '0.4rem' }}>PASS THE PHONE TO</div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900,
              fontSize: 'clamp(3rem, 14vw, 4.5rem)', lineHeight: 0.9,
              letterSpacing: '-0.03em', color: nextTeam.color,
            }}>{nextTeam.name}</div>
          </div>

          {/* Last result */}
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span style={{ fontSize: '0.9rem' }}>{isCorrect ? '✓' : '✕'}</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--ink2)' }}>
              {prevTeam.name} — {isCorrect ? '+1 card' : 'no card this round'}
            </span>
          </div>

          {/* Scores */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            {teams.map((t, i) => (
              <div key={i} style={{
                padding: '0.5rem 0.9rem',
                background: i === teamIdx ? 'var(--ink)' : 'var(--surface)',
                border: '1px solid var(--border)',
                color: i === teamIdx ? 'var(--bg)' : 'var(--ink)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: i === teamIdx ? 'var(--bg)' : t.color, flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: '0.62rem' }}>{t.name}</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: '0.95rem' }}>{t.score}<span style={{ opacity: 0.4, fontSize: '0.65rem' }}>{`/${TARGET}`}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div>
          <div style={{ borderTop: '3px solid var(--ink)' }} />
          <button onClick={handleBeginTurn} className="btn-primary">
            <div>
              <div className="mono" style={{ fontSize: '0.6rem', color: 'rgba(196,200,180,0.7)', marginBottom: 2 }}>READY TO PLAY?</div>
              <span>Begin our turn</span>
            </div>
            <span>→</span>
          </button>
        </div>
      </div>
    )
  }

  // ─── Done ────────────────────────────────────────────────────
  if (phase === PHASE.DONE) {
    const topScore = Math.max(...teams.map(t => t.score))
    const topTeams = teams.filter(t => t.score === topScore)
    const winner = topTeams.length === 1 ? topTeams[0] : null
    const winnerCards = winner ? winner.timeline.filter(c => !c.isAnchor) : []

    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span className="mono" style={{ fontSize: '0.62rem' }}>SIDE A · ISSUE NO. 047</span>
          <span className="mono" style={{ fontSize: '0.62rem' }}>— END OF SIDE A —</span>
          <span className="mono" style={{ fontSize: '0.62rem' }}>GAME OVER</span>
        </div>

        <div style={{ flex: 1, padding: '1.25rem 1.5rem 0' }}>
          <div className="mono" style={{ color: 'var(--accent)', fontSize: '0.62rem', marginBottom: '0.4rem' }}>AND THE NEEDLE LIFTS ON</div>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: '1rem' }} />

          {/* Winner + stamp */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900,
                fontSize: 'clamp(3rem, 14vw, 4.5rem)', lineHeight: 0.86,
                letterSpacing: '-0.04em', color: winner ? winner.color : 'var(--ink)',
              }}>{winner ? winner.name : 'Draw'}</div>
              {winner && <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '1rem', color: 'var(--ink2)', marginTop: '0.3rem' }}>{teams.length === 1 ? `finished with ${winner.score} cards!` : `has won ${TARGET} cards!`}</div>}
            </div>
            {winner && (
              <div style={{
                width: 90, height: 90, flexShrink: 0,
                border: `2px solid ${winner.color}`, borderRadius: '50%',
                transform: 'rotate(-8deg)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 0, color: winner.color,
                boxShadow: `inset 0 0 0 4px var(--bg)`,
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.45rem', letterSpacing: '0.1em' }}>WINNER</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.6rem', lineHeight: 1 }}>{winner.score}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.45rem', letterSpacing: '0.1em' }}>CARDS · MMXXVI</div>
              </div>
            )}
          </div>

          {/* Standings */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
            {[...teams].sort((a, b) => b.score - a.score).map((t, i) => (
              <div key={t.name} style={{
                flex: 1, padding: '0.6rem 0.75rem',
                background: i === 0 && winner ? 'var(--ink)' : 'var(--surface)',
                border: '1px solid var(--border)',
                color: i === 0 && winner ? 'var(--bg)' : 'var(--ink)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span className="mono" style={{ fontSize: '0.55rem', opacity: 0.5 }}>0{i + 1}</span>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 && winner ? 'var(--bg)' : t.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>{t.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.9rem' }}>{t.score}<span style={{ opacity: 0.4, fontSize: '0.65rem' }}>{`/${TARGET}`}</span></span>
              </div>
            ))}
          </div>

          {/* Winning timeline */}
          {winner && winnerCards.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', marginBottom: '0.6rem' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span className="serif" style={{ fontSize: '0.9rem' }}>Winning timeline</span>
                <span className="mono" style={{ fontSize: '0.58rem', color: 'var(--muted)' }}>{winnerCards.length} CARDS</span>
              </div>
              <div style={{ overflowX: 'auto', paddingBottom: '0.75rem', margin: '0 -1.5rem', padding: '0 1.5rem 0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', width: 'max-content' }}>
                  {winnerCards.map((card, i) => (
                    <MiniCard key={i} card={card} color={winner.color} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', borderTop: '3px solid var(--ink)' }}>
          <button onClick={onQuit} style={{
            flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', cursor: 'pointer',
          }}>
            <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>FLIP THE RECORD</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.1rem' }}>New game</span>
          </button>
          <button onClick={onQuit} style={{
            flex: 1, padding: '1rem', background: 'var(--ink)', border: 'none', color: 'var(--bg)',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', cursor: 'pointer',
          }}>
            <span className="mono" style={{ fontSize: '0.55rem', color: 'rgba(196,200,180,0.6)' }}>SAME TEAMS</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.1rem' }}>Play again →</span>
          </button>
        </div>
      </div>
    )
  }

  // ─── Game over (solo) ─────────────────────────────────────────
  if (phase === PHASE.GAMEOVER) {
    const score = teams[0].score
    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span className="mono" style={{ fontSize: '0.62rem' }}>SIDE A · SOLO</span>
          <span className="mono" style={{ fontSize: '0.62rem' }}>— GAME OVER —</span>
        </div>

        <div style={{ flex: 1, padding: '1.25rem 1.5rem 0' }}>
          <div className="mono" style={{ color: 'var(--accent)', fontSize: '0.62rem', marginBottom: '0.4rem' }}>THE NEEDLE LIFTS ON</div>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: '1rem' }} />

          {/* Score */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: 'clamp(4rem, 20vw, 6rem)', lineHeight: 1, color: 'var(--accent)', letterSpacing: '-0.04em' }}>{score}</span>
            <div>
              <div className="mono" style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}>CARDS</div>
              <div className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>PLACED CORRECTLY</div>
            </div>
          </div>

          {/* Hearts — all lost */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.5rem' }}>
            {[0,1,2].map(i => <span key={i} style={{ fontSize: '1.1rem', color: 'var(--border)' }}>♥</span>)}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginBottom: '1.25rem' }} />

          {/* Name entry */}
          {!scoreSubmitted ? (
            <>
              <div className="mono" style={{ fontSize: '0.6rem', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>
                {score > 0 ? 'ENTER YOUR NAME FOR THE LEADERBOARD' : 'BETTER LUCK NEXT TIME'}
              </div>
              {score > 0 && (
                <>
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && playerName.trim() && handleSubmitScore()}
                    maxLength={20}
                    placeholder="Your name…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      fontSize: '1.1rem', padding: '0.75rem 1rem',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      marginBottom: '0.5rem', color: 'var(--ink)',
                      fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
                    }}
                  />
                  <button
                    onClick={handleSubmitScore}
                    disabled={!playerName.trim()}
                    style={{
                      width: '100%', padding: '0.85rem',
                      background: playerName.trim() ? 'var(--ink)' : 'var(--surface)',
                      color: playerName.trim() ? 'var(--bg)' : 'var(--muted)',
                      border: '1px solid var(--border)', cursor: playerName.trim() ? 'pointer' : 'default',
                      fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1rem',
                    }}
                  >Submit score →</button>
                </>
              )}
            </>
          ) : (
            <button
              onClick={() => onScores({ difficulty: settings.difficulty })}
              style={{
                width: '100%', padding: '0.85rem',
                background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
                fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1rem',
              }}
            >◆ View leaderboard →</button>
          )}
        </div>

        <div style={{ borderTop: '3px solid var(--ink)', display: 'flex' }}>
          <button onClick={onQuit} style={{
            flex: 1, padding: '1rem', background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', cursor: 'pointer',
          }}>
            <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>TRY AGAIN</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '1.1rem' }}>Play again →</span>
          </button>
        </div>
      </div>
    )
  }

  // ─── Main game ────────────────────────────────────────────────
  const spinning = playing && (phase === PHASE.LISTENING || phase === PHASE.PLACED)
  const revealed = phase === PHASE.REVEALED || phase === PHASE.JUDGED
  const team = currentTeam

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)', userSelect: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{
        maxWidth: 480, margin: '0 auto', padding: '0.75rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={handleQuit} style={{ background: 'none', border: '1px solid var(--border)', padding: '0.35rem 0.6rem', cursor: 'pointer' }}>
          <span className="mono" style={{ fontSize: '0.62rem' }}>✕</span>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '0.6rem' }}>
            ROUND {trackIdx + 1} · TURN{settings.demo ? ' · DEMO' : ''}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1rem', color: team.color }}>
            {team.name}'s turn
          </div>
        </div>
        <button onClick={handleQuit} style={{ background: 'none', border: '1px solid var(--border)', padding: '0.35rem 0.6rem', cursor: 'pointer' }}>
          <span className="mono" style={{ fontSize: '0.8rem' }}>⋯</span>
        </button>
      </div>
      </header>

      {/* Scores */}
      {isSolo ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.1rem' }}>{teams[0].score}</span>
            <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>CARDS</span>
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ fontSize: '1.1rem', color: i < lives ? 'var(--accent)' : 'var(--border)', transition: 'color 0.3s' }}>♥</span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {teams.map((t, i) => (
            <div
              key={i}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: i === teamIdx ? t.color + '12' : 'transparent',
                borderRight: i < teams.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: i === teamIdx ? 1 : 0.5,
                transition: 'opacity 0.2s',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', flex: 1 }}>{t.name}</span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '0.95rem' }}>
                {t.score}<span style={{ opacity: 0.35, fontSize: '0.7rem' }}>{`/${TARGET}`}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stage: turntable + mystery card */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.25rem 1rem 0.5rem', position: 'relative', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <Vinyl size={140} spinning={spinning} color={team.color} year={revealed ? currentTrack?.year : null} />

        {/* Mystery card — shown during READY, LISTENING and PLACED (unless dragging) */}
        {(phase === PHASE.READY || ((phase === PHASE.LISTENING || phase === PHASE.PLACED) && !drag)) && (
          <MysteryCardEl
            onPointerDown={onPointerDown}
            draggable={phase === PHASE.LISTENING || phase === PHASE.PLACED}
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

      {/* Playback bar — always rendered to avoid timeline jumping */}
      <div style={{ padding: '0 1.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', visibility: (phase !== PHASE.READY && phase !== PHASE.REVEALED && phase !== PHASE.JUDGED) ? 'visible' : 'hidden', maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <button
            onClick={() => {
              if (playing) {
                if (!settings.demo) pauseSong()
                setPlaying(false)
              } else {
                if (!settings.demo) resumeSong()
                setPlaying(true)
              }
            }}
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

      {/* Hint text */}
      <div style={{ padding: '0 1.25rem 0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', minHeight: 32, maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <span style={{ color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', marginTop: 1 }}>
          {phase === PHASE.LISTENING ? '↓' : '·'}
        </span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--ink2)', lineHeight: 1.4 }}>
          {phase === PHASE.READY && 'Press Play — then drag the card onto the timeline.'}
          {phase === PHASE.LISTENING && 'Listen — then drag the card onto the timeline.'}
          {phase === PHASE.PLACED && 'Card placed. Discuss the title and artist — then reveal the answer.'}
          {phase === PHASE.REVEALED && !isSolo && (yearCorrect
            ? <><em>Year correct.</em> Did they also guess the artist &amp; title?</>
            : <><em>Wrong year.</em> Did they guess the artist &amp; title anyway?</>
          )}
          {phase === PHASE.REVEALED && isSolo && (yearCorrect
            ? <><em>Correct!</em> {teams[0].score} cards placed.{encouragementMsg && <><br /><span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontStyle: 'normal', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>{encouragementMsg.toUpperCase()}</span></>}</>
            : <><em>Wrong year.</em> {lives > 0 ? `${lives} heart${lives === 1 ? '' : 's'} remaining.` : 'No hearts left.'}</>
          )}
          {phase === PHASE.JUDGED && isCorrect && <><em>+1 card.</em> Correct placement and correct guess!</>}
          {phase === PHASE.JUDGED && !isCorrect && <><em>No card.</em> Better luck next round.</>}
        </span>
      </div>

      {/* Timeline */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '0.5rem 1.25rem 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ border: '1px solid var(--accent2)', padding: '1px 4px' }}>
            <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--accent2)' }}>A1</span>
          </div>
          <span className="serif" style={{ fontSize: '0.85rem' }}>Timeline</span>
          <span className="mono" style={{ fontSize: '0.6rem', marginLeft: 'auto', color: 'var(--muted)' }}>
            {team.timeline.filter(c => !c.isAnchor).length} CARDS · {team.name.toUpperCase()}
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
                const isPlaced = phase !== PHASE.LISTENING && placedSlot === j && !(phase === PHASE.JUDGED && isCorrect) && !(isSolo && phase === PHASE.REVEALED && yearCorrect)
                return (
                  <div
                    key={`s${j}`}
                    ref={el => (slotsRef.current[j] = el)}
                    style={{
                      width: isPlaced ? 110 : 36,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isHover ? 'rgba(196,83,58,0.1)' : 'transparent',
                      border: isHover ? '1px solid var(--accent)' : '1px dashed var(--border)',
                      borderRadius: 2,
                      margin: '0 2px',
                      transition: 'all 0.15s',
                      minHeight: 120,
                    }}
                  >
                    {isPlaced ? (
                      phase === PHASE.REVEALED
                        ? <RevealedTLCard song={currentTrack} yearCorrect={yearCorrect} correct={null} teamColor={team.color} />
                        : phase === PHASE.JUDGED && !isCorrect
                          ? <RevealedTLCard song={currentTrack} yearCorrect={yearCorrect} correct={false} teamColor={team.color} />
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
          <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>← EARLIER</span>
          <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>LATER →</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 'auto', borderTop: '3px solid var(--ink)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {phase === PHASE.READY && (
          currentTrack ? (
            <button onClick={handlePlay} className="btn-reveal">
              <div><div className="mono" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>READY?</div>
              <span>Play the song</span></div>
              <span>→</span>
            </button>
          ) : (
            <div style={{ padding: '0.9rem 1.25rem', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>PLEASE WAIT</span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--ink2)' }}>Loading more songs…</span>
            </div>
          )
        )}
        {phase === PHASE.LISTENING && (
          <div style={{ padding: '0.85rem 1.25rem', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>WAITING</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--ink2)' }}>Drag the card to a slot</span>
          </div>
        )}
        {phase === PHASE.PLACED && (
          <button onClick={handleReveal} className="btn-reveal">
            <div><div className="mono" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>READY?</div>
            <span>Reveal the song</span></div>
            <span>→</span>
          </button>
        )}
        {phase === PHASE.REVEALED && isSolo && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ChallengeBar
              count={challengeCount} loading={challengeLoading} result={challengeResult}
              onChallenge={handleChallenge}
            />
            <button onClick={handleSoloNext} className="btn-primary">
              <div>
                <div className="mono" style={{ fontSize: '0.6rem', color: yearCorrect ? 'var(--accent2)' : 'rgba(196,83,58,0.8)', marginBottom: 2 }}>
                  {yearCorrect ? '✓ CORRECT' : `✕ WRONG · ${lives} HEART${lives === 1 ? '' : 'S'} LEFT`}
                </div>
                <span>{lives === 0 ? 'See your score' : 'Next track'}</span>
              </div>
              <span>→</span>
            </button>
          </div>
        )}
        {phase === PHASE.REVEALED && !isSolo && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ChallengeBar
              count={challengeCount} loading={challengeLoading} result={challengeResult}
              onChallenge={handleChallenge}
            />
            <div style={{ display: 'flex' }}>
              <button
                onClick={() => handleJudge(false)}
                style={{
                  flex: 1, padding: '1rem 0.75rem',
                  background: 'var(--surface)', border: 'none', borderRight: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>✕</span>
                <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent)' }}>WRONG</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--ink2)' }}>
                  {yearCorrect ? 'Missed artist / title' : 'Wrong year & guess'}
                </span>
              </button>
              <button
                onClick={() => handleJudge(true)}
                style={{
                  flex: 1, padding: '1rem 0.75rem',
                  background: 'var(--ink)', border: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem', color: 'var(--bg)' }}>✓</span>
                <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent2)' }}>CORRECT</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--bg)', opacity: 0.7 }}>
                  Got artist & title
                </span>
              </button>
            </div>
          </div>
        )}
        {phase === PHASE.JUDGED && !isSolo && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {!isCorrect && (
              <ChallengeBar
                count={challengeCount} loading={challengeLoading} result={challengeResult}
                onChallenge={handleChallenge}
              />
            )}
            <button onClick={handleNext} className="btn-primary">
              <div>
                <div className="mono" style={{ fontSize: '0.6rem', color: 'rgba(196,200,180,0.7)', marginBottom: 2 }}>
                  {isCorrect ? '+1 CARD' : 'NO CARD'}
                </div>
                <span>Next — {teams[(teamIdx + 1) % teams.length].name}'s turn</span>
              </div>
              <span>→</span>
            </button>
          </div>
        )}
        </div>
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
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      {/* Disc — only this part spins */}
      <div style={{
        width: size, height: size,
        borderRadius: '50%',
        background: '#1c1810',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'absolute',
        boxShadow: '0 6px 28px rgba(0,0,0,0.25)',
        animation: spinning ? 'spin 2.4s linear infinite' : 'none',
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
        {/* Label */}
        <div style={{
          width: size * 0.38, height: size * 0.38,
          borderRadius: '50%',
          background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Off-center streak so spinning is visible */}
          <div style={{
            position: 'absolute',
            width: size * 0.04, height: size * 0.13,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: size * 0.02,
            top: size * 0.04,
            left: '50%',
            transform: 'translateX(-50%)',
          }} />
          {year ? (
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic', fontWeight: 900,
              fontSize: size * 0.12,
              color: '#fff',
              letterSpacing: '-0.02em',
              position: 'relative', zIndex: 1,
            }}>{year}</span>
          ) : (
            <span style={{ fontSize: size * 0.14, color: 'rgba(255,255,255,0.8)', position: 'relative', zIndex: 1 }}>♪</span>
          )}
          <div style={{
            position: 'absolute',
            width: size * 0.06, height: size * 0.06,
            borderRadius: '50%',
            background: 'var(--bg)',
          }} />
        </div>
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
        <div className="mono" style={{ fontSize: '0.48rem', color: 'var(--muted)' }}>PLAYING…</div>
        {draggable && <div className="mono" style={{ fontSize: '0.48rem', color: 'var(--accent)', marginTop: 2 }}>↕ DRAG</div>}
      </div>
    </div>
  )
}

// ─── Timeline card ────────────────────────────────────────────
function TLCard({ card, teamColor }) {
  if (card.isAnchor) {
    return (
      <div style={{
        width: 110, height: 120, flexShrink: 0,
        background: 'var(--card)',
        border: `1px solid ${teamColor}`,
        borderRadius: 3,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4, margin: '0 2px',
      }}>
        <span className="mono" style={{ fontSize: '0.5rem', color: teamColor }}>START YEAR</span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.8rem', color: teamColor, lineHeight: 1 }}>{card.year}</span>
      </div>
    )
  }
  return (
    <div style={{
      width: 110, height: 120, flexShrink: 0,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 3,
      display: 'flex', flexDirection: 'column',
      padding: '6px 6px 5px',
      position: 'relative',
      margin: '0 2px',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: teamColor, position: 'absolute', top: 5, right: 5 }} />
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.8rem', color: 'var(--accent)', lineHeight: 1, marginBottom: 'auto' }}>{card.year}</span>
      <div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.artist}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
      </div>
    </div>
  )
}

function MiniMysteryCard() {
  return (
    <div style={{
      width: 110, height: 120,
      background: 'var(--surface)',
      border: '1px dashed var(--accent)',
      borderRadius: 3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '2rem', color: 'var(--muted)' }}>?</span>
    </div>
  )
}

function RevealedTLCard({ song, yearCorrect, correct, teamColor }) {
  const judged = correct !== null
  const borderColor = judged ? (correct ? 'var(--green)' : 'var(--accent)') : (yearCorrect ? 'var(--green)' : 'var(--accent)')
  const yearColor = yearCorrect ? 'var(--green)' : 'var(--accent)'
  return (
    <div style={{
      width: 110, minHeight: 120,
      background: yearCorrect ? 'rgba(58,93,74,0.08)' : 'rgba(196,83,58,0.08)',
      border: `1px solid ${borderColor}`,
      borderRadius: 3,
      display: 'flex', flexDirection: 'column',
      padding: '7px',
      position: 'relative',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: teamColor, position: 'absolute', top: 5, right: 5 }} />
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '1.8rem', color: yearColor, lineHeight: 1, marginBottom: '0.4rem' }}>{song?.year}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.3 }}>{song?.artist}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'var(--muted)', lineHeight: 1.3, marginTop: 2 }}>{song?.title}</div>
        {judged && (
          <div className="mono" style={{ fontSize: '0.52rem', marginTop: 4, color: correct ? 'var(--green)' : 'var(--accent)' }}>
            {correct ? 'KEEPER' : 'NO CARD'}
          </div>
        )}
      </div>
    </div>
  )
}

function SongRevealCard({ song, yearCorrect, judged, correct }) {
  const accentColor = judged
    ? (correct ? 'var(--green)' : 'var(--accent)')
    : (yearCorrect ? 'var(--green)' : 'var(--accent)')
  return (
    <div style={{
      margin: '0.75rem 1.25rem',
      padding: '1.1rem 1.25rem',
      background: yearCorrect ? 'rgba(58,93,74,0.06)' : 'rgba(196,83,58,0.06)',
      border: `1px solid ${accentColor}`,
      borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, fontSize: '2.6rem', lineHeight: 1, color: accentColor }}>
          {song?.year}
        </span>
        <span className="mono" style={{ fontSize: '0.55rem', color: accentColor }}>
          {yearCorrect ? '✓ YEAR' : '✕ WRONG YEAR'}
        </span>
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.25, marginBottom: '0.2rem', color: 'var(--ink)' }}>
        {song?.artist}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: 'var(--ink2)' }}>
        {song?.title}
      </div>
      {judged && (
        <div className="mono" style={{ fontSize: '0.58rem', marginTop: '0.6rem', color: accentColor }}>
          {correct ? '✓ +1 CARD EARNED' : '✕ NO CARD THIS ROUND'}
        </div>
      )}
    </div>
  )
}

function ChallengeBar({ count, loading, result, onChallenge }) {
  const remaining = 2 - count
  const disabled = remaining === 0 || loading

  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      {result && !loading && (
        <div style={{
          padding: '0.5rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        }}>
          <span style={{ color: result.error ? 'var(--accent)' : result.changed ? 'var(--green)' : 'var(--muted)', flexShrink: 0 }}>
            {result.error ? '✕' : result.changed ? '✓' : '·'}
          </span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--ink2)', lineHeight: 1.35 }}>
            {result.error
              ? result.error
              : result.changed
                ? `Year updated to ${result.year}. ${result.message}`
                : `Year ${result.year} confirmed correct. ${result.message}`}
          </span>
        </div>
      )}

      {/* Scan line — only visible while loading */}
      <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden', opacity: loading ? 1 : 0, transition: 'opacity 0.2s' }}>
        <div style={{
          height: '100%', width: '25%',
          background: 'var(--accent)',
          animation: loading ? 'scan 1.1s ease-in-out infinite' : 'none',
        }} />
      </div>

      <button
        onClick={onChallenge}
        disabled={disabled}
        style={{
          width: '100%', padding: '0.6rem 1.25rem',
          background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: disabled ? 'default' : 'pointer',
          opacity: remaining === 0 ? 0.4 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: loading ? 'var(--accent)' : 'var(--ink)' }}>?</span>
          <span style={{
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '0.82rem',
            color: loading ? 'var(--accent)' : 'var(--ink2)',
            animation: loading ? 'pulse 1.4s ease-in-out infinite' : 'none',
          }}>
            {loading ? 'Searching the web…' : 'Challenge the year'}
          </span>
        </div>
        <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>
          {loading ? '' : `${remaining} LEFT`}
        </span>
      </button>
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
