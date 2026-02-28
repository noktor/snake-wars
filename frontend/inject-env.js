/**
 * Netlify build: injects SNAKE_WARS_BACKEND_URL from env into all HTML files.
 * Run from frontend/ (e.g. node inject-env.js). Set the env var in Netlify UI.
 */
const fs = require('fs')
const path = require('path')

const envUrl = (process.env.SNAKE_WARS_BACKEND_URL || '').trim()
const safe = envUrl.replace(/'/g, "\\'").replace(/\\/g, '\\\\')

// Match: window.SNAKE_WARS_BACKEND_URL = ... (any fallback)
const regex = /window\.SNAKE_WARS_BACKEND_URL\s*=\s*(?:window\.SNAKE_WARS_BACKEND_URL\s*\|\|\s*)?'[^']*'/

const htmlFiles = [
  'index.html',
  'snake/index.html',
  'empire/index.html',
  'br/index.html',
  'heaveho/index.html',
  'rts/index.html'
]

for (const rel of htmlFiles) {
  const htmlPath = path.join(__dirname, rel)
  if (!fs.existsSync(htmlPath)) continue
  let html = fs.readFileSync(htmlPath, 'utf8')
  if (envUrl) {
    html = html.replace(regex, `window.SNAKE_WARS_BACKEND_URL = '${safe}'`)
  }
  fs.writeFileSync(htmlPath, html)
  console.log(rel + ':', envUrl ? 'injected ' + envUrl : 'unchanged (no env)')
}
