import { useState } from 'react'
import ModeSelect from './pages/ModeSelect'
import Setup from './pages/Setup'
import SoloSetup from './pages/SoloSetup'
import HomeTurfSetup from './pages/HomeTurfSetup'
import Game from './pages/Game'
import Leaderboard from './pages/Leaderboard'

export default function App() {
  const [page, setPage] = useState('mode')
  const [gameSettings, setGameSettings] = useState(null)
  const [leaderboardContext, setLeaderboardContext] = useState(null)
  const [lastHomeTurf, setLastHomeTurf] = useState(null)

  function handleStart(settings) {
    if (settings.homeTurf) setLastHomeTurf(settings)
    setGameSettings(settings)
    setPage('game')
  }

  function handleQuit() {
    setPage(gameSettings?.solo ? 'solosetup' : gameSettings?.homeTurf ? 'hometurfsetup' : 'partysetup')
    setGameSettings(null)
  }

  function handleScores(context) {
    setLeaderboardContext(context || null)
    setPage('leaderboard')
  }

  if (page === 'mode') return <ModeSelect onParty={() => setPage('partysetup')} onSolo={() => setPage('solosetup')} onHomeTurf={() => setPage('hometurfsetup')} onScores={() => handleScores(null)} />
  if (page === 'partysetup') return <Setup onStart={handleStart} onBack={() => setPage('mode')} />
  if (page === 'hometurfsetup') return <HomeTurfSetup initial={lastHomeTurf} onStart={handleStart} onBack={() => setPage('mode')} />
  if (page === 'solosetup') return <SoloSetup onStart={handleStart} onBack={() => setPage('mode')} onScores={() => handleScores(null)} />
  if (page === 'game') return <Game settings={gameSettings} onQuit={handleQuit} onScores={handleScores} />
  if (page === 'leaderboard') return <Leaderboard context={leaderboardContext} onBack={() => setPage('mode')} />
  return null
}
