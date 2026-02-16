const { MAP_WIDTH, MAP_HEIGHT, TILE, TREE_RESOURCE, GOLD_MINE_RESOURCE } = require('./constants')

// Player spawn positions (top-left of town hall 3x3)
const SPAWN_POSITIONS = [
    { x: 5, y: 5 },
    { x: MAP_WIDTH - 8, y: MAP_HEIGHT - 8 }
]

function generateMap() {
    const tiles = []
    const resources = {}

    for (let y = 0; y < MAP_HEIGHT; y++) {
        tiles[y] = []
        for (let x = 0; x < MAP_WIDTH; x++) {
            tiles[y][x] = TILE.GRASS
        }
    }

    // Water: a river through the middle
    for (let y = 0; y < MAP_HEIGHT; y++) {
        const cx = Math.floor(MAP_WIDTH / 2) + Math.floor(Math.sin(y * 0.3) * 2)
        for (let dx = -1; dx <= 1; dx++) {
            const wx = cx + dx
            if (wx >= 0 && wx < MAP_WIDTH) {
                tiles[y][wx] = TILE.WATER
            }
        }
    }

    // Gold mines: clusters near each player and in the center
    const goldClusters = [
        { cx: 10, cy: 10, count: 4 },
        { cx: MAP_WIDTH - 11, cy: MAP_HEIGHT - 11, count: 4 },
        { cx: Math.floor(MAP_WIDTH / 2) - 6, cy: Math.floor(MAP_HEIGHT / 2), count: 3 },
        { cx: Math.floor(MAP_WIDTH / 2) + 6, cy: Math.floor(MAP_HEIGHT / 2), count: 3 }
    ]
    for (const cluster of goldClusters) {
        let placed = 0
        for (let attempt = 0; attempt < 40 && placed < cluster.count; attempt++) {
            const gx = cluster.cx + Math.floor(Math.random() * 5) - 2
            const gy = cluster.cy + Math.floor(Math.random() * 5) - 2
            if (gx >= 0 && gx < MAP_WIDTH && gy >= 0 && gy < MAP_HEIGHT && tiles[gy][gx] === TILE.GRASS) {
                tiles[gy][gx] = TILE.GOLD_MINE
                resources[gx + ',' + gy] = { type: 'GOLD', amount: GOLD_MINE_RESOURCE }
                placed++
            }
        }
    }

    // Trees: scattered forest patches
    const treeClusters = [
        { cx: 3, cy: 20, r: 6 },
        { cx: 20, cy: 3, r: 5 },
        { cx: MAP_WIDTH - 4, cy: MAP_HEIGHT - 20, r: 6 },
        { cx: MAP_WIDTH - 20, cy: MAP_HEIGHT - 4, r: 5 },
        { cx: MAP_WIDTH / 2 - 10, cy: MAP_HEIGHT / 2 - 10, r: 4 },
        { cx: MAP_WIDTH / 2 + 10, cy: MAP_HEIGHT / 2 + 10, r: 4 },
        { cx: 15, cy: MAP_HEIGHT - 15, r: 5 },
        { cx: MAP_WIDTH - 15, cy: 15, r: 5 }
    ]
    for (const cluster of treeClusters) {
        for (let dy = -cluster.r; dy <= cluster.r; dy++) {
            for (let dx = -cluster.r; dx <= cluster.r; dx++) {
                const tx = Math.floor(cluster.cx + dx)
                const ty = Math.floor(cluster.cy + dy)
                if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue
                if (tiles[ty][tx] !== TILE.GRASS) continue
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist <= cluster.r && Math.random() < 0.65) {
                    tiles[ty][tx] = TILE.TREE
                    resources[tx + ',' + ty] = { type: 'WOOD', amount: TREE_RESOURCE }
                }
            }
        }
    }

    // Rocks: a few scattered
    for (let i = 0; i < 20; i++) {
        const rx = Math.floor(Math.random() * MAP_WIDTH)
        const ry = Math.floor(Math.random() * MAP_HEIGHT)
        if (tiles[ry][rx] === TILE.GRASS) {
            tiles[ry][rx] = TILE.ROCK
        }
    }

    // Clear spawn areas (5x5 around each spawn)
    for (const sp of SPAWN_POSITIONS) {
        for (let dy = -1; dy <= 5; dy++) {
            for (let dx = -1; dx <= 5; dx++) {
                const cx = sp.x + dx
                const cy = sp.y + dy
                if (cx >= 0 && cx < MAP_WIDTH && cy >= 0 && cy < MAP_HEIGHT) {
                    if (tiles[cy][cx] !== TILE.GRASS) {
                        const key = cx + ',' + cy
                        delete resources[key]
                    }
                    tiles[cy][cx] = TILE.GRASS
                }
            }
        }
    }

    return { tiles, resources }
}

function isWalkable(tiles, x, y) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false
    const t = tiles[y][x]
    return t === TILE.GRASS
}

function isBuildable(tiles, x, y, sizeX, sizeY, buildings) {
    for (let dy = 0; dy < sizeY; dy++) {
        for (let dx = 0; dx < sizeX; dx++) {
            const tx = x + dx
            const ty = y + dy
            if (!isWalkable(tiles, tx, ty)) return false
            // Check collision with other buildings
            for (const b of buildings) {
                if (tx >= b.x && tx < b.x + b.sizeX && ty >= b.y && ty < b.y + b.sizeY) return false
            }
        }
    }
    return true
}

module.exports = { SPAWN_POSITIONS, generateMap, isWalkable, isBuildable }
