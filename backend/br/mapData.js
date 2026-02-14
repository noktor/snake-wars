const { MAP_WIDTH, MAP_HEIGHT } = require('./constants')

const COORD_SCALE = MAP_WIDTH / 20000

function s(v) { return v * COORD_SCALE }

const TREE_RADIUS = 22
const WALL_THICKNESS_RAW = 25

const AREAS_RAW = [
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

const AREAS = AREAS_RAW.map(a => ({ ...a, x: s(a.x), y: s(a.y), w: s(a.w), h: s(a.h) }))

function buildBuilding(x, y, w, h, type, doorSide) {
    const doors = [{ side: doorSide || 'top', pos: 0.5, width: 0.22 }]
    return { x, y, w, h, type, doors }
}

function getWallSegments(b, wt) {
    const segs = []
    const door = (b.doors || []).find(d => d.side === 'top')
    const topLen = b.w
    const doorStart = door ? b.x + (door.pos - door.width / 2) * topLen : b.x + b.w + 1
    const doorEnd = door ? b.x + (door.pos + door.width / 2) * topLen : b.x
    if (doorStart > b.x) segs.push({ x: b.x, y: b.y, w: doorStart - b.x, h: wt })
    if (b.x + b.w > doorEnd) segs.push({ x: doorEnd, y: b.y, w: b.x + b.w - doorEnd, h: wt })
    const doorB = (b.doors || []).find(d => d.side === 'bottom')
    const botStart = doorB ? b.x + (doorB.pos - doorB.width / 2) * topLen : b.x + b.w + 1
    const botEnd = doorB ? b.x + (doorB.pos + doorB.width / 2) * topLen : b.x
    if (botStart > b.x) segs.push({ x: b.x, y: b.y + b.h - wt, w: botStart - b.x, h: wt })
    if (b.x + b.w > botEnd) segs.push({ x: botEnd, y: b.y + b.h - wt, w: b.x + b.w - botEnd, h: wt })
    const doorL = (b.doors || []).find(d => d.side === 'left')
    const leftLen = b.h
    const leftStart = doorL ? b.y + (doorL.pos - doorL.width / 2) * leftLen : b.y + b.h + 1
    const leftEnd = doorL ? b.y + (doorL.pos + doorL.width / 2) * leftLen : b.y
    if (leftStart > b.y) segs.push({ x: b.x, y: b.y, w: wt, h: leftStart - b.y })
    if (b.y + b.h > leftEnd) segs.push({ x: b.x, y: leftEnd, w: wt, h: b.y + b.h - leftEnd })
    const doorR = (b.doors || []).find(d => d.side === 'right')
    const rightStart = doorR ? b.y + (doorR.pos - doorR.width / 2) * leftLen : b.y + b.h + 1
    const rightEnd = doorR ? b.y + (doorR.pos + doorR.width / 2) * leftLen : b.y
    if (rightStart > b.y) segs.push({ x: b.x + b.w - wt, y: b.y, w: wt, h: rightStart - b.y })
    if (b.y + b.h > rightEnd) segs.push({ x: b.x + b.w - wt, y: rightEnd, w: wt, h: b.y + b.h - rightEnd })
    return segs
}

const BUILDINGS_RAW = [
    ...(() => {
        const out = []
        const a = AREAS_RAW.find(r => r.id === 'factory')
        if (!a) return out
        out.push(buildBuilding(a.x + 200, a.y + 200, 800, 500, 'factory_hall', 'top'))
        out.push(buildBuilding(a.x + 1100, a.y + 300, 400, 350, 'warehouse', 'left'))
        out.push(buildBuilding(a.x + 1600, a.y + 700, 600, 400, 'shed', 'bottom'))
        out.push(buildBuilding(a.x + 400, a.y + 800, 350, 300, 'warehouse', 'right'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS_RAW.find(r => r.id === 'village')
        if (!a) return out
        out.push(buildBuilding(a.x + 300, a.y + 400, 180, 150, 'house', 'top'))
        out.push(buildBuilding(a.x + 550, a.y + 350, 160, 140, 'house', 'bottom'))
        out.push(buildBuilding(a.x + 800, a.y + 500, 200, 160, 'house', 'left'))
        out.push(buildBuilding(a.x + 1100, a.y + 400, 220, 180, 'shop', 'top'))
        out.push(buildBuilding(a.x + 1400, a.y + 600, 170, 150, 'house', 'right'))
        out.push(buildBuilding(a.x + 1700, a.y + 300, 190, 170, 'house', 'top'))
        out.push(buildBuilding(a.x + 2100, a.y + 500, 250, 200, 'church', 'bottom'))
        out.push(buildBuilding(a.x + 500, a.y + 900, 200, 150, 'barn', 'left'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS_RAW.find(r => r.id === 'city')
        if (!a) return out
        out.push(buildBuilding(a.x + 200, a.y + 200, 400, 350, 'apartment', 'top'))
        out.push(buildBuilding(a.x + 650, a.y + 150, 350, 300, 'office', 'left'))
        out.push(buildBuilding(a.x + 1050, a.y + 250, 380, 320, 'apartment', 'bottom'))
        out.push(buildBuilding(a.x + 1500, a.y + 100, 450, 380, 'skyscraper', 'top'))
        out.push(buildBuilding(a.x + 2000, a.y + 550, 320, 280, 'shop', 'right'))
        out.push(buildBuilding(a.x + 2400, a.y + 200, 400, 350, 'apartment', 'top'))
        out.push(buildBuilding(a.x + 2900, a.y + 400, 350, 300, 'office', 'left'))
        out.push(buildBuilding(a.x + 3300, a.y + 100, 420, 360, 'skyscraper', 'bottom'))
        out.push(buildBuilding(a.x + 3800, a.y + 500, 300, 250, 'shop', 'top'))
        out.push(buildBuilding(a.x + 4200, a.y + 200, 380, 340, 'apartment', 'right'))
        out.push(buildBuilding(a.x + 200, a.y + 1200, 350, 300, 'warehouse', 'left'))
        out.push(buildBuilding(a.x + 600, a.y + 1500, 400, 350, 'factory_hall', 'bottom'))
        out.push(buildBuilding(a.x + 1100, a.y + 1200, 320, 280, 'shop', 'top'))
        out.push(buildBuilding(a.x + 1500, a.y + 1600, 380, 320, 'apartment', 'right'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS_RAW.find(r => r.id === 'port')
        if (!a) return out
        out.push(buildBuilding(a.x + 200, a.y + 800, 600, 400, 'warehouse', 'top'))
        out.push(buildBuilding(a.x + 900, a.y + 500, 400, 350, 'shed', 'left'))
        out.push(buildBuilding(a.x + 1400, a.y + 1200, 500, 380, 'warehouse', 'bottom'))
        out.push(buildBuilding(a.x + 2000, a.y + 600, 350, 300, 'tower', 'right'))
        out.push(buildBuilding(a.x + 2500, a.y + 1000, 450, 400, 'warehouse', 'top'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS_RAW.find(r => r.id === 'military')
        if (!a) return out
        out.push(buildBuilding(a.x + 300, a.y + 300, 500, 400, 'barracks', 'top'))
        out.push(buildBuilding(a.x + 900, a.y + 200, 450, 380, 'warehouse', 'left'))
        out.push(buildBuilding(a.x + 1400, a.y + 350, 400, 350, 'barracks', 'bottom'))
        out.push(buildBuilding(a.x + 1900, a.y + 100, 350, 300, 'tower', 'right'))
        out.push(buildBuilding(a.x + 2300, a.y + 400, 500, 450, 'factory_hall', 'top'))
        out.push(buildBuilding(a.x + 2900, a.y + 250, 400, 350, 'barracks', 'left'))
        out.push(buildBuilding(a.x + 500, a.y + 900, 350, 300, 'shed', 'bottom'))
        out.push(buildBuilding(a.x + 1000, a.y + 850, 400, 350, 'warehouse', 'right'))
        return out
    })(),
    ...(() => {
        const out = []
        const a = AREAS_RAW.find(r => r.id === 'fields')
        if (!a) return out
        out.push(buildBuilding(a.x + 800, a.y + 600, 300, 250, 'barn', 'left'))
        out.push(buildBuilding(a.x + 1200, a.y + 400, 250, 220, 'house', 'top'))
        out.push(buildBuilding(a.x + 2200, a.y + 800, 320, 280, 'barn', 'bottom'))
        out.push(buildBuilding(a.x + 3200, a.y + 500, 280, 240, 'house', 'right'))
        out.push(buildBuilding(a.x + 4000, a.y + 700, 300, 260, 'barn', 'top'))
        return out
    })()
]

const BUILDINGS = BUILDINGS_RAW.map(b => ({ ...b, x: s(b.x), y: s(b.y), w: s(b.w), h: s(b.h), doors: b.doors || [] }))
const WALL_THICKNESS = s(WALL_THICKNESS_RAW)
const BUILDING_WALLS = BUILDINGS_RAW.flatMap(b => getWallSegments(b, WALL_THICKNESS_RAW)).map(w => ({ x: s(w.x), y: s(w.y), w: s(w.w), h: s(w.h) }))

// Roads/paths to fill gaps and connect areas (raw coords)
function roadRect(x, y, w, h) {
    return { x, y, w, h }
}
const ROADS_RAW = [
    roadRect(4400, 0, 200, 5000),
    roadRect(7400, 0, 200, 3800),
    roadRect(10900, 0, 200, 4500),
    roadRect(16400, 0, 200, 5500),
    roadRect(2500, 3500, 15000, 180),
    roadRect(3400, 4500, 220, 4200),
    roadRect(5480, 2500, 200, 2800),
    roadRect(4980, 2500, 220, 2600),
    roadRect(5980, 7300, 900, 200),
    roadRect(4500, 4680, 2800, 200),
    roadRect(0, 4480, 400, 200),
    roadRect(1680, 0, 200, 4600),
    roadRect(11800, 4680, 1200, 200),
    roadRect(12200, 2500, 200, 2500),
    roadRect(9500, 5980, 220, 3200),
]

// Road barriers (valles): walls with a gap to pass through. gapPos/gapWidth in 0..1.
function barrierHorizontal(x, y, len, thick, gapPos, gapWidth) {
    const segs = []
    const g0 = len * Math.max(0, gapPos - gapWidth / 2)
    const g1 = len * Math.min(1, gapPos + gapWidth / 2)
    if (g0 > 2) segs.push({ x, y, w: g0, h: thick })
    if (len - g1 > 2) segs.push({ x: x + g1, y, w: len - g1, h: thick })
    return segs
}
function barrierVertical(x, y, thick, len, gapPos, gapWidth) {
    const segs = []
    const g0 = len * Math.max(0, gapPos - gapWidth / 2)
    const g1 = len * Math.min(1, gapPos + gapWidth / 2)
    if (g0 > 2) segs.push({ x, y, w: thick, h: g0 })
    if (len - g1 > 2) segs.push({ x, y: y + g1, w: thick, h: len - g1 })
    return segs
}

const ROAD_BARRIERS_RAW = [
    ...barrierHorizontal(5000, 3600, 220, 90, 0.5, 0.35),
    ...barrierHorizontal(7200, 1800, 220, 90, 0.5, 0.3),
    ...barrierVertical(5500, 3200, 90, 400, 0.5, 0.4),
    ...barrierHorizontal(6100, 7380, 500, 90, 0.5, 0.35),
    ...barrierVertical(3600, 4800, 90, 350, 0.5, 0.4),
    ...barrierHorizontal(4600, 4760, 600, 90, 0.5, 0.3),
]

const ROADS = ROADS_RAW.map(r => ({ x: s(r.x), y: s(r.y), w: s(r.w), h: s(r.h) }))
const ROAD_WALL_SEGMENTS = ROAD_BARRIERS_RAW.map(w => ({ x: s(w.x), y: s(w.y), w: s(w.w), h: s(w.h) }))

function treePositionsInArea(area, count, type, stepOverride) {
    const out = []
    const m = 160
    const step = stepOverride != null ? stepOverride : 95
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

const TREES_RAW = [
    ...treePositionsInArea(AREAS_RAW.find(a => a.id === 'forest_big'), 280, 'pine', 52),
    ...treePositionsInArea(AREAS_RAW.find(a => a.id === 'forest_big'), 260, 'oak', 54),
    ...treePositionsInArea(AREAS_RAW.find(a => a.id === 'forest_small'), 95, 'pine', 58),
    ...treePositionsInArea(AREAS_RAW.find(a => a.id === 'forest_small'), 90, 'oak', 60),
    ...treePositionsInArea(AREAS_RAW.find(a => a.id === 'swamp'), 55, 'oak', 72),
    ...(() => {
        const a = AREAS_RAW.find(r => r.id === 'mountain')
        if (!a) return []
        return treePositionsInArea(a, 55, 'pine', 85)
    })(),
    ...(() => {
        const a = AREAS_RAW.find(r => r.id === 'fields')
        if (!a) return []
        return treePositionsInArea(a, 28, 'oak', 180)
    })()
]

const TREES = TREES_RAW.map(t => ({ ...t, x: s(t.x), y: s(t.y) }))

const OBSTACLES = [
    { x: s(1400), y: s(800), w: s(150), h: s(60) },
    { x: s(3300), y: s(200), w: s(120), h: s(80) }
]

function isPointInWall(x, y) {
    for (const w of BUILDING_WALLS) {
        if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true
    }
    for (const w of ROAD_WALL_SEGMENTS) {
        if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true
    }
    return false
}

function isPointInsideBuildingInterior(x, y) {
    const wt = WALL_THICKNESS
    for (const b of BUILDINGS) {
        if (x >= b.x + wt && x < b.x + b.w - wt && y >= b.y + wt && y < b.y + b.h - wt) return true
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
    if (isPointInWall(x, y)) return true
    if (isPointInTree(x, y)) return true
    return false
}

const LOOT_SPAWN_POINTS = (() => {
    const points = []
    const wt = WALL_THICKNESS
    for (const b of BUILDINGS) {
        const innerX = b.x + wt
        const innerY = b.y + wt
        const innerW = b.w - 2 * wt
        const innerH = b.h - 2 * wt
        if (innerW < 30 || innerH < 30) continue
        const step = 70
        for (let px = innerX; px < innerX + innerW - 10; px += step) {
            for (let py = innerY; py < innerY + innerH - 10; py += step) {
                const x = Math.round(px)
                const y = Math.round(py)
                if (!isPointInObstacle(x, y)) points.push({ x, y })
            }
        }
    }
    for (const area of AREAS) {
        const margin = 320
        const step = 580
        for (let px = area.x + margin; px < area.x + area.w - margin; px += step) {
            for (let py = area.y + margin; py < area.y + area.h - margin; py += step) {
                const x = Math.round(px)
                const y = Math.round(py)
                if (isPointInsideBuildingInterior(x, y)) continue
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
    BUILDING_WALLS,
    WALL_THICKNESS,
    ROADS,
    ROAD_WALL_SEGMENTS,
    TREES,
    TREE_RADIUS,
    LOOT_SPAWN_POINTS,
    isPointInObstacle,
    isPointInsideBuildingInterior,
    getRandomSpawnPoint
}
