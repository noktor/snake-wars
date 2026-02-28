'use strict'

const db = require('./db')
const { runTick } = require('./tick')
const { computeProduction } = require('./production')
const { normalizeNickname } = require('../utils')
const {
  TICK_MS,
  BUILDING_TYPES,
  BUILD_TIME_BASE,
  BUILD_COST_BASE,
  GALAXIES,
  SYSTEMS,
  RESEARCH_TYPES,
  RESEARCH_COST_BASE,
  RESEARCH_TIME_BASE,
  SHIP_TYPES,
  SHIP_COST,
  SHIP_BUILD_TIME_BASE,
  SHIP_SPEED,
  DEFENSE_TYPES,
  DEFENSE_COST,
  DEFENSE_BUILD_TIME_BASE,
  CARGO_CAPACITY,
  ALLIANCE_TAG_MAX,
  ALLIANCE_NAME_MAX,
  ALLIANCE_CHAT_MAX
} = require('./constants')

function getBuildCost(buildingType, currentLevel) {
  const base = BUILD_COST_BASE[buildingType]
  if (!base) return null
  return {
    metal: Math.floor(base.metal * Math.pow(1.5, currentLevel)),
    crystal: Math.floor(base.crystal * Math.pow(1.5, currentLevel)),
    deuterium: Math.floor(base.deuterium * Math.pow(1.5, currentLevel))
  }
}

function getBuildDuration(buildingType, currentLevel) {
  const base = BUILD_TIME_BASE[buildingType]
  if (!base) return 0
  return Math.max(1, Math.floor(base * Math.pow(1.5, currentLevel)))
}

function getResearchCost(techType, currentLevel) {
  const base = RESEARCH_COST_BASE[techType]
  if (!base) return null
  return {
    metal: Math.floor(base.metal * Math.pow(2, currentLevel)),
    crystal: Math.floor(base.crystal * Math.pow(2, currentLevel)),
    deuterium: Math.floor(base.deuterium * Math.pow(2, currentLevel))
  }
}

function getResearchDuration(techType, currentLevel) {
  const base = RESEARCH_TIME_BASE[techType]
  if (!base) return 0
  return Math.max(1, Math.floor(base * Math.pow(2, currentLevel)))
}

function getShipBuildDuration(shipType, shipyardLevel) {
  const base = SHIP_BUILD_TIME_BASE[shipType]
  if (!base) return 0
  return Math.max(1, Math.floor(base / (1 + shipyardLevel)))
}

function getFlightDuration(fromPlanet, toPlanet, ships) {
  const distance = Math.abs(fromPlanet.system - toPlanet.system) * 1000 + Math.abs(fromPlanet.slot - toPlanet.slot) * 100
  let minSpeed = Infinity
  for (const [type, count] of Object.entries(ships)) {
    if (count > 0 && SHIP_SPEED[type]) minSpeed = Math.min(minSpeed, SHIP_SPEED[type])
  }
  if (minSpeed === Infinity) return 0
  return Math.max(1, Math.floor(distance / minSpeed))
}

function getDefenseBuildDuration(defenseType, shipyardLevel) {
  const base = DEFENSE_BUILD_TIME_BASE[defenseType]
  if (!base) return 0
  return Math.max(1, Math.floor(base / (1 + shipyardLevel)))
}

function attachEmpireNamespace(io) {
  db.getDb()
  setInterval(runTick, TICK_MS)

  const empireNs = io.of('/empire')

  empireNs.on('connection', (client) => {
    client.on('identify', (data) => {
      const nickname = normalizeNickname(typeof data === 'string' ? data : (data && data.nickname))
      if (!nickname) {
        client.emit('error', { message: 'Nickname required' })
        return
      }
      let player = db.getPlayerByNickname(nickname)
      if (!player) {
        player = db.createPlayer(nickname)
        if (!player) {
          client.emit('error', { message: 'No empty slot in start zone' })
          return
        }
      } else {
        db.updateLastSeen(player.id)
      }
      client.empirePlayerId = player.id
      const research = db.getResearch(player.id)
      for (const t of RESEARCH_TYPES) {
        if (research[t] === undefined) research[t] = 0
      }
      const rq = db.getResearchQueue(player.id)
      const ownedPlanets = db.getOwnedPlanetsWithDetails(player.id)
      const alliance = db.getPlayerAlliance(player.id)
      if (alliance) client.join(`alliance:${alliance.id}`)
      client.emit('identified', {
        playerId: player.id,
        nickname: player.nickname,
        homePlanetId: player.home_planet_id,
        ownedPlanets,
        research,
        researchQueue: rq ? { techType: rq.tech_type, targetLevel: rq.target_level, finishesAt: rq.started_at + rq.duration_sec * 1000 } : null,
        alliance: alliance ? { id: alliance.id, name: alliance.name, tag: alliance.tag } : null
      })
    })

    client.on('getPlanet', (data) => {
      const planetId = data && data.planetId
      if (!planetId) {
        client.emit('error', { message: 'planetId required' })
        return
      }
      const planet = db.getPlanet(planetId)
      if (!planet) {
        client.emit('error', { message: 'Planet not found' })
        return
      }
      if (planet.owner_id !== client.empirePlayerId) {
        client.emit('error', { message: 'Not your planet' })
        return
      }
      const buildings = db.getBuildings(planetId)
      const production = computeProduction(planet, buildings)
      const buildQueue = db.getBuildQueue(planetId)
      const ships = db.getShips(planetId)
      const shipBuildQueue = db.getShipBuildQueue(planetId)
      const defenses = db.getDefenses(planetId)
      const defenseBuildQueue = db.getDefenseBuildQueue(planetId)
      const debris = db.getDebris(planetId)
      const nextBuildCosts = {}
      for (const type of BUILDING_TYPES) {
        const level = buildings[type] || 0
        const cost = getBuildCost(type, level)
        if (cost) nextBuildCosts[type] = cost
      }
      client.emit('planetData', {
        planet: {
          id: planet.id,
          galaxy: planet.galaxy,
          system: planet.system,
          slot: planet.slot,
          name: planet.name,
          metal: planet.metal,
          crystal: planet.crystal,
          deuterium: planet.deuterium,
          last_tick_at: planet.last_tick_at
        },
        energyProduced: production.energyProduced,
        energyConsumed: production.energyConsumed,
        energyBalance: production.energyBalance,
        buildings,
        buildQueue: buildQueue ? {
          buildingType: buildQueue.building_type,
          targetLevel: buildQueue.target_level,
          startedAt: buildQueue.started_at,
          durationSec: buildQueue.duration_sec,
          finishesAt: buildQueue.started_at + buildQueue.duration_sec * 1000
        } : null,
        resources: {
          metal: planet.metal,
          crystal: planet.crystal,
          deuterium: planet.deuterium
        },
        nextBuildCosts,
        ships: ships || {},
        shipBuildQueue: shipBuildQueue ? { shipType: shipBuildQueue.ship_type, startedAt: shipBuildQueue.started_at, durationSec: shipBuildQueue.duration_sec, finishesAt: shipBuildQueue.started_at + shipBuildQueue.duration_sec * 1000 } : null,
        defenses: defenses || {},
        defenseBuildQueue: defenseBuildQueue ? { defenseType: defenseBuildQueue.defense_type, startedAt: defenseBuildQueue.started_at, durationSec: defenseBuildQueue.duration_sec, finishesAt: defenseBuildQueue.started_at + defenseBuildQueue.duration_sec * 1000 } : null,
        debris: debris || { metal: 0, crystal: 0 }
      })
    })

    client.on('startBuild', (data) => {
      const planetId = data && data.planetId
      const buildingType = data && data.buildingType
      if (!planetId || !buildingType) {
        client.emit('error', { message: 'planetId and buildingType required' })
        return
      }
      if (!BUILDING_TYPES.includes(buildingType)) {
        client.emit('error', { message: 'Invalid building type' })
        return
      }
      const planet = db.getPlanet(planetId)
      if (!planet || !planet.owner_id) {
        client.emit('error', { message: 'Planet not found or not owned' })
        return
      }
      const existing = db.getBuildQueue(planetId)
      if (existing) {
        client.emit('error', { message: 'Build queue busy' })
        return
      }
      const buildings = db.getBuildings(planetId)
      const currentLevel = buildings[buildingType] || 0
      const targetLevel = currentLevel + 1
      const cost = getBuildCost(buildingType, currentLevel)
      if (!cost) {
        client.emit('error', { message: 'Unknown building cost' })
        return
      }
      if (planet.metal < cost.metal || planet.crystal < cost.crystal || planet.deuterium < cost.deuterium) {
        client.emit('error', { message: 'Not enough resources' })
        return
      }
      const durationSec = getBuildDuration(buildingType, currentLevel)
      const startedAt = Date.now()
      db.deductResources(planetId, cost.metal, cost.crystal, cost.deuterium)
      db.startBuild(planetId, buildingType, targetLevel, startedAt, durationSec)
      client.emit('buildStarted', {
        planetId,
        buildingType,
        targetLevel,
        finishesAt: startedAt + durationSec * 1000
      })
    })

    client.on('getMyPlanets', () => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      client.emit('myPlanets', { ownedPlanets: db.getOwnedPlanetsWithDetails(playerId) })
    })

    client.on('getGalaxy', (data) => {
      const galaxy = (data && data.galaxy) != null ? data.galaxy : 1
      const system = (data && data.system) != null ? data.system : 1
      if (galaxy < 1 || galaxy > GALAXIES || system < 1 || system > SYSTEMS) {
        client.emit('error', { message: 'Invalid galaxy or system' })
        return
      }
      const slots = db.getGalaxySlots(galaxy, system)
      client.emit('galaxyData', { galaxy, system, slots })
    })

    client.on('startResearch', (data) => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const techType = data && data.techType
      if (!techType || !RESEARCH_TYPES.includes(techType)) {
        client.emit('error', { message: 'Invalid tech type' })
        return
      }
      const player = db.getDb().prepare('SELECT home_planet_id FROM players WHERE id = ?').get(playerId)
      if (!player) {
        client.emit('error', { message: 'Player not found' })
        return
      }
      const home = db.getPlanet(player.home_planet_id)
      if (!home) {
        client.emit('error', { message: 'Home planet not found' })
        return
      }
      const buildings = db.getBuildings(home.id)
      const labLevel = buildings.research_lab || 0
      if (labLevel < 1) {
        client.emit('error', { message: 'Build Research Lab first' })
        return
      }
      if (db.getResearchQueue(playerId)) {
        client.emit('error', { message: 'Research queue busy' })
        return
      }
      const research = db.getResearch(playerId)
      const currentLevel = research[techType] || 0
      const targetLevel = currentLevel + 1
      const cost = getResearchCost(techType, currentLevel)
      if (!cost || (cost.metal + cost.crystal + cost.deuterium) === 0) {
        client.emit('error', { message: 'Invalid research cost' })
        return
      }
      if (home.metal < cost.metal || home.crystal < cost.crystal || home.deuterium < cost.deuterium) {
        client.emit('error', { message: 'Not enough resources' })
        return
      }
      const durationSec = getResearchDuration(techType, currentLevel)
      const startedAt = Date.now()
      db.deductResources(home.id, cost.metal, cost.crystal, cost.deuterium)
      db.startResearch(playerId, techType, targetLevel, startedAt, durationSec)
      client.emit('researchStarted', { techType, targetLevel, finishesAt: startedAt + durationSec * 1000 })
    })

    client.on('buildShip', (data) => {
      const planetId = data && data.planetId
      const shipType = data && data.shipType
      if (!planetId || !shipType || !SHIP_TYPES.includes(shipType)) {
        client.emit('error', { message: 'planetId and valid shipType required' })
        return
      }
      const planet = db.getPlanet(planetId)
      if (!planet || !planet.owner_id) {
        client.emit('error', { message: 'Planet not found or not owned' })
        return
      }
      const shipyardLevel = (db.getBuildings(planetId).shipyard || 0)
      if (shipyardLevel < 1) {
        client.emit('error', { message: 'Build Shipyard first' })
        return
      }
      if (db.getShipBuildQueue(planetId)) {
        client.emit('error', { message: 'Ship build queue busy' })
        return
      }
      const cost = SHIP_COST[shipType]
      if (!cost || planet.metal < cost.metal || planet.crystal < cost.crystal || planet.deuterium < cost.deuterium) {
        client.emit('error', { message: 'Not enough resources' })
        return
      }
      const durationSec = getShipBuildDuration(shipType, shipyardLevel)
      const startedAt = Date.now()
      db.deductResources(planetId, cost.metal, cost.crystal, cost.deuterium)
      db.startShipBuild(planetId, shipType, startedAt, durationSec)
      client.emit('shipBuildStarted', { planetId, shipType, finishesAt: startedAt + durationSec * 1000 })
    })

    client.on('buildDefense', (data) => {
      const planetId = data && data.planetId
      const defenseType = data && data.defenseType
      if (!planetId || !defenseType || !DEFENSE_TYPES.includes(defenseType)) {
        client.emit('error', { message: 'planetId and valid defenseType required' })
        return
      }
      const planet = db.getPlanet(planetId)
      if (!planet || !planet.owner_id) {
        client.emit('error', { message: 'Planet not found or not owned' })
        return
      }
      const shipyardLevel = (db.getBuildings(planetId).shipyard || 0)
      if (shipyardLevel < 1) {
        client.emit('error', { message: 'Build Shipyard first' })
        return
      }
      if (db.getDefenseBuildQueue(planetId)) {
        client.emit('error', { message: 'Defense build queue busy' })
        return
      }
      const cost = DEFENSE_COST[defenseType]
      if (!cost || planet.metal < cost.metal || planet.crystal < cost.crystal || planet.deuterium < cost.deuterium) {
        client.emit('error', { message: 'Not enough resources' })
        return
      }
      const durationSec = getDefenseBuildDuration(defenseType, shipyardLevel)
      const startedAt = Date.now()
      db.deductResources(planetId, cost.metal, cost.crystal, cost.deuterium)
      db.startDefenseBuild(planetId, defenseType, startedAt, durationSec)
      client.emit('defenseBuildStarted', { planetId, defenseType, finishesAt: startedAt + durationSec * 1000 })
    })

    client.on('sendFleet', (data) => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const fromPlanetId = data && data.fromPlanetId
      const toPlanetId = data && data.toPlanetId
      const missionType = (data && data.missionType) || 'transport'
      const ships = data && data.ships
      if (!fromPlanetId || !toPlanetId || !ships || typeof ships !== 'object') {
        client.emit('error', { message: 'fromPlanetId, toPlanetId and ships required' })
        return
      }
      const fromPlanet = db.getPlanet(fromPlanetId)
      const toPlanet = db.getPlanet(toPlanetId)
      if (!fromPlanet || fromPlanet.owner_id !== playerId) {
        client.emit('error', { message: 'Source planet not yours' })
        return
      }
      if (!toPlanet) {
        client.emit('error', { message: 'Target planet not found' })
        return
      }
      const currentShips = db.getShips(fromPlanetId)
      for (const [type, count] of Object.entries(ships)) {
        if (count > 0 && ((currentShips[type] || 0) < count)) {
          client.emit('error', { message: 'Not enough ships' })
          return
        }
      }
      if (missionType === 'colonize') {
        if (toPlanet.owner_id) {
          client.emit('error', { message: 'Target already occupied' })
          return
        }
        if (!(ships.colony_ship >= 1)) {
          client.emit('error', { message: 'Need at least 1 Colony Ship' })
          return
        }
      }
      if (missionType === 'attack') {
        if (!toPlanet.owner_id || toPlanet.owner_id === playerId) {
          client.emit('error', { message: 'Target must be an enemy planet' })
          return
        }
      }
      if (missionType === 'recycle') {
        if (!(ships.recycler >= 1)) {
          client.emit('error', { message: 'Need at least 1 Recycler' })
          return
        }
        const debris = db.getDebris(toPlanetId)
        if ((debris.metal || 0) + (debris.crystal || 0) <= 0) {
          client.emit('error', { message: 'No debris at target' })
          return
        }
      }
      if (missionType === 'espionage') {
        if (!(ships.espionage_probe >= 1)) {
          client.emit('error', { message: 'Need at least 1 Espionage Probe' })
          return
        }
      }
      if (missionType === 'transport') {
        const sc = (ships.small_cargo || 0)
        const lc = (ships.large_cargo || 0)
        if (sc + lc < 1) {
          client.emit('error', { message: 'Need at least 1 cargo ship' })
          return
        }
        const payload = (data && data.payload) || {}
        const metal = Math.max(0, Math.floor(Number(payload.metal) || 0))
        const crystal = Math.max(0, Math.floor(Number(payload.crystal) || 0))
        const deuterium = Math.max(0, Math.floor(Number(payload.deuterium) || 0))
        if (metal + crystal + deuterium <= 0) {
          client.emit('error', { message: 'Transport must carry at least 1 resource' })
          return
        }
        const capacity = (CARGO_CAPACITY.small_cargo || 0) * sc + (CARGO_CAPACITY.large_cargo || 0) * lc
        if (metal + crystal + deuterium > capacity) {
          client.emit('error', { message: 'Payload exceeds cargo capacity' })
          return
        }
        if (fromPlanet.metal < metal || fromPlanet.crystal < crystal || fromPlanet.deuterium < deuterium) {
          client.emit('error', { message: 'Not enough resources on source planet' })
          return
        }
        db.deductResources(fromPlanetId, metal, crystal, deuterium)
      }
      const durationSec = getFlightDuration(fromPlanet, toPlanet, ships)
      const now = Date.now()
      const arrivalAt = now + durationSec * 1000
      let payloadJson = null
      if (missionType === 'transport' && data && data.payload) {
        const p = data.payload
        payloadJson = JSON.stringify({
          metal: Math.max(0, Math.floor(Number(p.metal) || 0)),
          crystal: Math.max(0, Math.floor(Number(p.crystal) || 0)),
          deuterium: Math.max(0, Math.floor(Number(p.deuterium) || 0))
        })
      }
      db.removeShipsFromPlanet(fromPlanetId, ships)
      db.createFleetMission(playerId, fromPlanetId, toPlanetId, missionType, JSON.stringify(ships), now, arrivalAt, null, payloadJson)
      client.emit('fleetSent', { fromPlanetId, toPlanetId, missionType, arrivalAt })
    })

    client.on('createAlliance', (data) => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const name = (data && data.name) && String(data.name).trim().slice(0, ALLIANCE_NAME_MAX)
      const tag = (data && data.tag) && String(data.tag).trim().toUpperCase().slice(0, ALLIANCE_TAG_MAX)
      if (!name || !tag) {
        client.emit('error', { message: 'Alliance name and tag required' })
        return
      }
      if (db.getPlayerAlliance(playerId)) {
        client.emit('error', { message: 'Already in an alliance' })
        return
      }
      if (db.getAllianceByTag(tag)) {
        client.emit('error', { message: 'Tag already taken' })
        return
      }
      const id = db.createAlliance(name, tag, playerId)
      const alliance = db.getAllianceById(id)
      client.join(`alliance:${alliance.id}`)
      client.emit('allianceCreated', { alliance: { id: alliance.id, name: alliance.name, tag: alliance.tag } })
    })

    client.on('joinAlliance', (data) => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const tag = (data && data.tag) && String(data.tag).trim().toUpperCase().slice(0, ALLIANCE_TAG_MAX)
      if (!tag) {
        client.emit('error', { message: 'Alliance tag required' })
        return
      }
      if (db.getPlayerAlliance(playerId)) {
        client.emit('error', { message: 'Already in an alliance' })
        return
      }
      const alliance = db.getAllianceByTag(tag)
      if (!alliance) {
        client.emit('error', { message: 'Alliance not found' })
        return
      }
      db.joinAlliance(playerId, alliance.id)
      client.join(`alliance:${alliance.id}`)
      client.emit('allianceJoined', { alliance: { id: alliance.id, name: alliance.name, tag: alliance.tag } })
    })

    client.on('leaveAlliance', () => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const alliance = db.getPlayerAlliance(playerId)
      if (!alliance) {
        client.emit('error', { message: 'Not in an alliance' })
        return
      }
      db.leaveAlliance(playerId)
      client.leave(`alliance:${alliance.id}`)
      client.emit('allianceLeft', {})
    })

    client.on('getMyAlliance', () => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const alliance = db.getPlayerAlliance(playerId)
      if (!alliance) {
        client.emit('myAlliance', { alliance: null, members: [] })
        return
      }
      const members = db.getAllianceMembers(alliance.id)
      client.emit('myAlliance', { alliance: { id: alliance.id, name: alliance.name, tag: alliance.tag }, members })
    })

    client.on('getAllianceChat', (data) => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const alliance = db.getPlayerAlliance(playerId)
      if (!alliance) {
        client.emit('error', { message: 'Not in an alliance' })
        return
      }
      const limit = Math.min(100, Math.max(10, parseInt(data && data.limit, 10) || 50))
      const messages = db.getAllianceChat(alliance.id, limit)
      client.emit('allianceChat', { messages })
    })

    client.on('sendAllianceChat', (data) => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const alliance = db.getPlayerAlliance(playerId)
      if (!alliance) {
        client.emit('error', { message: 'Not in an alliance' })
        return
      }
      const message = (data && data.message) && String(data.message).trim().slice(0, ALLIANCE_CHAT_MAX)
      if (!message) {
        client.emit('error', { message: 'Message required' })
        return
      }
      db.addAllianceChatMessage(alliance.id, playerId, message)
      const nickname = db.getDb().prepare('SELECT nickname FROM players WHERE id = ?').get(playerId).nickname
      const msg = { playerId, nickname, message, createdAt: Date.now() }
      empireNs.to(`alliance:${alliance.id}`).emit('allianceChatMessage', msg)
      client.emit('allianceChatSent', {})
    })

    client.on('getReports', () => {
      const playerId = client.empirePlayerId
      if (!playerId) {
        client.emit('error', { message: 'Identify first' })
        return
      }
      const reports = db.getReportsForPlayer(playerId)
      client.emit('reports', { reports })
    })
  })
}

module.exports = { attachEmpireNamespace }
