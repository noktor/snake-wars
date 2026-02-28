'use strict'

const db = require('./db')
const { computeProduction } = require('./production')
const { runCombat } = require('./combat')
const { SHIP_SPEED, RECYCLER_CAPACITY } = require('./constants')

function getFlightDurationSec(fromPlanet, toPlanet, ships) {
  const distance = Math.abs(fromPlanet.system - toPlanet.system) * 1000 + Math.abs(fromPlanet.slot - toPlanet.slot) * 100
  let minSpeed = Infinity
  for (const [type, count] of Object.entries(ships)) {
    if (count > 0 && SHIP_SPEED[type]) minSpeed = Math.min(minSpeed, SHIP_SPEED[type])
  }
  if (minSpeed === Infinity) return 0
  return Math.max(1, Math.floor(distance / minSpeed))
}

function runTick() {
  const now = Date.now()
  const planets = db.getAllPlanetsWithOwner()

  for (const planet of planets) {
    const elapsedSec = (now - planet.last_tick_at) / 1000
    if (elapsedSec <= 0) continue

    const buildings = db.getBuildings(planet.id)
    const { metalPerSec, crystalPerSec, deuteriumPerSec } = computeProduction(planet, buildings)

    const newMetal = Math.max(0, planet.metal + metalPerSec * elapsedSec)
    const newCrystal = Math.max(0, planet.crystal + crystalPerSec * elapsedSec)
    const newDeuterium = Math.max(0, planet.deuterium + deuteriumPerSec * elapsedSec)

    db.updatePlanetResources(planet.id, newMetal, newCrystal, newDeuterium, now)
  }

  const queue = db.getBuildQueueAll()
  for (const row of queue) {
    const finishAt = row.started_at + row.duration_sec * 1000
    if (now >= finishAt) {
      db.completeBuild(row.planet_id)
    }
  }

  const researchQueue = db.getResearchQueueAll()
  for (const row of researchQueue) {
    const finishAt = row.started_at + row.duration_sec * 1000
    if (now >= finishAt) {
      db.completeResearch(row.player_id)
    }
  }

  const shipQueue = db.getShipBuildQueueAll()
  for (const row of shipQueue) {
    const finishAt = row.started_at + row.duration_sec * 1000
    if (now >= finishAt) {
      db.completeShipBuild(row.planet_id)
    }
  }

  const defenseQueue = db.getDefenseBuildQueueAll()
  for (const row of defenseQueue) {
    const finishAt = row.started_at + row.duration_sec * 1000
    if (now >= finishAt) {
      db.completeDefenseBuild(row.planet_id)
    }
  }

  const arrivals = db.getFleetMissionsArrivingBy(now)
  for (const m of arrivals) {
    const ships = JSON.parse(m.ships || '{}')
    const fromPlanet = db.getPlanet(m.from_planet_id)
    const toPlanet = db.getPlanet(m.to_planet_id)

    if (m.mission_type === 'colonize') {
      if (toPlanet && !toPlanet.owner_id) {
        db.colonizePlanet(m.to_planet_id, m.owner_id, now)
      }
      db.deleteFleetMission(m.id)
      continue
    }

    if (m.mission_type === 'attack') {
      if (!toPlanet || !toPlanet.owner_id) {
        db.deleteFleetMission(m.id)
        continue
      }
      const defenderShips = db.getShips(m.to_planet_id)
      const defenderDefenses = db.getDefenses(m.to_planet_id)
      const attackerResearch = db.getResearch(m.owner_id)
      const defenderResearch = db.getResearch(toPlanet.owner_id)
      const result = runCombat(
        ships,
        defenderShips,
        defenderDefenses,
        attackerResearch.weapons || 0,
        attackerResearch.shielding || 0,
        defenderResearch.weapons || 0,
        defenderResearch.shielding || 0
      )
      db.applyDefenseLosses(m.to_planet_id, result.defenderDefenseLosses)
      db.removeShipsFromPlanet(m.to_planet_id, result.defenderShipLosses)
      if (result.debris.metal > 0 || result.debris.crystal > 0) {
        db.addDebris(m.to_planet_id, result.debris.metal, result.debris.crystal)
      }
      const remaining = { ...ships }
      for (const [type, loss] of Object.entries(result.attackerLosses)) {
        remaining[type] = (remaining[type] || 0) - loss
        if (remaining[type] <= 0) delete remaining[type]
      }
      const hasRemaining = Object.values(remaining).some(c => c > 0)
      if (hasRemaining) {
        const returnSec = getFlightDurationSec(toPlanet, fromPlanet, remaining)
        db.updateFleetMissionShipsAndReturn(m.id, JSON.stringify(remaining), now + returnSec * 1000)
      } else {
        db.deleteFleetMission(m.id)
      }
      continue
    }

    if (m.mission_type === 'recycle') {
      const debris = db.getDebris(m.to_planet_id)
      const recyclerCount = ships.recycler || 0
      const capacity = recyclerCount * RECYCLER_CAPACITY
      const halfCap = Math.floor(capacity / 2)
      const taken = db.takeDebris(m.to_planet_id, halfCap, halfCap)
      const planet = db.getPlanet(m.from_planet_id)
      if (planet) {
        db.updatePlanetResources(m.from_planet_id, planet.metal + taken.metal, planet.crystal + taken.crystal, planet.deuterium, planet.last_tick_at)
      }
      const returnSec = getFlightDurationSec(toPlanet, fromPlanet, ships)
      db.updateFleetMissionShipsAndReturn(m.id, m.ships, now + returnSec * 1000)
      continue
    }

    if (m.mission_type === 'espionage') {
      const defenderResearch = toPlanet && toPlanet.owner_id ? db.getResearch(toPlanet.owner_id) : {}
      const reportData = {
        resources: toPlanet ? { metal: toPlanet.metal, crystal: toPlanet.crystal, deuterium: toPlanet.deuterium } : {},
        ships: toPlanet ? db.getShips(m.to_planet_id) : {},
        defenses: toPlanet ? db.getDefenses(m.to_planet_id) : {},
        buildings: toPlanet ? db.getBuildings(m.to_planet_id) : {},
        research: defenderResearch
      }
      db.createReport(m.owner_id, m.to_planet_id, toPlanet ? [toPlanet.galaxy, toPlanet.system, toPlanet.slot].join(':') : '', reportData)
      const returnSec = getFlightDurationSec(toPlanet, fromPlanet, ships)
      db.updateFleetMissionShipsAndReturn(m.id, m.ships, now + returnSec * 1000)
      continue
    }

    if (m.mission_type === 'transport') {
      if (m.payload) {
        try {
          const payload = JSON.parse(m.payload)
          const metal = Math.max(0, Number(payload.metal) || 0)
          const crystal = Math.max(0, Number(payload.crystal) || 0)
          const deuterium = Math.max(0, Number(payload.deuterium) || 0)
          if (toPlanet && (metal > 0 || crystal > 0 || deuterium > 0)) {
            db.addResourcesToPlanet(m.to_planet_id, metal, crystal, deuterium)
          }
        } catch (_) {}
      }
      const returnSec = getFlightDurationSec(toPlanet, fromPlanet, ships)
      db.updateFleetMissionShipsAndReturn(m.id, m.ships, now + returnSec * 1000)
      continue
    }

    db.deleteFleetMission(m.id)
  }

  const returns = db.getFleetMissionsReturningBy(now)
  for (const m of returns) {
    const ships = JSON.parse(m.ships || '{}')
    db.addShipsToPlanet(m.from_planet_id, ships)
    db.deleteFleetMission(m.id)
  }
}

module.exports = { runTick }
