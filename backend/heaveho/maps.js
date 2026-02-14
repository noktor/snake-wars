const { WORLD_WIDTH, WORLD_HEIGHT } = require('./constants')

const SPAWN_PLATFORM_Y = 270
const SPAWN_Y = SPAWN_PLATFORM_Y - 28

const CAMPAIGN_1 = [
    {
        id: 'level1',
        platforms: [
            { x: 0, y: SPAWN_PLATFORM_Y, w: 180, h: 30 },
            { x: 220, y: 280, w: 100, h: 20 },
            { x: 460, y: 250, w: 90, h: 20 },
            { x: 620, y: 300, w: 180, h: 20 }
        ],
        spawns: [
            { x: 80, y: SPAWN_Y },
            { x: 120, y: SPAWN_Y },
            { x: 160, y: SPAWN_Y },
            { x: 200, y: SPAWN_Y }
        ],
        goal: { x: WORLD_WIDTH - 100, y: WORLD_HEIGHT - 80, w: 80, h: 50 }
    },
    {
        id: 'level2',
        platforms: [
            { x: 0, y: SPAWN_PLATFORM_Y, w: 120, h: 30 },
            { x: 100, y: 300, w: 70, h: 15 },
            { x: 260, y: 250, w: 80, h: 15 },
            { x: 410, y: 200, w: 70, h: 15 },
            { x: 560, y: 250, w: 80, h: 15 },
            { x: 700, y: WORLD_HEIGHT - 60, w: 100, h: 30 }
        ],
        spawns: [
            { x: 50, y: SPAWN_Y },
            { x: 90, y: SPAWN_Y },
            { x: 130, y: SPAWN_Y },
            { x: 170, y: SPAWN_Y }
        ],
        goal: { x: WORLD_WIDTH - 120, y: WORLD_HEIGHT - 90, w: 100, h: 60 }
    },
    {
        id: 'level3',
        platforms: [
            { x: 0, y: SPAWN_PLATFORM_Y, w: 220, h: 30 },
            { x: 370, y: WORLD_HEIGHT - 30, w: 120, h: 30 },
            { x: 580, y: WORLD_HEIGHT - 30, w: 220, h: 30 },
            { x: 320, y: 220, w: 70, h: 15 },
            { x: 505, y: 180, w: 70, h: 15 }
        ],
        spawns: [
            { x: 80, y: SPAWN_Y },
            { x: 130, y: SPAWN_Y },
            { x: 180, y: SPAWN_Y },
            { x: 230, y: SPAWN_Y }
        ],
        goal: { x: 620, y: WORLD_HEIGHT - 70, w: 100, h: 40 }
    },
    {
        id: 'level4',
        platforms: [
            { x: 0, y: SPAWN_PLATFORM_Y, w: WORLD_WIDTH, h: 30 },
            { x: 150, y: 300, w: 100, h: 20 },
            { x: 350, y: 250, w: 100, h: 20 },
            { x: 550, y: 300, w: 100, h: 20 }
        ],
        spawns: [
            { x: 60, y: SPAWN_Y },
            { x: 100, y: SPAWN_Y },
            { x: 140, y: SPAWN_Y },
            { x: 180, y: SPAWN_Y }
        ],
        goal: { x: WORLD_WIDTH - 100, y: WORLD_HEIGHT - 80, w: 80, h: 50 },
        object: { x: 400, y: 200 },
        objectGoal: { x: WORLD_WIDTH - 120, y: WORLD_HEIGHT - 100, w: 60, h: 40 }
    },
    {
        id: 'level5',
        platforms: [
            { x: 0, y: SPAWN_PLATFORM_Y, w: WORLD_WIDTH, h: 30 },
            { x: 100, y: 280, w: 90, h: 18 },
            { x: 280, y: 230, w: 90, h: 18 },
            { x: 430, y: 280, w: 90, h: 18 },
            { x: 610, y: 230, w: 90, h: 18 },
            { x: 700, y: WORLD_HEIGHT - 50, w: 100, h: 20 }
        ],
        spawns: [
            { x: 50, y: SPAWN_Y },
            { x: 95, y: SPAWN_Y },
            { x: 140, y: SPAWN_Y },
            { x: 185, y: SPAWN_Y }
        ],
        goal: { x: WORLD_WIDTH - 90, y: WORLD_HEIGHT - 70, w: 70, h: 40 },
        object: { x: 350, y: 180 },
        objectGoal: { x: WORLD_WIDTH - 100, y: WORLD_HEIGHT - 90, w: 50, h: 30 }
    }
]

module.exports = { CAMPAIGN_1 }
