# Empire – Phase 1 implementation spec

Phase 1 scope: **one planet per player, production, build queue, persistence.** No fleet, no research, no combat. Goal: log in → see resources ticking up → build a mine → see it complete.

Constants from [OGAME-GLOBAL-UNIVERSE-PLAN.md](./OGAME-GLOBAL-UNIVERSE-PLAN.md): 1 galaxy × 50 systems × 9 slots; SQLite; 5s tick; nickname = identity; starting zone systems 1–10; start resources M500 C300 D100; buildings M1 C0 D0 Solar1.

---

## 1. Database schema (SQLite)

### 1.1 Tables

```sql
-- Players: one row per nickname (identity = nickname).
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE,
  home_planet_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,  -- unix ms
  last_seen INTEGER,            -- unix ms
  FOREIGN KEY (home_planet_id) REFERENCES planets(id)
);

-- Planets: one row per slot. 450 rows (1 galaxy × 50 systems × 9 slots).
-- owner_id NULL = empty slot.
CREATE TABLE planets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  galaxy INTEGER NOT NULL CHECK (galaxy = 1),
  system INTEGER NOT NULL CHECK (system >= 1 AND system <= 50),
  slot INTEGER NOT NULL CHECK (slot >= 1 AND slot <= 9),
  owner_id INTEGER,
  name TEXT,
  metal REAL NOT NULL DEFAULT 0,
  crystal REAL NOT NULL DEFAULT 0,
  deuterium REAL NOT NULL DEFAULT 0,
  last_tick_at INTEGER NOT NULL,  -- unix ms; used for production catch-up
  created_at INTEGER,
  FOREIGN KEY (owner_id) REFERENCES players(id),
  UNIQUE(galaxy, system, slot)
);

CREATE INDEX idx_planets_owner ON planets(owner_id);
CREATE INDEX idx_planets_coords ON planets(galaxy, system, slot);

-- Building levels per planet. One row per (planet, type).
CREATE TABLE buildings (
  planet_id INTEGER NOT NULL,
  building_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
  PRIMARY KEY (planet_id, building_type),
  FOREIGN KEY (planet_id) REFERENCES planets(id)
);

-- Build queue: at most one active build per planet (Phase 1).
CREATE TABLE build_queue (
  planet_id INTEGER NOT NULL PRIMARY KEY,
  building_type TEXT NOT NULL,
  target_level INTEGER NOT NULL,
  started_at INTEGER NOT NULL,  -- unix ms
  duration_sec INTEGER NOT NULL,
  FOREIGN KEY (planet_id) REFERENCES planets(id)
);
```

### 1.2 Building types (Phase 1)

| building_type           | Description          |
|-------------------------|----------------------|
| metal_mine              | Metal production     |
| crystal_mine            | Crystal production   |
| deuterium_synthesizer   | Deuterium production |
| solar_plant             | Energy (caps mine output) |

### 1.3 Initial data

- **Universe bootstrap:** On first run, if no planets exist, insert 450 rows: `galaxy=1`, `system=1..50`, `slot=1..9`, `owner_id=NULL`, `metal=0`, `crystal=0`, `deuterium=0`, `last_tick_at=now`, `name=NULL`, `created_at=NULL` (or omit for empty slots). No buildings rows for empty slots.
- **New player:** Pick a random slot in systems 1–10 (galaxy=1, system IN (1..10), owner_id IS NULL). Update that planet: set `owner_id`, `name` (e.g. "Home"), `metal=500`, `crystal=300`, `deuterium=100`, `last_tick_at=now`, `created_at=now`. Insert into `buildings` for that planet: metal_mine=1, crystal_mine=0, deuterium_synthesizer=0, solar_plant=1. Insert into `players`: nickname, home_planet_id, created_at, last_seen.

---

## 2. Production formulas (simplified OGame-like)

All formulas use **level** of the mine/solar. Time is in **seconds** (then convert to per-tick or per-hour as needed).

- **Energy:** `solar_plant_level * 20` (e.g. level 1 = 20 energy). No fusion in Phase 1.
- **Metal:** `30 * level * 1.1^level` (base 30, exponential). Capped by energy: effective = min(production, energy). (OGame uses energy to cap sum of metal+crystal+deuterium consumption; we can cap each by energy/3 or use a simple total energy cap for all mines.)
- **Crystal:** `20 * level * 1.1^level`. Same energy cap idea.
- **Deuterium:** `10 * level * 1.1^level * (0.9 - 0.01*slot)` (slot 1–9: slot 1 = hottest, more deut). Same energy cap.

Simplified energy cap for Phase 1: **total energy** from solar; **consumption**: metal_mine 10/level?, crystal 10/level?, deuterium 10/level? (or use OGame constants). If consumption > energy, scale down production proportionally.

**Pragmatic v1:**  
- Production per second (so we can multiply by `elapsed_sec`):  
  - Metal: `30 * L * 1.1^L` per hour → per second divide by 3600.  
  - Crystal: `20 * L * 1.1^L` / 3600.  
  - Deuterium: `10 * L * 1.1^L * (0.9 - 0.01*slot)` / 3600.  
- Energy: solar only, `20 * solar_level`.  
- Consumption: e.g. metal 10*L, crystal 10*L, deuterium 20*L (OGame-like). If total consumption > energy, multiply each production by `energy / total_consumption`.

**Output:** For each planet, given `last_tick_at` and `now`, compute `elapsed_sec`, then delta metal/crystal/deuterium; add to planet; set `last_tick_at = now`.

---

## 3. Build time formula

Duration in seconds. OGame-style: `base_time * 1.5^level` (or similar). For Phase 1 we only need “next level” duration.

Example (one formula per building type):

- Metal mine level L → L+1: `base_metal * 1.5^L` (e.g. base_metal = 30).
- Crystal: base_crystal = 40.
- Deuterium: base_deut = 60.
- Solar: base_solar = 20.

Robot factory / nanite can reduce time later; Phase 1 ignore. So:

`duration_sec = round(base[building_type] * 1.5^current_level)`.

Store `started_at` and `duration_sec` in `build_queue`. On tick: if `now >= started_at + duration_sec`, increment building level, delete build_queue row (and optionally start next from a queue; Phase 1 = one at a time so we’re done).

---

## 4. Tick pseudocode (every 5 seconds)

```
function runTick():
  now = currentTimeMs()

  -- 1) Production: for each planet with owner_id NOT NULL
  for each planet where owner_id IS NOT NULL:
    elapsed_sec = (now - planet.last_tick_at) / 1000
    if elapsed_sec <= 0: continue
    (energy, metal_prod, crystal_prod, deut_prod) = computeProduction(planet, buildings)
    planet.metal += metal_prod * elapsed_sec
    planet.crystal += crystal_prod * elapsed_sec
    planet.deuterium += deut_prod * elapsed_sec
    planet.last_tick_at = now
    UPDATE planets SET metal, crystal, deuterium, last_tick_at WHERE id = planet.id

  -- 2) Build queue: complete finished builds
  for each row in build_queue:
    if now >= row.started_at + row.duration_sec * 1000:
      increment buildings.level for (planet_id, building_type)
      DELETE from build_queue WHERE planet_id = row.planet_id
      (optional: notify connected client for that planet)
```

Helper `computeProduction(planet, buildings)`:
- Read levels for metal_mine, crystal_mine, deuterium_synthesizer, solar_plant.
- Energy = 20 * solar_plant_level.
- Per-resource production (per second) and consumption; cap by energy; return rates (per second) so caller can multiply by elapsed_sec.

---

## 5. Socket.IO namespace and events

Namespace: **`/empire`**.

### 5.1 Client → Server

| Event           | Payload              | Description |
|-----------------|----------------------|-------------|
| `identify`      | `{ nickname: string }` | First event after connect. If nickname new → create player + home planet (systems 1–10). If exists → update last_seen. Server responds with `identified` or `error`. |
| `getPlanet`     | `{ planetId: number }` or omit (use home) | Return full planet + buildings + build_queue for that planet. Require: player must own planet or we only allow home for Phase 1. |
| `startBuild`    | `{ planetId, buildingType }` | Enqueue build for next level. Check: planet owned by player; building type valid; no current build on that planet; resources and prerequisites (e.g. shipyard for ships later). Respond `buildStarted` or `error`. |
| `getGalaxy`     | `{ galaxy, system }`  | Return list of slots (planet id, slot, owner nickname or "empty", name). For Phase 1: galaxy=1, system 1–50. So client can show galaxy view. |

### 5.2 Server → Client

| Event           | Payload              | When |
|-----------------|----------------------|------|
| `identified`    | `{ playerId, nickname, homePlanetId }` | After successful `identify`. |
| `error`         | `{ message: string }`| Validation or server error. |
| `planetData`    | `{ planet, buildings, buildQueue, resources }` | Response to `getPlanet`. |
| `buildStarted`  | `{ planetId, buildingType, targetLevel, finishesAt }` | After `startBuild` accepted. |
| `galaxyData`    | `{ galaxy, system, slots: [{ planetId, slot, ownerName, name }] }` | Response to `getGalaxy`. |

### 5.3 Flow

1. Client connects to `/empire`, sends `identify` with nickname from hub (e.g. from sessionStorage).
2. Server creates or loads player, updates last_seen; replies `identified` with homePlanetId.
3. Client sends `getPlanet` (no payload or { planetId: homePlanetId }) → gets resources, building levels, current build queue.
4. Client can send `startBuild` for that planet; server checks resources, inserts build_queue, replies `buildStarted` with finishesAt.
5. Client can send `getGalaxy` with galaxy=1, system=1..50 to render galaxy view.
6. (Optional) Every 5s or on tick, server can emit `planetUpdate` to connected clients who have that planet in view, so resources and build completion update in real time without polling.

---

## 6. File layout (suggested)

```
backend/
  empire/
    index.js        -- attachEmpireNamespace(io), DB init, tick loop
    db.js           -- SQLite connection, run migrations / bootstrap universe
    constants.js    -- GALAXIES=1, SYSTEMS=50, SLOTS=9, START_SYSTEMS=10, TICK_MS=5000, start resources, building bases
    production.js   -- computeProduction(planet, buildings), build time formula
    tick.js         -- runTick() using db + production
  server.js         -- add: const { attachEmpireNamespace } = require('./empire'); attachEmpireNamespace(io);
frontend/
  empire/
    index.html
    empire.js       -- connect to /empire, identify, getPlanet, startBuild, getGalaxy, render UI
```

---

## 7. Phase 1 checklist

- [ ] SQLite schema (players, planets, buildings, build_queue) and indexes.
- [ ] Bootstrap: insert 450 empty planet slots if DB empty.
- [ ] New player: pick random empty slot in systems 1–10; set resources and initial buildings; insert player.
- [ ] Production: computeProduction + apply in tick; update planet resources and last_tick_at.
- [ ] Build queue: on tick, complete finished builds; enforce one build per planet on startBuild.
- [ ] Socket: identify, getPlanet, startBuild, getGalaxy; responses as above.
- [ ] Tick loop: every 5s runTick() in Node.
- [ ] Frontend: connect, identify with nickname, show planet resources + buildings + build queue, button to start build, galaxy view (optional).
- [ ] Hub: add Empire card and link to `empire/`.

When this is done, Phase 2 can add: colonization, research, fleet, missions.
