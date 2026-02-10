/**
 * Netlify build: injects SNAKE_WARS_BACKEND_URL from env into index.html.
 * Run from frontend/ (e.g. node inject-env.js). Set the env var in Netlify UI.
 */
const fs = require('fs')
const path = require('path')

const envUrl = process.env.SNAKE_WARS_BACKEND_URL || ''
const htmlPath = path.join(__dirname, 'index.html')
let html = fs.readFileSync(htmlPath, 'utf8')

// Replace placeholder (escape for use in script tag)
const safe = envUrl.replace(/'/g, "\\'")
html = html.replace(
  /window\.SNAKE_WARS_BACKEND_URL\s*=\s*'__SNAKE_WARS_BACKEND_URL__'/,
  `window.SNAKE_WARS_BACKEND_URL = '${safe}'`
)

fs.writeFileSync(htmlPath, html)
console.log('Injected SNAKE_WARS_BACKEND_URL:', envUrl || '(empty, localhost will be used)')
