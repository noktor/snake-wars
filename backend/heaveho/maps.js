const { WORLD_WIDTH, WORLD_HEIGHT } = require('./constants')

const CAMPAIGN_1 = [
    {
        id: 'level1',
        platforms: [
            { x: 0, y: WORLD_HEIGHT - 30, w: WORLD_WIDTH, h: 30 },
            { x: 200, y: 280, w: 120, h: 20 },
            { x: 450, y: 250, w: 100, h: 20 },
            { x: 600, y: 300, w: 150, h: 20 }
        ],
        spawns: [
            { x: 80, y: WORLD_HEIGHT - 30 - 28 },
            { x: 120, y: WORLD_HEIGHT - 30 - 28 },
            { x: 160, y: WORLD_HEIGHT - 30 - 28 },
            { x: 200, y: WORLD_HEIGHT - 30 - 28 }
        ],
        goal: { x: WORLD_WIDTH - 100, y: WORLD_HEIGHT - 80, w: 80, h: 50 }
    },
    {
        id: 'level2',
        platforms: [
            { x: 0, y: WORLD_HEIGHT - 30, w: WORLD_WIDTH, h: 30 },
            { x: 100, y: 300, w: 80, h: 15 },
            { x: 250, y: 250, w: 100, h: 15 },
            { x: 400, y: 200, w: 80, h: 15 },
            { x: 550, y: 250, w: 100, h: 15 },
            { x: 700, y: WORLD_HEIGHT - 60, w: 100, h: 30 }
        ],
        spawns: [
            { x: 50, y: WORLD_HEIGHT - 30 - 28 },
            { x: 90, y: WORLD_HEIGHT - 30 - 28 },
            { x: 130, y: WORLD_HEIGHT - 30 - 28 },
            { x: 170, y: WORLD_HEIGHT - 30 - 28 }
        ],
        goal: { x: WORLD_WIDTH - 120, y: WORLD_HEIGHT - 90, w: 100, h: 60 }
    },
    {
        id: 'level3',
        platforms: [
            { x: 0, y: WORLD_HEIGHT - 30, w: 300, h: 30 },
            { x: 350, y: WORLD_HEIGHT - 30, w: 150, h: 30 },
            { x: 550, y: WORLD_HEIGHT - 30, w: 250, h: 30 },
            { x: 320, y: 220, w: 80, h: 15 },
            { x: 500, y: 180, w: 80, h: 15 }
        ],
        spawns: [
            { x: 80, y: WORLD_HEIGHT - 30 - 28 },
            { x: 130, y: WORLD_HEIGHT - 30 - 28 },
            { x: 180, y: WORLD_HEIGHT - 30 - 28 },
            { x: 230, y: WORLD_HEIGHT - 30 - 28 }
        ],
        goal: { x: 620, y: WORLD_HEIGHT - 70, w: 100, h: 40 }
    },
    {
        id: 'level4',
        platforms: [
            { x: 0, y: WORLD_HEIGHT - 30, w: WORLD_WIDTH, h: 30 },
            { x: 150, y: 300, w: 100, h: 20 },
            { x: 350, y: 250, w: 100, h: 20 },
            { x: 550, y: 300, w: 100, h: 20 }
        ],
        spawns: [
            { x: 60, y: WORLD_HEIGHT - 30 - 28 },
            { x: 100, y: WORLD_HEIGHT - 30 - 28 },
            { x: 140, y: WORLD_HEIGHT - 30 - 28 },
            { x: 180, y: WORLD_HEIGHT - 30 - 28 }
        ],
        goal: { x: WORLD_WIDTH - 100, y: WORLD_HEIGHT - 80, w: 80, h: 50 },
        object: { x: 400, y: 200 },
        objectGoal: { x: WORLD_WIDTH - 120, y: WORLD_HEIGHT - 100, w: 60, h: 40 }
    },
    {
        id: 'level5',
        platforms: [
            { x: 0, y: WORLD_HEIGHT - 30, w: WORLD_WIDTH, h: 30 },
            { x: 100, y: 280, w: 90, h: 18 },
            { x: 280, y: 230, w: 90, h: 18 },
            { x: 430, y: 280, w: 90, h: 18 },
            { x: 610, y: 230, w: 90, h: 18 },
            { x: 700, y: WORLD_HEIGHT - 50, w: 100, h: 20 }
        ],
        spawns: [
            { x: 50, y: WORLD_HEIGHT - 30 - 28 },
            { x: 95, y: WORLD_HEIGHT - 30 - 28 },
            { x: 140, y: WORLD_HEIGHT - 30 - 28 },
            { x: 185, y: WORLD_HEIGHT - 30 - 28 }
        ],
        goal: { x: WORLD_WIDTH - 90, y: WORLD_HEIGHT - 70, w: 70, h: 40 },
        object: { x: 350, y: 180 },
        objectGoal: { x: WORLD_WIDTH - 100, y: WORLD_HEIGHT - 90, w: 50, h: 30 }
    }
]

module.exports = { CAMPAIGN_1 }
