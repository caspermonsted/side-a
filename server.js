import express from 'express'
import { join } from 'path'

const app = express()
const PORT = process.env.PORT || 3000
const DIST = join(process.cwd(), 'dist')

app.use(express.json())
app.use(express.static(DIST))

app.post('/api/log', (req, res) => {
  const { event, ...data } = req.body ?? {}
  if (!event) return res.sendStatus(400)
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }))
  res.sendStatus(204)
})

// SPA fallback
app.use((_req, res) => {
  res.sendFile(join(DIST, 'index.html'))
})

app.listen(PORT, () => console.log(`Side A running on port ${PORT} — serving ${DIST}`))
