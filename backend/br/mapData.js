const { MAP_WIDTH, MAP_HEIGHT } = require('./constants')

const OBSTACLES = [
    { x: 400, y: 400, w: 120, h: 80 },
    { x: 900, y: 300, w: 100, h: 100 },
    { x: 1400, y: 800, w: 150, h: 60 },
    { x: 600, y: 1200, w: 80, h: 120 },
    { x: 1100, y: 1400, w: 200, h: 100 },
    { x: 300, y: 900, w: 90, h: 90 },
    { x: 1550, y: 400, w: 100, h: 150 },
    { x: 800, y: 700, w: 70, h: 70 },
    { x: 1300, y: 200, w: 120, h: 80 }
]

const POIS = [
    { id: 'factory', name: 'Factory', x: 500, y: 500, w: 200, h: 150 },
    { id: 'village', name: 'Village', x: 950, y: 600, w: 180, h: 120 },
    { id: 'military', name: 'Military', x: 1350, y: 850, w: 220, h: 180 },
    { id: 'farm', name: 'Farm', x: 550, y: 1100, w: 160, h: 140 },
    { id: 'port', name: 'Port', x: 100, y: 900, w: 150, h: 200 },
    { id: 'tower', name: 'Tower', x: 1700, y: 300, w: 100, h: 250 },
    { id: 'center', name: 'Center', x: 900, y: 900, w: 200, h: 200 }
]

const CENTER_X = MAP_WIDTH / 2
const CENTER_Y = MAP_HEIGHT / 2
const MIN_SPAWN_DISTANCE_FROM_CENTER = 0.4 * Math.min(MAP_WIDTH, MAP_HEIGHT) / 2
const SPAWN_MARGIN = 80

function isPointInObstacle(x, y) {
    for (const o of OBSTACLES) {
        if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return true
    }
    return false
}

function getRandomSpawnPoint(usedPositions = []) {
    const maxAttempts = 100
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * Math.PI * 2
        const dist = MIN_SPAWN_DISTANCE_FROM_CENTER + Math.random() * (Math.min(MAP_WIDTH, MAP_HEIGHT) / 2 - MIN_SPAWN_DISTANCE_FROM_CENTER - SPAWN_MARGIN)
        const x = CENTER_X + Math.cos(angle) * dist
        const y = CENTER_Y + Math.sin(angle) * dist
        const px = Math.max(SPAWN_MARGIN, Math.min(MAP_WIDTH - SPAWN_MARGIN, x))
        const py = Math.max(SPAWN_MARGIN, Math.min(MAP_HEIGHT - SPAWN_MARGIN, y))
        if (isPointInObstacle(px, py)) continue
        const tooClose = usedPositions.some(p => Math.hypot(p.x - px, p.y - py) < 60)
        if (tooClose) continue
        return { x: px, y: py }
    }
    return { x: SPAWN_MARGIN, y: SPAWN_MARGIN }
}

module.exports = {
    OBSTACLES,
    POIS,
    isPointInObstacle,
    getRandomSpawnPoint
}
