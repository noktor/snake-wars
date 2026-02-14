const { MAP_WIDTH, MAP_HEIGHT } = require('./constants')

const SCALE = MAP_WIDTH / 2000

const TREE_RADIUS = 22

const AREAS = [
    { id: 'forest_big', name: 'Big Forest', type: 'forest_big', x: 0, y: 0, w: 4500, h: 4500 },
    { id: 'factory', name: 'Factory', type: 'factory', x: 4500, y: 0, w: 3000, h: 2500 },
    { id: 'village', name: 'Village', type: 'village', x: 7500, y: 0, w: 3500, h: 3000 },
    { id: 'city', name: 'City', type: 'city', x: 11000, y: 0, w: 5500, h: 4500 },
    { id: 'mountain', name: 'Mountain', type: 'mountain', x: 6500, y: 5000, w: 5500, h: 4500 },
    { id: 'forest_small', name: 'Small Forest', type: 'forest_small', x: 0, y: 4500, w: 3500, h: 3500 },
    { id: 'swamp', name: 'Swamp', type: 'swamp', x: 0, y: 8000, w: 4500, h: 4000 },
    { id: 'fields', name: 'Fields', type: 'fields', x: 4500, y: 8000, w: 5000, h: 4000 },
    { id: 'port', name: 'Port', type: 'port', x: 16500, y: 0, w: 3500, h: 6000 },
    { id: 'military', name: 'Military Base', type: 'military', x: 9500, y: 12000, w: 5000, h: 5000 }
]

function buildBuilding(x, y, w, h, type) {
    return { x, y, w, h, type }
}

const BUILDINGS = [
    ...(() => {
        const out = []
        const a = AREAS.find(r => r.id === 'factory')
        if (!a) return out
        out.push(buildBuilding(a.x + 200, a.y + 200, 800, 500, 'factory_hall'))
        out.push(buildBuilding(a.x + 1100, a.y + 300, 400, 350, 'warehouse'))
        out.push(buildBuilding(a.x + 1600, a.y + 700, 600, 400, 'shed'))
        out.push(buildBuilding(a.x + 400, a.y + 800, 350, 300, 'warehouse'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS.find(r => r.id === 'village')
        if (!a) return out
        out.push(buildBuilding(a.x + 300, a.y + 400, 180, 150, 'house'))
        out.push(buildBuilding(a.x + 550, a.y + 350, 160, 140, 'house'))
        out.push(buildBuilding(a.x + 800, a.y + 500, 200, 160, 'house'))
        out.push(buildBuilding(a.x + 1100, a.y + 400, 220, 180, 'shop'))
        out.push(buildBuilding(a.x + 1400, a.y + 600, 170, 150, 'house'))
        out.push(buildBuilding(a.x + 1700, a.y + 300, 190, 170, 'house'))
        out.push(buildBuilding(a.x + 2100, a.y + 500, 250, 200, 'church'))
        out.push(buildBuilding(a.x + 500, a.y + 900, 200, 150, 'barn'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS.find(r => r.id === 'city')
        if (!a) return out
        out.push(buildBuilding(a.x + 200, a.y + 200, 400, 350, 'apartment'))
        out.push(buildBuilding(a.x + 650, a.y + 150, 350, 300, 'office'))
        out.push(buildBuilding(a.x + 1050, a.y + 250, 380, 320, 'apartment'))
        out.push(buildBuilding(a.x + 1500, a.y + 100, 450, 380, 'skyscraper'))
        out.push(buildBuilding(a.x + 2000, a.y + 550, 320, 280, 'shop'))
        out.push(buildBuilding(a.x + 2400, a.y + 200, 400, 350, 'apartment'))
        out.push(buildBuilding(a.x + 2900, a.y + 400, 350, 300, 'office'))
        out.push(buildBuilding(a.x + 3300, a.y + 100, 420, 360, 'skyscraper'))
        out.push(buildBuilding(a.x + 3800, a.y + 500, 300, 250, 'shop'))
        out.push(buildBuilding(a.x + 4200, a.y + 200, 380, 340, 'apartment'))
        out.push(buildBuilding(a.x + 200, a.y + 1200, 350, 300, 'warehouse'))
        out.push(buildBuilding(a.x + 600, a.y + 1500, 400, 350, 'factory_hall'))
        out.push(buildBuilding(a.x + 1100, a.y + 1200, 320, 280, 'shop'))
        out.push(buildBuilding(a.x + 1500, a.y + 1600, 380, 320, 'apartment'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS.find(r => r.id === 'port')
        if (!a) return out
        out.push(buildBuilding(a.x + 200, a.y + 800, 600, 400, 'warehouse'))
        out.push(buildBuilding(a.x + 900, a.y + 500, 400, 350, 'shed'))
        out.push(buildBuilding(a.x + 1400, a.y + 1200, 500, 380, 'warehouse'))
        out.push(buildBuilding(a.x + 2000, a.y + 600, 350, 300, 'tower'))
        out.push(buildBuilding(a.x + 2500, a.y + 1000, 450, 400, 'warehouse'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS.find(r => r.id === 'military')
        if (!a) return out
        out.push(buildBuilding(a.x + 300, a.y + 300, 500, 400, 'barracks'))
        out.push(buildBuilding(a.x + 900, a.y + 200, 450, 380, 'warehouse'))
        out.push(buildBuilding(a.x + 1400, a.y + 350, 400, 350, 'barracks'))
        out.push(buildBuilding(a.x + 1900, a.y + 100, 350, 300, 'tower'))
        out.push(buildBuilding(a.x + 2300, a.y + 400, 500, 450, 'factory_hall'))
        out.push(buildBuilding(a.x + 2900, a.y + 250, 400, 350, 'barracks'))
        out.push(buildBuilding(a.x + 500, a.y + 900, 350, 300, 'shed'))
        out.push(buildBuilding(a.x + 1000, a.y + 850, 400, 350, 'warehouse'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS.find(r => r.id === 'fields')
        if (!a) return out
        out.push(buildBuilding(a.x + 800, a.y + 600, 300, 250, 'barn'))
        out.push(buildBuilding(a.x + 1200, a.y + 400, 250, 220, 'house'))
        out.push(buildBuilding(a.x + 2200, a.y + 800, 320, 280, 'barn'))
        out.push(buildBuilding(a.x + 3200, a.y + 500, 280, 240, 'house'))
        out.push(buildBuilding(a.x + 4000, a.y + 700, 300, 260, 'barn'))
        return out
    })()
]

function treePositionsInArea(area, count, type) {
    const out = []
    const m = 180
    const step = 95
    const seed = (area.id.length * 7 + area.x) % 1000
    let n = 0
    for (let ix = 0; ix < Math.ceil((area.w - 2 * m) / step) && n < count; ix++) {
        for (let iy = 0; iy < Math.ceil((area.h - 2 * m) / step) && n < count; iy++) {
            const x = area.x + m + (ix * step + (seed + ix * 11) % 30)
            const y = area.y + m + (iy * step + (seed + iy * 13) % 30)
            const t = type || ((seed + ix + iy) % 2 === 0 ? 'pine' : 'oak')
            out.push({ x, y, type: t })
            n++
        }
    }
    return out
}

const TREES = [
    ...treePositionsInArea(AREAS.find(a => a.id === 'forest_big'), 140, 'pine'),
    ...treePositionsInArea(AREAS.find(a => a.id === 'forest_big'), 120, 'oak'),
    ...treePositionsInArea(AREAS.find(a => a.id === 'forest_small'), 45, 'pine'),
    ...treePositionsInArea(AREAS.find(a => a.id === 'forest_small'), 40, 'oak'),
    ...treePositionsInArea(AREAS.find(a => a.id === 'swamp'), 35, 'oak'),
    ...(() => {
        const a = AREAS.find(r => r.id === 'mountain')
        if (!a) return []
        return treePositionsInArea(a, 30, 'pine')
    })()
]

const OBSTACLES = [
    { x: 1400 * SCALE, y: 800 * SCALE, w: 150 * SCALE, h: 60 * SCALE },
    { x: 3300 * SCALE, y: 200 * SCALE, w: 120 * SCALE, h: 80 * SCALE }
]

function isPointInBuilding(x, y) {
    for (const b of BUILDINGS) {
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return true
    }
    return false
}

function isPointInTree(x, y) {
    for (const t of TREES) {
        if (Math.hypot(x - t.x, y - t.y) < TREE_RADIUS) return true
    }
    return false
}

function isPointInObstacle(x, y) {
    for (const o of OBSTACLES) {
        if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return true
    }
    if (isPointInBuilding(x, y)) return true
    if (isPointInTree(x, y)) return true
    return false
}

const LOOT_SPAWN_POINTS = (() => {
    const points = []
    for (const area of AREAS) {
        const margin = 300
        const step = 480
        for (let px = area.x + margin; px < area.x + area.w - margin; px += step) {
            for (let py = area.y + margin; py < area.y + area.h - margin; py += step) {
                const x = Math.round(px)
                const y = Math.round(py)
                if (!isPointInObstacle(x, y)) points.push({ x, y })
            }
        }
    }
    return points
})()

const CENTER_X = MAP_WIDTH / 2
const CENTER_Y = MAP_HEIGHT / 2
const MIN_SPAWN_DISTANCE_FROM_CENTER = 0.4 * Math.min(MAP_WIDTH, MAP_HEIGHT) / 2
const SPAWN_MARGIN = 80

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

const POIS = AREAS.map(a => ({ id: a.id, name: a.name, x: a.x + a.w / 2, y: a.y + a.h / 2, w: 20, h: 20 }))

module.exports = {
    OBSTACLES,
    POIS,
    AREAS,
    BUILDINGS,
    TREES,
    TREE_RADIUS,
    LOOT_SPAWN_POINTS,
    isPointInObstacle,
    getRandomSpawnPoint
}
