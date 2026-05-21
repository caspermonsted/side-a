import express from 'express'
import { join } from 'path'

const app = express()
const DIST = join(process.cwd(), 'dist')

app.use(express.static(DIST))

app.get('/api/preview', async (req, res) => {
  const { title, artist } = req.query
  if (!title || !artist) return res.json({ url: null })
  try {
    const q = encodeURIComponent(`${artist} ${title}`)
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`)
    const data = await r.json()
    const url = data.data?.find(d => d.preview)?.preview ?? null
    res.json({ url })
  } catch {
    res.json({ url: null })
  }
})

app.use((_req, res) => res.sendFile(join(DIST, 'index.html')))

app.listen(3000, () => console.log('Side A on :3000'))
