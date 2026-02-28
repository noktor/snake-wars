# OGame-like game – Global universe (plan mode)

**Decision:** One **global persistent universe** — all players share the same galaxy; state lives in a DB; production and flights run even when nobody is online.

We’ll fill this doc together. Sections with **Open questions** or **Decisions** are for us to align on.

---

## 1. Universe shape & size

How big is the universe?

| Option | Galaxies | Systems per galaxy | Slots per system | Total slots |
|--------|----------|---------------------|------------------|-------------|
| Tiny   | 1        | 10                  | 5                | 50          |
| Small  | 1        | 50                  | 9                | 450         |
| Medium | 2–3      | 100                 | 15               | 2–4.5k      |
| OGame-style | 9  | 499                 | 15               | ~67k        |

- **Open question:** Which size do we want for v1? (Tiny/Small keeps DB and balance simple.)
- **Decision:** **Small** — 1 galaxy × 50 systems × 9 slots (450 total). Enough for many players and expansion; simple to balance and query.

---

## 2. Persistence & database

- **Need:** Store universe (planets, slots), players, resources, buildings, research, fleet, build queues, fleet missions.
- **Open question:** Which DB? Options: **SQLite** (file, no extra service), **PostgreSQL** (if you already use it / Railway), **Mongo** (if you prefer documents).
- **Decision:** **SQLite** for v1 (single file, no extra service, works on Railway with persistent volume). Can migrate to Postgres later if we need multi-instance or more concurrency.

Rough tables/collections:

- **players** – id, nickname, home_planet_id, created_at, last_seen, etc.
- **planets** – id, galaxy, system, slot, owner_id (nullable), name, metal, crystal, deuterium, energy_cap, created_at
- **buildings** – planet_id, building_type, level (e.g. metal_mine=5, solar_plant=3)
- **research** – player_id, tech_type, level
- **ships** – planet_id (or mission_id), ship_type, count
- **build_queue** – planet_id, building_type, target_level, started_at, duration_sec
- **research_queue** – player_id, tech_type, target_level, started_at, duration_sec
- **fleet_missions** – id, owner_id, from_planet_id, to_planet_id, mission_type (attack/transport/colonize/etc.), ships JSON, departure_at, arrival_at, return_at (optional)

- **Open question:** One “universe” row (e.g. universe_id, created_at, speed setting) or implicit single universe?
- **Decision:** **Single universe** for v1 — no universe_id; one DB = one universe. Optional `universe` table later for speed/name/settings.

---

## 3. Game tick & offline progress

Production and build/research completion must advance in **real time**, even when no one is online.

- **Option A – Tick loop in Node:** One process runs a loop (e.g. every 1–5 seconds): load relevant rows, compute production since last tick, apply build/research completions, update DB. Simple but needs the process to run 24/7 (e.g. Railway always-on).
- **Option B – Cron/scheduled job:** Every minute (or 5 min) run a script that “catches up” time: for each planet, compute production from `last_tick_at` to `now`, then update. Works on serverless/cron too.
- **Option C – On-demand catch-up:** No background tick; when a player connects, compute production from `last_tick_at` to `now` for their planets and save. Cheaper but “bursty” and can feel odd if someone returns after days.

- **Open question:** Which model do we want? (A is classic OGame; B is good for “run every N min”; C is simplest but least realistic.)
- **Decision:** **Option A** — tick loop in Node every **5 seconds**. Process runs 24/7 (e.g. Railway); each tick: apply production and build/research completion for all planets, resolve fleet arrivals.

Fleet missions: we need to resolve “arrival” at the right time. Same tick (or same cron run) can: find missions where `arrival_at <= now`, run combat/transport/colonize, create debris, update ships, mark mission complete.

- **Open question:** Store `last_tick_at` per planet, per player, or one global `universe_last_tick_at`?
- **Decision:** **Per planet** — each planet has `last_tick_at`; production is computed from that to `now`. Ensures correct catch-up after restarts. One global “last tick run” timestamp optional for idempotency.

---

## 4. Identity & registration

Today the hub uses only a **nickname** in sessionStorage (no account). For a global universe we need a stable identity so that:

- The same player always owns the same planets and research.
- We can show “last seen” and prevent simple nickname hijacking.

Options:

- **A – Nickname = identity (no registration):** First time someone visits with nickname “Alice”, we create a player and assign a home planet. Same nickname later = same player. Simple but no password; anyone who types “Alice” is Alice.
- **B – Simple registration:** In the Empire frontend: “Register” (nickname + password) and “Login”. Backend stores hashed password; session or JWT. Same as A but only the person who knows the password is “Alice”.
- **C – Reuse existing auth:** If Snake Wars ever gets Discord/Google/etc., Empire could use that.

- **Open question:** For v1, is “nickname = identity” (A) acceptable, or do we want minimal registration (B)?
- **Decision:** **A for v1** — nickname = identity (same as hub). First visit with nickname “X” creates player + home planet; same nickname later = same player. Add optional password/registration (B) when we need account security.

---

## 5. Starting the game (first-time player)

- New player needs a **home planet**.
- **Open question:** How do we assign it?
  - **Random empty slot** in the universe.
  - **Fixed starting zone** (e.g. systems 1–10), random empty slot there so newbies are together.
  - **Furthest from existing players** to spread out (more complex).
- **Decision:** **Starting zone** — random empty slot in **systems 1–10** (galaxy 1). New players cluster there; rest of galaxy for expansion.

- **Open question:** Starting resources / building levels? (e.g. metal 500, crystal 300, deuterium 100; metal mine 1, crystal 1, deuterium 0, solar 1.)
- **Decision:** **Classic-style start:** resources Metal 500, Crystal 300, Deuterium 100. Buildings: Metal Mine 1, Crystal Mine 0, Deuterium Synthesizer 0, Solar Plant 1. (Enough to build crystal mine and have energy.)

---

## 6. Core mechanics (recap + choices)

- **Resources:** Metal, Crystal, Deuterium. Production from mine levels; capped by energy (solar/fusion).
- **Buildings:** Metal mine, Crystal mine, Deuterium synthesizer, Solar plant, Robot factory?, Shipyard?, Storage?, Research lab?
- **Build queue:** One at a time per planet? Or queue of N? — **Decision:** **One building at a time per planet** (OGame-style).
- **Research:** One lab per player (on one planet)? One research queue per player. — **Decision:** **One lab** (on home planet for v1); **one research queue** per player.
- **Fleet:** Which ship types in v1? (e.g. Small Cargo, Large Cargo, Fighter, Cruiser.) Defenses? (e.g. Rocket Launcher, Laser.) — **Decision:** **Ships:** Small Cargo, Large Cargo, Fighter, Cruiser. **Defenses:** Rocket Launcher only for v1 (expand in Phase 3).

---

## 7. Phases (global universe version)

### Phase 1 – One planet, production, persistence

- DB schema + migrations (or initial SQL).
- One global universe (size from §1).
- Player creation by nickname (or registration if we chose B in §4).
- Home planet assignment (§5).
- Production tick (§3): every N seconds update resources for all planets.
- Build queue: one building per planet; completion on tick.
- API: “get my planet”, “get my resources”, “start building”, “get universe view” (galaxy list / planet list).
- Frontend: login/identify → planet view, resources, building list, build button.

**Goal:** Log in, see resources increasing over time, build a mine and see it complete.

### Phase 2 – Multiple planets, research, fleet

- Colonize: send a colony ship to an empty slot; new planet appears.
- Research: lab + research queue; a few techs (energy, weapons, shielding, propulsion).
- Fleet: build ships (cargo, fighter, cruiser); ships sit on planet.
- Fleet missions: send fleet to target (own or enemy); flight time; arrival resolved on tick (transport only first, then combat in Phase 3?).

**Goal:** Expand to 2–3 planets, research something, build and send a cargo fleet.

### Phase 3 – Combat, debris, espionage

- Combat on arrival (attack mission): rounds, rapid fire, debris.
- Recycler to collect debris.
- Espionage: spy report (resources, fleet, defenses) based on tech level.

**Goal:** Raid, defend, spy — full OGame loop.

### Phase 4 (optional) – Alliances, more content

- Alliances: create/join, alliance chat, maybe alliance wars.
- More ships, defenses, techs.

---

## 8. Tech stack (aligned with Snake Wars)

- **Backend:** Node.js, Socket.IO namespace `/empire` for real-time (fleet arrivals, messages, live resource updates if we want).
- **DB access:** From the same Node process (e.g. `better-sqlite3` or `pg`). No separate “game server” for v1.
- **REST vs Socket only:** We can do “get planet / start build” via Socket.IO (emit `getPlanet`, receive `planetData`). Or add a small REST API (e.g. Express) for “get universe”, “get planet” if we prefer. — **Decision:** **Socket only for v1** — all actions (identify, get planet, start build, get galaxy view, etc.) over the `/empire` namespace. Add REST later if we need serverless or public read-only endpoints.
- **Frontend:** Same as rest of Snake Wars (e.g. vanilla JS or your current stack), `frontend/empire/`, connect to backend URL, use nickname or login from hub/empire.

---

## 9. Open decisions summary

Copy this list and we’ll fill as we decide:

| # | Topic              | Decision |
|---|--------------------|----------|
| 1 | Universe size      | Small: 1×50×9 (450 slots) |
| 2 | Database           | SQLite; single universe |
| 3 | Tick model         | Option A; 5s; last_tick_at per planet |
| 4 | Identity (nick vs register) | Nickname = identity for v1 |
| 5 | Home planet assign | Systems 1–10, random empty slot |
| 6 | Starting resources | M500 C300 D100; M1 C0 D0 Solar1 |
| 7 | Build queue (1 vs N) | One per planet |
| 8 | Ships/defenses v1  | SC, LC, Fighter, Cruiser; RL only |
| 9 | REST vs Socket only | Socket only for v1 |

---

## 10. Next step

Once we’ve filled the open questions above, next step is **Phase 1 breakdown**: DB schema (exact columns), tick pseudocode, and Socket events (e.g. `registerOrLogin`, `getPlanet`, `startBuild`, `getUniverse`). We can do that in this doc or in a separate “Phase 1 spec” file.

**Status:** All sections 1–9 filled with v1 proposals. Phase 1 breakdown is in **[EMPIRE-PHASE1-SPEC.md](./EMPIRE-PHASE1-SPEC.md)** (DB schema, production/build formulas, tick pseudocode, socket events, file layout, checklist).
