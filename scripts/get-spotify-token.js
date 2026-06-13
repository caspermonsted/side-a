/**
 * Gets a Spotify user access token via PKCE — no server needed.
 *
 * Step 1: run this script — it prints a login URL
 * Step 2: open the URL, log in, Spotify redirects to localhost (shows error — that's fine)
 * Step 3: copy the full URL from the browser address bar and paste it back here
 *
 * Usage: node scripts/get-spotify-token.js
 */

import crypto from 'node:crypto'
import readline from 'node:readline'

const CLIENT_ID = 'c12f2deae23b40238f1c3602611e37cf'
const REDIRECT_URI = 'https://localhost:8888/callback'

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const verifier  = base64url(crypto.randomBytes(32))
const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())

const authUrl = new URL('https://accounts.spotify.com/authorize')
authUrl.searchParams.set('client_id', CLIENT_ID)
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
authUrl.searchParams.set('code_challenge_method', 'S256')
authUrl.searchParams.set('code_challenge', challenge)
authUrl.searchParams.set('scope', '')

console.log('\n=== Step 1: Open this URL in your browser ===\n')
console.log(authUrl.toString())
console.log('\n=== Step 2: Log in with Spotify ===')
console.log('After login you will see a browser error (connection refused) — that is fine.')
console.log('Copy the full URL from the address bar.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('=== Step 3: Paste the full redirect URL here: ', async (redirected) => {
  rl.close()
  try {
    const url = new URL(redirected.trim())
    const code = url.searchParams.get('code')
    if (!code) { console.error('No code found in URL'); process.exit(1) }

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      }),
    })

    const data = await tokenRes.json()
    if (data.access_token) {
      console.log('\n✓ Your token:\n')
      console.log(data.access_token)
      console.log(`\nExpires in ${Math.round(data.expires_in / 60)} minutes.`)
    } else {
      console.error('Failed:', JSON.stringify(data))
    }
  } catch (e) {
    console.error('Error:', e.message)
  }
})
