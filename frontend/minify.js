/**
 * Minifies frontend JS for production. Overwrites files in place so script src in HTML stay the same.
 * Run from frontend/ (e.g. node minify.js). Used in Netlify build after inject-env.js.
 * Only minifies when CI (e.g. NETLIFY=true) so local dev keeps full source.
 */
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const isCI = process.env.NETLIFY === 'true' || process.env.CI === 'true'
if (!isCI) {
  console.log('Minify skipped (not in CI). Use full source locally.')
  process.exit(0)
}

const FRONTEND_DIR = __dirname
const FILES = [
  'hub.js',
  'snake/snake.js',
  'br/br.js',
  'heaveho/heaveho.js'
]

async function minifyAll() {
  for (const file of FILES) {
    const abs = path.join(FRONTEND_DIR, file)
    if (!fs.existsSync(abs)) {
      console.warn('Skip (not found):', file)
      continue
    }
    const code = fs.readFileSync(abs, 'utf8')
    const result = await esbuild.transform(code, {
      loader: 'js',
      minify: true,
      target: 'es2018'
    })
    if (result.code) {
      fs.writeFileSync(abs, result.code)
      console.log('Minified:', file)
    }
  }
}

minifyAll().catch(err => {
  console.error('Minify failed:', err)
  process.exit(1)
})
