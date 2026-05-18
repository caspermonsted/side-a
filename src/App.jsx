import { useState, useEffect } from 'react'
import { isLoggedIn } from './spotify/auth'
import Login from './pages/Login'
import Callback from './pages/Callback'
import Setup from './pages/Setup'
import Game from './pages/Game'

export default function App() {
  const [page, setPage] = useState(() => {
    if (window.location.pathname === '/callback') return 'callback'
    if (isLoggedIn()) return 'setup'
    return 'login'
  })
  const [gameSettings, setGameSettings] = useState(null)

  function handleLoggedIn() {
    setPage('setup')
  }

  function handleStart(settings) {
    setGameSettings(settings)
    setPage('game')
  }

  function handleQuit() {
    setPage('setup')
    setGameSettings(null)
  }

  function handleLogout() {
    import('./spotify/auth').then(({ logout }) => logout())
    setPage('login')
  }

  function handleDemo() {
    setPage('setup')
    setGameSettings({ demo: true })
  }

  if (page === 'callback') return <Callback onDone={handleLoggedIn} />
  if (page === 'login') return <Login onDemo={handleDemo} />
  if (page === 'setup') return <Setup onStart={handleStart} onLogout={handleLogout} />
  if (page === 'game') return <Game settings={gameSettings} onQuit={handleQuit} />
  return null
}
