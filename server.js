import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const app = express()
const PORT = process.env.PORT || 3000
const __dirname = dirname(fileURLToPath(import.meta.url))

app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

app.post('/api/log', (req, res) => {
  const { event, ...data } = req.body ?? {}
  if (!event) return res.sendStatus(400)
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }))
  res.sendStatus(204)
})

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => console.log(`Side A running on port ${PORT}`))
