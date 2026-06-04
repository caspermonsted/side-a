import { useState } from 'react'
import ModeSelect from './pages/ModeSelect'
import Setup from './pages/Setup'
import SoloSetup from './pages/SoloSetup'
import Game from './pages/Game'
import Leaderboard from './pages/Leaderboard'
import CountryModal from './pages/CountryModal'
import { getSavedCountry, saveCountry } from './country'

export default function App() {
  const [page, setPage] = useState('mode')
  const [gameSettings, setGameSettings] = useState(null)
  const [leaderboardContext, setLeaderboardContext] = useState(null)
  const [country, setCountry] = useState(getSavedCountry)   // null = not yet chosen

  function handleSelectCountry(code) {
    saveCountry(code)
    setCountry(code)
  }

  function handleStart(settings) {
    setGameSettings({ ...settings, country })
    setPage('game')
  }

  function handleQuit() {
    setPage(gameSettings?.solo ? 'solosetup' : 'partysetup')
    setGameSettings(null)
  }

  function handleScores(context) {
    setLeaderboardContext(context || null)
    setPage('leaderboard')
  }

  return (
    <>
      {country === null && <CountryModal onSelect={handleSelectCountry} />}

      {page === 'mode' && <ModeSelect onParty={() => setPage('partysetup')} onSolo={() => setPage('solosetup')} onScores={() => handleScores(null)} country={country} onChangeCountry={() => setCountry(null)} />}
      {page === 'partysetup' && <Setup onStart={handleStart} onBack={() => setPage('mode')} />}
      {page === 'solosetup' && <SoloSetup onStart={handleStart} onBack={() => setPage('mode')} onScores={() => handleScores(null)} />}
      {page === 'game' && <Game settings={gameSettings} onQuit={handleQuit} onScores={handleScores} />}
      {page === 'leaderboard' && <Leaderboard context={leaderboardContext} onBack={() => setPage('mode')} />}
    </>
  )
}
