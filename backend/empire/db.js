'use strict'

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const {
  GALAXIES,
  SYSTEMS,
  SLOTS,
  START_SYSTEM_MIN,
  START_SYSTEM_MAX,
  START_RESOURCES,
  START_BUILDINGS,
  BUILDING_TYPES,
  RESEARCH_TYPES,
  COLONY_START_RESOURCES,
  COLONY_START_BUILDINGS,
  DEFENSE_TYPES,
  ALLIANCE_CHAT_MAX,
  ALLIANCE_CHAT_MAX_MESSAGES
} = require('./constants')

const DB_PATH = process.env.EMPIRE_DB_PATH || path.join(__dirname, 'empire.db')
let db = null
let dbPathLogged = false

function ensureDbDirectory() {
  const dir = path.dirname(DB_PATH)
  if (dir && dir !== '.') {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }
  }
}

function getDb() {
  if (!db) {
    ensureDbDirectory()
    db = new Database(DB_PATH)
    db.pragma('foreign_keys = ON')
    ensureSchema()
    bootstrapUniverse()
    if (!dbPathLogged) {
      console.log('[Empire] Database path:', DB_PATH, '(set EMPIRE_DB_PATH for persistent storage)')
      dbPathLogged = true
    }
  }
  return db
}

function ensureSchema() {
  const d = getDb()
  d.exec(`
    CREATE TABLE IF NOT EXISTS planets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      galaxy INTEGER NOT NULL CHECK (galaxy = 1),
      system INTEGER NOT NULL CHECK (system >= 1 AND system <= 50),
      slot INTEGER NOT NULL CHECK (slot >= 1 AND slot <= 9),
      owner_id INTEGER,
      name TEXT,
      metal REAL NOT NULL DEFAULT 0,
      crystal REAL NOT NULL DEFAULT 0,
      deuterium REAL NOT NULL DEFAULT 0,
      last_tick_at INTEGER NOT NULL,
      created_at INTEGER,
      UNIQUE(galaxy, system, slot)
    );
    CREATE INDEX IF NOT EXISTS idx_planets_owner ON planets(owner_id);
    CREATE INDEX IF NOT EXISTS idx_planets_coords ON planets(galaxy, system, slot);

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL UNIQUE,
      home_planet_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen INTEGER,
      FOREIGN KEY (home_planet_id) REFERENCES planets(id)
    );

    CREATE TABLE IF NOT EXISTS buildings (
      planet_id INTEGER NOT NULL,
      building_type TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
      PRIMARY KEY (planet_id, building_type),
      FOREIGN KEY (planet_id) REFERENCES planets(id)
    );

    CREATE TABLE IF NOT EXISTS build_queue (
      planet_id INTEGER NOT NULL PRIMARY KEY,
      building_type TEXT NOT NULL,
      target_level INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL,
      FOREIGN KEY (planet_id) REFERENCES planets(id)
    );
    CREATE TABLE IF NOT EXISTS research (
      player_id INTEGER NOT NULL,
      tech_type TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (player_id, tech_type),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
    CREATE TABLE IF NOT EXISTS research_queue (
      player_id INTEGER NOT NULL PRIMARY KEY,
      tech_type TEXT NOT NULL,
      target_level INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
    CREATE TABLE IF NOT EXISTS ships (
      planet_id INTEGER NOT NULL,
      ship_type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (planet_id, ship_type),
      FOREIGN KEY (planet_id) REFERENCES planets(id)
    );
    CREATE TABLE IF NOT EXISTS ship_build_queue (
      planet_id INTEGER NOT NULL PRIMARY KEY,
      ship_type TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL,
      FOREIGN KEY (planet_id) REFERENCES planets(id)
    );
    CREATE TABLE IF NOT EXISTS fleet_missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      from_planet_id INTEGER NOT NULL,
      to_planet_id INTEGER NOT NULL,
      mission_type TEXT NOT NULL,
      ships TEXT NOT NULL,
      departure_at INTEGER NOT NULL,
      arrival_at INTEGER NOT NULL,
      return_at INTEGER,
      FOREIGN KEY (owner_id) REFERENCES players(id)
    );
    CREATE TABLE IF NOT EXISTS defenses (
      planet_id INTEGER NOT NULL,
      defense_type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (planet_id, defense_type),
      FOREIGN KEY (planet_id) REFERENCES planets(id)
    );
    CREATE TABLE IF NOT EXISTS defense_build_queue (
      planet_id INTEGER NOT NULL PRIMARY KEY,
      defense_type TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL,
      FOREIGN KEY (planet_id) REFERENCES planets(id)
    );
    CREATE TABLE IF NOT EXISTS debris (
      planet_id INTEGER NOT NULL PRIMARY KEY,
      metal REAL NOT NULL DEFAULT 0,
      crystal REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (planet_id) REFERENCES planets(id)
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      target_planet_id INTEGER NOT NULL,
      target_coords TEXT NOT NULL,
      report_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
    CREATE TABLE IF NOT EXISTS alliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tag TEXT NOT NULL UNIQUE,
      founder_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (founder_id) REFERENCES players(id)
    );
    CREATE TABLE IF NOT EXISTS alliance_members (
      alliance_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL UNIQUE,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (alliance_id, player_id),
      FOREIGN KEY (alliance_id) REFERENCES alliances(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
    CREATE TABLE IF NOT EXISTS alliance_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alliance_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (alliance_id) REFERENCES alliances(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
  `)
  const info = d.prepare("PRAGMA table_info(fleet_missions)").all()
  if (info && !info.find(c => c.name === 'payload')) {
    d.prepare('ALTER TABLE fleet_missions ADD COLUMN payload TEXT').run()
  }
}

function bootstrapUniverse() {
  const d = getDb()
  const count = d.prepare('SELECT COUNT(*) as n FROM planets').get()
  if (count.n > 0) return
  const now = Date.now()
  const insert = d.prepare(
    'INSERT INTO planets (galaxy, system, slot, owner_id, name, metal, crystal, deuterium, last_tick_at, created_at) VALUES (1, ?, ?, NULL, NULL, 0, 0, 0, ?, NULL)'
  )
  for (let sys = 1; sys <= SYSTEMS; sys++) {
    for (let slot = 1; slot <= SLOTS; slot++) {
      insert.run(sys, slot, now)
    }
  }
}

function getEmptySlotInStartZone() {
  const d = getDb()
  const rows = d.prepare(
    'SELECT id, system, slot FROM planets WHERE galaxy = 1 AND system >= ? AND system <= ? AND owner_id IS NULL ORDER BY RANDOM() LIMIT 1'
  ).all(START_SYSTEM_MIN, START_SYSTEM_MAX)
  return rows[0] || null
}

function createPlayer(nickname) {
  const d = getDb()
  const slot = getEmptySlotInStartZone()
  if (!slot) return null
  const now = Date.now()
  d.prepare('INSERT INTO players (nickname, home_planet_id, created_at, last_seen) VALUES (?, ?, ?, ?)').run(nickname, slot.id, now, now)
  const player = d.prepare('SELECT id, nickname, home_planet_id FROM players WHERE nickname = ?').get(nickname)
  d.prepare(
    'UPDATE planets SET owner_id = ?, name = ?, metal = ?, crystal = ?, deuterium = ?, last_tick_at = ?, created_at = ? WHERE id = ?'
  ).run(player.id, 'Home', START_RESOURCES.metal, START_RESOURCES.crystal, START_RESOURCES.deuterium, now, now, slot.id)
  for (const type of BUILDING_TYPES) {
    const level = START_BUILDINGS[type] || 0
    d.prepare('INSERT INTO buildings (planet_id, building_type, level) VALUES (?, ?, ?)').run(slot.id, type, level)
  }
  for (const tech of RESEARCH_TYPES) {
    d.prepare('INSERT INTO research (player_id, tech_type, level) VALUES (?, ?, 0)').run(player.id, tech)
  }
  return player
}

function getPlayerByNickname(nickname) {
  const d = getDb()
  return d.prepare('SELECT id, nickname, home_planet_id, created_at, last_seen FROM players WHERE nickname = ?').get(nickname)
}

function updateLastSeen(playerId) {
  const d = getDb()
  d.prepare('UPDATE players SET last_seen = ? WHERE id = ?').run(Date.now(), playerId)
}

function getPlanet(planetId) {
  const d = getDb()
  return d.prepare('SELECT * FROM planets WHERE id = ?').get(planetId)
}

function getBuildings(planetId) {
  const d = getDb()
  const rows = d.prepare('SELECT building_type, level FROM buildings WHERE planet_id = ?').all(planetId)
  const out = {}
  for (const r of rows) out[r.building_type] = r.level
  return out
}

function getBuildQueue(planetId) {
  const d = getDb()
  return d.prepare('SELECT * FROM build_queue WHERE planet_id = ?').get(planetId)
}

function getOwnedPlanets(playerId) {
  const d = getDb()
  return d.prepare('SELECT id FROM planets WHERE owner_id = ?').all(playerId)
}

function getOwnedPlanetsWithDetails(playerId) {
  const d = getDb()
  const homeId = d.prepare('SELECT home_planet_id FROM players WHERE id = ?').get(playerId)
  const homePlanetId = homeId ? homeId.home_planet_id : null
  const rows = d.prepare('SELECT id, name, galaxy, system, slot FROM planets WHERE owner_id = ? ORDER BY id').all(playerId)
  return rows.map(p => ({
    id: p.id,
    name: p.name || 'Planet',
    galaxy: p.galaxy,
    system: p.system,
    slot: p.slot,
    isHome: p.id === homePlanetId
  }))
}

function getGalaxySlots(galaxy, system) {
  const d = getDb()
  const planets = d.prepare(
    'SELECT p.id as planet_id, p.slot, p.owner_id, p.name FROM planets p WHERE p.galaxy = ? AND p.system = ? ORDER BY p.slot'
  ).all(galaxy, system)
  const out = []
  for (const p of planets) {
    let ownerName = 'empty'
    if (p.owner_id) {
      const pl = d.prepare('SELECT nickname FROM players WHERE id = ?').get(p.owner_id)
      ownerName = pl ? pl.nickname : '?'
    }
    const deb = d.prepare('SELECT metal, crystal FROM debris WHERE planet_id = ?').get(p.planet_id)
    out.push({
      planetId: p.planet_id,
      slot: p.slot,
      ownerName,
      name: p.name || '',
      debrisMetal: deb ? deb.metal : 0,
      debrisCrystal: deb ? deb.crystal : 0
    })
  }
  return out
}

function getAllPlanetsWithOwner() {
  const d = getDb()
  return d.prepare('SELECT id, galaxy, system, slot, owner_id, metal, crystal, deuterium, last_tick_at FROM planets WHERE owner_id IS NOT NULL').all()
}

function updatePlanetResources(planetId, metal, crystal, deuterium, lastTickAt) {
  const d = getDb()
  d.prepare('UPDATE planets SET metal = ?, crystal = ?, deuterium = ?, last_tick_at = ? WHERE id = ?').run(metal, crystal, deuterium, lastTickAt, planetId)
}

function addResourcesToPlanet(planetId, metal, crystal, deuterium) {
  const d = getDb()
  d.prepare('UPDATE planets SET metal = metal + ?, crystal = crystal + ?, deuterium = deuterium + ? WHERE id = ?').run(metal || 0, crystal || 0, deuterium || 0, planetId)
}

function completeBuild(planetId) {
  const d = getDb()
  const row = d.prepare('SELECT building_type, target_level FROM build_queue WHERE planet_id = ?').get(planetId)
  if (!row) return
  d.prepare('UPDATE buildings SET level = ? WHERE planet_id = ? AND building_type = ?').run(row.target_level, planetId, row.building_type)
  d.prepare('DELETE FROM build_queue WHERE planet_id = ?').run(planetId)
}

function getBuildQueueAll() {
  const d = getDb()
  return d.prepare('SELECT * FROM build_queue').all()
}

function startBuild(planetId, buildingType, targetLevel, startedAt, durationSec) {
  const d = getDb()
  d.prepare('INSERT INTO build_queue (planet_id, building_type, target_level, started_at, duration_sec) VALUES (?, ?, ?, ?, ?)').run(planetId, buildingType, targetLevel, startedAt, durationSec)
}

function deductResources(planetId, metal, crystal, deuterium) {
  const d = getDb()
  d.prepare('UPDATE planets SET metal = metal - ?, crystal = crystal - ?, deuterium = deuterium - ? WHERE id = ?').run(metal, crystal, deuterium, planetId)
}

function getResearch(playerId) {
  const d = getDb()
  const rows = d.prepare('SELECT tech_type, level FROM research WHERE player_id = ?').all(playerId)
  const out = {}
  for (const r of rows) out[r.tech_type] = r.level
  return out
}

function getResearchQueue(playerId) {
  const d = getDb()
  return d.prepare('SELECT * FROM research_queue WHERE player_id = ?').get(playerId)
}

function startResearch(playerId, techType, targetLevel, startedAt, durationSec) {
  const d = getDb()
  d.prepare('INSERT OR IGNORE INTO research (player_id, tech_type, level) VALUES (?, ?, 0)').run(playerId, techType)
  d.prepare('INSERT INTO research_queue (player_id, tech_type, target_level, started_at, duration_sec) VALUES (?, ?, ?, ?, ?)').run(playerId, techType, targetLevel, startedAt, durationSec)
}

function completeResearch(playerId) {
  const d = getDb()
  const row = d.prepare('SELECT tech_type, target_level FROM research_queue WHERE player_id = ?').get(playerId)
  if (!row) return
  d.prepare('UPDATE research SET level = ? WHERE player_id = ? AND tech_type = ?').run(row.target_level, playerId, row.tech_type)
  d.prepare('DELETE FROM research_queue WHERE player_id = ?').run(playerId)
}

function getResearchQueueAll() {
  const d = getDb()
  return d.prepare('SELECT * FROM research_queue').all()
}

function getShips(planetId) {
  const d = getDb()
  const rows = d.prepare('SELECT ship_type, count FROM ships WHERE planet_id = ?').all(planetId)
  const out = {}
  for (const r of rows) out[r.ship_type] = r.count
  return out
}

function getShipBuildQueue(planetId) {
  const d = getDb()
  return d.prepare('SELECT * FROM ship_build_queue WHERE planet_id = ?').get(planetId)
}

function getShipBuildQueueAll() {
  const d = getDb()
  return d.prepare('SELECT * FROM ship_build_queue').all()
}

function startShipBuild(planetId, shipType, startedAt, durationSec) {
  const d = getDb()
  d.prepare('INSERT INTO ship_build_queue (planet_id, ship_type, started_at, duration_sec) VALUES (?, ?, ?, ?)').run(planetId, shipType, startedAt, durationSec)
}

function completeShipBuild(planetId) {
  const d = getDb()
  const row = d.prepare('SELECT ship_type FROM ship_build_queue WHERE planet_id = ?').get(planetId)
  if (!row) return
  const existing = d.prepare('SELECT count FROM ships WHERE planet_id = ? AND ship_type = ?').get(planetId, row.ship_type)
  const count = (existing ? existing.count : 0) + 1
  if (existing) {
    d.prepare('UPDATE ships SET count = ? WHERE planet_id = ? AND ship_type = ?').run(count, planetId, row.ship_type)
  } else {
    d.prepare('INSERT INTO ships (planet_id, ship_type, count) VALUES (?, ?, ?)').run(planetId, row.ship_type, count)
  }
  d.prepare('DELETE FROM ship_build_queue WHERE planet_id = ?').run(planetId)
}

function createFleetMission(ownerId, fromPlanetId, toPlanetId, missionType, shipsJson, departureAt, arrivalAt, returnAt, payloadJson) {
  const d = getDb()
  const r = d.prepare('INSERT INTO fleet_missions (owner_id, from_planet_id, to_planet_id, mission_type, ships, departure_at, arrival_at, return_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(ownerId, fromPlanetId, toPlanetId, missionType, shipsJson, departureAt, arrivalAt, returnAt || null, payloadJson || null)
  return r.lastInsertRowid
}

function getFleetMissionsArrivingBy(now) {
  const d = getDb()
  return d.prepare('SELECT * FROM fleet_missions WHERE arrival_at <= ?').all(now)
}

function deleteFleetMission(id) {
  const d = getDb()
  d.prepare('DELETE FROM fleet_missions WHERE id = ?').run(id)
}

function removeShipsFromPlanet(planetId, shipsObj) {
  const d = getDb()
  for (const [shipType, count] of Object.entries(shipsObj)) {
    if (count <= 0) continue
    const row = d.prepare('SELECT count FROM ships WHERE planet_id = ? AND ship_type = ?').get(planetId, shipType)
    if (row && row.count >= count) {
      const newCount = row.count - count
      if (newCount === 0) d.prepare('DELETE FROM ships WHERE planet_id = ? AND ship_type = ?').run(planetId, shipType)
      else d.prepare('UPDATE ships SET count = ? WHERE planet_id = ? AND ship_type = ?').run(newCount, planetId, shipType)
    }
  }
}

function addShipsToPlanet(planetId, shipsObj) {
  const d = getDb()
  for (const [shipType, count] of Object.entries(shipsObj)) {
    if (count <= 0) continue
    const row = d.prepare('SELECT count FROM ships WHERE planet_id = ? AND ship_type = ?').get(planetId, shipType)
    const newCount = (row ? row.count : 0) + count
    if (row) d.prepare('UPDATE ships SET count = ? WHERE planet_id = ? AND ship_type = ?').run(newCount, planetId, shipType)
    else d.prepare('INSERT INTO ships (planet_id, ship_type, count) VALUES (?, ?, ?)').run(planetId, shipType, newCount)
  }
}

function colonizePlanet(planetId, ownerId, now) {
  const d = getDb()
  d.prepare(
    'UPDATE planets SET owner_id = ?, name = ?, metal = ?, crystal = ?, deuterium = ?, last_tick_at = ?, created_at = ? WHERE id = ?'
  ).run(ownerId, 'Colony', COLONY_START_RESOURCES.metal, COLONY_START_RESOURCES.crystal, COLONY_START_RESOURCES.deuterium, now, now, planetId)
  for (const type of BUILDING_TYPES) {
    d.prepare('INSERT INTO buildings (planet_id, building_type, level) VALUES (?, ?, ?)').run(planetId, type, COLONY_START_BUILDINGS[type] || 0)
  }
}

function getDefenses(planetId) {
  const d = getDb()
  const rows = d.prepare('SELECT defense_type, count FROM defenses WHERE planet_id = ?').all(planetId)
  const out = {}
  for (const r of rows) out[r.defense_type] = r.count
  return out
}

function getDefenseBuildQueue(planetId) {
  const d = getDb()
  return d.prepare('SELECT * FROM defense_build_queue WHERE planet_id = ?').get(planetId)
}

function getDefenseBuildQueueAll() {
  const d = getDb()
  return d.prepare('SELECT * FROM defense_build_queue').all()
}

function startDefenseBuild(planetId, defenseType, startedAt, durationSec) {
  const d = getDb()
  d.prepare('INSERT INTO defense_build_queue (planet_id, defense_type, started_at, duration_sec) VALUES (?, ?, ?, ?)').run(planetId, defenseType, startedAt, durationSec)
}

function completeDefenseBuild(planetId) {
  const d = getDb()
  const row = d.prepare('SELECT defense_type FROM defense_build_queue WHERE planet_id = ?').get(planetId)
  if (!row) return
  const existing = d.prepare('SELECT count FROM defenses WHERE planet_id = ? AND defense_type = ?').get(planetId, row.defense_type)
  const count = (existing ? existing.count : 0) + 1
  if (existing) {
    d.prepare('UPDATE defenses SET count = ? WHERE planet_id = ? AND defense_type = ?').run(count, planetId, row.defense_type)
  } else {
    d.prepare('INSERT INTO defenses (planet_id, defense_type, count) VALUES (?, ?, ?)').run(planetId, row.defense_type, count)
  }
  d.prepare('DELETE FROM defense_build_queue WHERE planet_id = ?').run(planetId)
}

function getDebris(planetId) {
  const d = getDb()
  const row = d.prepare('SELECT metal, crystal FROM debris WHERE planet_id = ?').get(planetId)
  return row ? { metal: row.metal, crystal: row.crystal } : { metal: 0, crystal: 0 }
}

function setDebris(planetId, metal, crystal) {
  const d = getDb()
  d.prepare('INSERT OR REPLACE INTO debris (planet_id, metal, crystal) VALUES (?, ?, ?)').run(planetId, metal, crystal)
}

function addDebris(planetId, metal, crystal) {
  const d = getDb()
  const row = d.prepare('SELECT metal, crystal FROM debris WHERE planet_id = ?').get(planetId)
  const m = (row ? row.metal : 0) + metal
  const c = (row ? row.crystal : 0) + crystal
  d.prepare('INSERT OR REPLACE INTO debris (planet_id, metal, crystal) VALUES (?, ?, ?)').run(planetId, m, c)
}

function takeDebris(planetId, maxMetal, maxCrystal) {
  const d = getDb()
  const row = d.prepare('SELECT metal, crystal FROM debris WHERE planet_id = ?').get(planetId)
  if (!row) return { metal: 0, crystal: 0 }
  const takeM = Math.min(row.metal, maxMetal)
  const takeC = Math.min(row.crystal, maxCrystal)
  const newM = row.metal - takeM
  const newC = row.crystal - takeC
  if (newM <= 0 && newC <= 0) d.prepare('DELETE FROM debris WHERE planet_id = ?').run(planetId)
  else d.prepare('UPDATE debris SET metal = ?, crystal = ? WHERE planet_id = ?').run(newM, newC, planetId)
  return { metal: takeM, crystal: takeC }
}

function applyDefenseLosses(planetId, lossesByType) {
  const d = getDb()
  for (const [defenseType, count] of Object.entries(lossesByType)) {
    if (count <= 0) continue
    const row = d.prepare('SELECT count FROM defenses WHERE planet_id = ? AND defense_type = ?').get(planetId, defenseType)
    if (row && row.count >= count) {
      const newCount = row.count - count
      if (newCount === 0) d.prepare('DELETE FROM defenses WHERE planet_id = ? AND defense_type = ?').run(planetId, defenseType)
      else d.prepare('UPDATE defenses SET count = ? WHERE planet_id = ? AND defense_type = ?').run(newCount, planetId, defenseType)
    }
  }
}

function createReport(playerId, targetPlanetId, targetCoords, reportData) {
  const d = getDb()
  const now = Date.now()
  d.prepare('INSERT INTO reports (player_id, target_planet_id, target_coords, report_data, created_at) VALUES (?, ?, ?, ?, ?)').run(playerId, targetPlanetId, targetCoords, JSON.stringify(reportData), now)
}

function getReportsForPlayer(playerId, limit) {
  const d = getDb()
  const rows = d.prepare('SELECT id, target_planet_id, target_coords, report_data, created_at FROM reports WHERE player_id = ? ORDER BY created_at DESC LIMIT ?').all(playerId, limit || 50)
  return rows.map(r => ({ id: r.id, targetPlanetId: r.target_planet_id, targetCoords: r.target_coords, reportData: JSON.parse(r.report_data || '{}'), createdAt: r.created_at }))
}

function getFleetMissionsReturningBy(now) {
  const d = getDb()
  return d.prepare('SELECT * FROM fleet_missions WHERE return_at IS NOT NULL AND return_at <= ?').all(now)
}

function updateFleetMissionReturnAt(id, returnAt) {
  const d = getDb()
  d.prepare('UPDATE fleet_missions SET return_at = ? WHERE id = ?').run(returnAt, id)
}

function updateFleetMissionShipsAndReturn(id, shipsJson, returnAt) {
  const d = getDb()
  d.prepare('UPDATE fleet_missions SET ships = ?, return_at = ? WHERE id = ?').run(shipsJson, returnAt, id)
}

function getFleetMission(id) {
  const d = getDb()
  return d.prepare('SELECT * FROM fleet_missions WHERE id = ?').get(id)
}

function createAlliance(name, tag, founderId) {
  const d = getDb()
  const now = Date.now()
  d.prepare('INSERT INTO alliances (name, tag, founder_id, created_at) VALUES (?, ?, ?, ?)').run(name, tag, founderId, now)
  const row = d.prepare('SELECT id FROM alliances WHERE tag = ?').get(tag)
  if (row) d.prepare('INSERT INTO alliance_members (alliance_id, player_id, joined_at) VALUES (?, ?, ?)').run(row.id, founderId, now)
  return row ? row.id : null
}

function getAllianceByTag(tag) {
  const d = getDb()
  return d.prepare('SELECT * FROM alliances WHERE tag = ?').get(tag)
}

function getAllianceById(id) {
  const d = getDb()
  return d.prepare('SELECT * FROM alliances WHERE id = ?').get(id)
}

function getPlayerAlliance(playerId) {
  const d = getDb()
  const m = d.prepare('SELECT alliance_id FROM alliance_members WHERE player_id = ?').get(playerId)
  if (!m) return null
  return d.prepare('SELECT * FROM alliances WHERE id = ?').get(m.alliance_id)
}

function joinAlliance(playerId, allianceId) {
  const d = getDb()
  const now = Date.now()
  d.prepare('INSERT INTO alliance_members (alliance_id, player_id, joined_at) VALUES (?, ?, ?)').run(allianceId, playerId, now)
}

function leaveAlliance(playerId) {
  const d = getDb()
  d.prepare('DELETE FROM alliance_members WHERE player_id = ?').run(playerId)
}

function getAllianceMembers(allianceId) {
  const d = getDb()
  const rows = d.prepare('SELECT player_id, joined_at FROM alliance_members WHERE alliance_id = ? ORDER BY joined_at').all(allianceId)
  return rows.map(r => {
    const p = d.prepare('SELECT nickname FROM players WHERE id = ?').get(r.player_id)
    return { playerId: r.player_id, nickname: p ? p.nickname : '?', joinedAt: r.joined_at }
  })
}

function addAllianceChatMessage(allianceId, playerId, message) {
  const d = getDb()
  const now = Date.now()
  d.prepare('INSERT INTO alliance_chat (alliance_id, player_id, message, created_at) VALUES (?, ?, ?, ?)').run(allianceId, playerId, message, now)
  const count = d.prepare('SELECT COUNT(*) as n FROM alliance_chat WHERE alliance_id = ?').get(allianceId).n
  if (count > ALLIANCE_CHAT_MAX_MESSAGES) {
    const toDelete = d.prepare('SELECT id FROM alliance_chat WHERE alliance_id = ? ORDER BY created_at ASC LIMIT ?').all(allianceId, count - ALLIANCE_CHAT_MAX_MESSAGES)
    const del = d.prepare('DELETE FROM alliance_chat WHERE id = ?')
    toDelete.forEach(row => del.run(row.id))
  }
}

function getAllianceChat(allianceId, limit) {
  const d = getDb()
  const rows = d.prepare('SELECT id, player_id, message, created_at FROM alliance_chat WHERE alliance_id = ? ORDER BY created_at DESC LIMIT ?').all(allianceId, limit || 50)
  return rows.reverse().map(r => {
    const p = d.prepare('SELECT nickname FROM players WHERE id = ?').get(r.player_id)
    return { id: r.id, playerId: r.player_id, nickname: p ? p.nickname : '?', message: r.message, createdAt: r.created_at }
  })
}

module.exports = {
  getDb,
  getEmptySlotInStartZone,
  createPlayer,
  getPlayerByNickname,
  updateLastSeen,
  getPlanet,
  getBuildings,
  getBuildQueue,
  getOwnedPlanets,
  getOwnedPlanetsWithDetails,
  getGalaxySlots,
  getAllPlanetsWithOwner,
  updatePlanetResources,
  addResourcesToPlanet,
  completeBuild,
  getBuildQueueAll,
  startBuild,
  deductResources,
  getResearch,
  getResearchQueue,
  startResearch,
  completeResearch,
  getResearchQueueAll,
  getShips,
  getShipBuildQueue,
  getShipBuildQueueAll,
  startShipBuild,
  completeShipBuild,
  createFleetMission,
  getFleetMissionsArrivingBy,
  deleteFleetMission,
  removeShipsFromPlanet,
  addShipsToPlanet,
  colonizePlanet,
  getDefenses,
  getDefenseBuildQueue,
  getDefenseBuildQueueAll,
  startDefenseBuild,
  completeDefenseBuild,
  getDebris,
  setDebris,
  addDebris,
  takeDebris,
  applyDefenseLosses,
  createReport,
  getReportsForPlayer,
  getFleetMissionsReturningBy,
  updateFleetMissionReturnAt,
  updateFleetMissionShipsAndReturn,
  getFleetMission,
  createAlliance,
  getAllianceByTag,
  getAllianceById,
  getPlayerAlliance,
  joinAlliance,
  leaveAlliance,
  getAllianceMembers,
  addAllianceChatMessage,
  getAllianceChat
}
