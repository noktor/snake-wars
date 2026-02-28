# OGame-like game – Plan for Snake Wars

## Vision

A **browser-based space empire game** in the spirit of OGame: build planets, gather resources (metal, crystal, deuterium), research tech, build fleets, and fight or trade with other players. Fits as a **new game** in the Snake Wars hub (like Snake, Battle Royale, RTS).

---

## How it fits in Snake Wars

- **Hub**: New card, e.g. “Empire” or “Space Wars”, linking to `empire/` (or `ogame/`).
- **Frontend**: `frontend/empire/` — `index.html` + JS, same style as `rts/` or `snake/`.
- **Backend**: New Socket.IO namespace, e.g. `io.of('/empire')`, in something like `backend/empire/` with its own state and tick loop.
- **Auth**: Reuse hub nickname (e.g. from `sessionStorage`), no extra login.

---

## Core mechanics (simplified OGame)

| Area | OGame classic | Our target (MVP → later) |
|------|----------------|---------------------------|
| **Universe** | 9 galaxies × 499 systems × 15 slots | 1 galaxy, e.g. 10–50 systems, 3–5 slots per system |
| **Resources** | Metal, Crystal, Deuterium, Energy | Same three + energy (solar/fusion) |
| **Buildings** | Mines, solar, robot, shipyard, etc. | Mines (M/C/D), Solar, Shipyard, maybe Robot/Storage |
| **Research** | Many techs | Few: Energy, Weapons, Shielding, Propulsion, maybe Espionage |
| **Fleet** | Many ship types | Few: Small Cargo, Fighter, Cruiser, maybe Bomber/Deathstar-style |
| **Combat** | Rounds, rapid fire, debris | Simplified: one round or few rounds, debris → recyclers |
| **Time** | Real-time, production while offline | Same idea: production and flight times in real time (tick or cron) |

---

## Phases

### Phase 1 – Single player / sandbox (MVP)

- One “universe” per **room** (like RTS): create game → get code → optional second player.
- One **home planet** per player; production and build queues run in real time.
- **Resources**: metal, crystal, deuterium; production from mine levels and energy.
- **Buildings**: Metal Mine, Crystal Mine, Deuterium Synthesizer, Solar Plant, maybe Robot Factory, Shipyard, one storage type.
- **Build queue**: one building at a time; build times in seconds (or 1 tick = 1 second).
- **Backend**: Node + Socket.IO namespace; in-memory state; simple tick (e.g. every 1s) for production and build completion.
- **Frontend**: One main screen: planet view, resource bar, building list + “Build” and queue, simple fleet list. Optional: second planet (colonize) or second slot in same system.

Goal: **feel** like OGame (resources ticking up, building something, waiting for completion).

### Phase 2 – Multiplayer & fleet

- **Two players per room** (or more): each has home planet; can see each other’s planets in same “galaxy” (e.g. list of coordinates).
- **Fleet**: build ships (e.g. Small Cargo, Fighter, Cruiser); send fleet to target (own or enemy planet).
- **Flight time**: distance + ship speed; ETA shown; arrival processed on backend when time is due.
- **Combat**: on arrival, resolve combat (simplified formula); debris field; maybe recycler to collect.
- **Espionage** (optional): one spy tech level, report with resources/fleet/defenses.

Goal: **attack, defend, raid** like OGame.

### Phase 3 – Deeper OGame feel

- **Multiple planets** per player (colonize empty slot in a system).
- **Research**: lab building + research queue; techs unlock ships/buildings and improve combat.
- **More ships and defenses**: bombers, destroyers, defense (e.g. rocket launcher, laser, heavy laser, ion, plasma).
- **Alliances**: optional “alliance” tag per room or per universe.
- **Persistent universe** (optional): store state in DB (e.g. SQLite/Postgres), run tick or cron when players are offline so production and flights continue.

---

## Tech alignment with Snake Wars

- **Backend**: Node.js, Socket.IO (`io.of('/empire')`), in-memory state first; later add DB and optional REST for “universe status” if needed.
- **Frontend**: Vanilla JS (or match your existing stack), one HTML entry (`frontend/empire/index.html`), connect to same backend URL, use nickname from hub.
- **Deploy**: Same backend (add `attachEmpireNamespace(io)` in `server.js`), same frontend host; hub link to `empire/`.

---

## Data shape (sketch)

- **Universe**: `{ galaxies: [ { systems: [ { planets: [ { ownerId, buildings, ships, resources } ] } ] } ] }`
- **Player**: `{ id, nickName, homePlanetCoords, research, lastTickTime }`
- **Room**: one universe + list of player IDs; game code = room name (like RTS).

---

## Naming

- **URL/path**: `empire/` or `space/` or `ogame/` — “Empire” is short and clear.
- **Display name**: “Empire”, “Space Wars”, or “OGame-like” in the hub.

---

## Next steps

1. **Decide**: Room-based (like RTS) vs one global universe (needs DB and more design).
2. **Implement Phase 1**: backend namespace + tick + buildings + resources; frontend planet view + build queue.
3. **Add to hub**: new card + `goToGame('empire/')` and `attachEmpireNamespace(io)`.

If you want, next we can break Phase 1 into concrete tasks (files to add, socket events, and one or two key algorithms like production and build time).
