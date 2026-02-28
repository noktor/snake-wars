(function () {
  const NICKNAME_KEY = 'snake_wars_nickname'
  const backendUrl = window.SNAKE_WARS_BACKEND_URL || ''
  let socket = null
  let state = { playerId: null, nickname: null, homePlanetId: null, currentPlanetId: null, ownedPlanets: [], planet: null, buildings: {}, buildQueue: null, nextBuildCosts: {}, research: {}, researchQueue: null, ships: {}, shipBuildQueue: null, defenses: {}, defenseBuildQueue: null, debris: { metal: 0, crystal: 0 }, reports: [], pendingFleet: null, alliance: null, allianceMembers: [], allianceChat: [] }

  const loginScreen = document.getElementById('loginScreen')
  const gameScreen = document.getElementById('gameScreen')
  const nickInput = document.getElementById('nickInput')
  const playBtn = document.getElementById('playBtn')
  const loginError = document.getElementById('loginError')
  const resMetal = document.getElementById('resMetal')
  const resCrystal = document.getElementById('resCrystal')
  const resDeuterium = document.getElementById('resDeuterium')
  const planetSelect = document.getElementById('planetSelect')
  const planetTitle = document.getElementById('planetTitle')
  const planetName = document.getElementById('planetName')
  const planetCoords = document.getElementById('planetCoords')
  const buildingsList = document.getElementById('buildingsList')
  const buildQueueBox = document.getElementById('buildQueueBox')
  const researchList = document.getElementById('researchList')
  const researchQueueBox = document.getElementById('researchQueueBox')
  const shipsList = document.getElementById('shipsList')
  const shipBuildQueueBox = document.getElementById('shipBuildQueueBox')
  const defensesList = document.getElementById('defensesList')
  const defenseBuildQueueBox = document.getElementById('defenseBuildQueueBox')
  const debrisLine = document.getElementById('debrisLine')
  const reportsBtn = document.getElementById('reportsBtn')
  const reportsList = document.getElementById('reportsList')
  const systemInput = document.getElementById('systemInput')
  const galaxyRefreshBtn = document.getElementById('galaxyRefreshBtn')
  const galaxySlots = document.getElementById('galaxySlots')
  const fleetModalOverlay = document.getElementById('fleetModalOverlay')
  const fleetModalTitle = document.getElementById('fleetModalTitle')
  const fleetModalBody = document.getElementById('fleetModalBody')
  const fleetModalCancel = document.getElementById('fleetModalCancel')
  const fleetModalSend = document.getElementById('fleetModalSend')
  const fleetModalError = document.getElementById('fleetModalError')
  const allianceNone = document.getElementById('allianceNone')
  const allianceCreate = document.getElementById('allianceCreate')
  const allianceJoin = document.getElementById('allianceJoin')
  const allianceInfo = document.getElementById('allianceInfo')
  const allianceNameTag = document.getElementById('allianceNameTag')
  const allianceMembersList = document.getElementById('allianceMembersList')
  const allianceChatLoad = document.getElementById('allianceChatLoad')
  const allianceChatList = document.getElementById('allianceChatList')
  const allianceChatInput = document.getElementById('allianceChatInput')
  const allianceChatSend = document.getElementById('allianceChatSend')
  const gameError = document.getElementById('gameError')

  function connect() {
    if (socket) socket.disconnect()
    socket = io(backendUrl + '/empire', { transports: ['websocket', 'polling'] })
    socket.on('connect', () => {
      loginError.textContent = ''
      if (state.nickname) {
        socket.emit('identify', { nickname: state.nickname })
      }
    })
    socket.on('identified', (data) => {
      state.playerId = data.playerId
      state.nickname = data.nickname
      state.homePlanetId = data.homePlanetId
      state.currentPlanetId = data.homePlanetId
      state.ownedPlanets = data.ownedPlanets || []
      state.research = data.research || {}
      state.researchQueue = data.researchQueue || null
      state.alliance = data.alliance || null
      loginScreen.style.display = 'none'
      gameScreen.classList.add('active')
      renderPlanetSelector()
      renderAlliance()
      loadPlanet()
      loadGalaxy()
    })
    socket.on('myPlanets', (data) => {
      state.ownedPlanets = data.ownedPlanets || []
      renderPlanetSelector()
    })
    socket.on('error', (data) => {
      const msg = data.message || 'Error'
      if (gameScreen.classList.contains('active') && gameError) {
        gameError.textContent = msg
        gameError.style.display = 'block'
        setTimeout(() => { if (gameError) gameError.style.display = 'none' }, 5000)
      } else {
        loginError.textContent = msg
      }
    })
    socket.on('planetData', (data) => {
      state.planet = data.planet
      state.buildings = data.buildings || {}
      state.buildQueue = data.buildQueue
      state.nextBuildCosts = data.nextBuildCosts || {}
      state.ships = data.ships || {}
      state.shipBuildQueue = data.shipBuildQueue || null
      state.defenses = data.defenses || {}
      state.defenseBuildQueue = data.defenseBuildQueue || null
      state.debris = data.debris || { metal: 0, crystal: 0 }
      renderPlanet()
      renderResearch()
      renderShips()
      renderDefenses()
    })
    socket.on('defenseBuildStarted', (data) => {
      state.defenseBuildQueue = { defenseType: data.defenseType, finishesAt: data.finishesAt }
      renderDefenses()
    })
    socket.on('reports', (data) => {
      state.reports = data.reports || []
      renderReports()
    })
    socket.on('buildStarted', (data) => {
      state.buildQueue = { buildingType: data.buildingType, targetLevel: data.targetLevel, finishesAt: data.finishesAt }
      renderPlanet()
    })
    socket.on('researchStarted', (data) => {
      state.researchQueue = { techType: data.techType, targetLevel: data.targetLevel, finishesAt: data.finishesAt }
      renderResearch()
    })
    socket.on('shipBuildStarted', (data) => {
      state.shipBuildQueue = { shipType: data.shipType, finishesAt: data.finishesAt }
      renderShips()
    })
    socket.on('fleetSent', () => {
      socket.emit('getMyPlanets')
      loadPlanet()
      loadGalaxy()
    })
    socket.on('galaxyData', (data) => {
      renderGalaxy(data.slots)
    })
    socket.on('allianceCreated', (data) => {
      state.alliance = data.alliance
      state.allianceMembers = []
      socket.emit('getMyAlliance')
      renderAlliance()
    })
    socket.on('allianceJoined', (data) => {
      state.alliance = data.alliance
      state.allianceMembers = []
      socket.emit('getMyAlliance')
      renderAlliance()
    })
    socket.on('allianceLeft', () => {
      state.alliance = null
      state.allianceMembers = []
      state.allianceChat = []
      renderAlliance()
    })
    socket.on('myAlliance', (data) => {
      state.alliance = data.alliance
      state.allianceMembers = data.members || []
      renderAlliance()
      if (allianceChatList && allianceChatList.style.display !== 'none') renderAllianceChat()
    })
    socket.on('allianceChat', (data) => {
      state.allianceChat = data.messages || []
      renderAllianceChat()
    })
    socket.on('allianceChatMessage', (msg) => {
      state.allianceChat = state.allianceChat.concat([{ nickname: msg.nickname, message: msg.message, createdAt: msg.createdAt }])
      renderAllianceChat()
    })
    socket.on('disconnect', () => {
      loginError.textContent = 'Disconnected. Reconnecting…'
    })
  }

  function loadPlanet() {
    if (!socket || !state.currentPlanetId) return
    socket.emit('getPlanet', { planetId: state.currentPlanetId })
  }

  function renderPlanetSelector() {
    planetSelect.innerHTML = ''
    state.ownedPlanets.forEach(p => {
      const opt = document.createElement('option')
      opt.value = p.id
      opt.textContent = (p.isHome ? '★ ' : '') + p.name + ' [' + p.galaxy + ':' + p.system + ':' + p.slot + ']'
      if (p.id === state.currentPlanetId) opt.selected = true
      planetSelect.appendChild(opt)
    })
  }

  function loadGalaxy() {
    if (!socket) return
    const system = parseInt(systemInput.value, 10) || 1
    socket.emit('getGalaxy', { galaxy: 1, system })
  }

  function renderPlanet() {
    const p = state.planet
    if (!p) return
    resMetal.textContent = Math.floor(p.metal)
    resCrystal.textContent = Math.floor(p.crystal)
    resDeuterium.textContent = Math.floor(p.deuterium)
    planetTitle.textContent = p.name || 'Planet'
    planetName.textContent = [p.galaxy, p.system, p.slot].join('-')
    planetCoords.textContent = [p.galaxy, p.system, p.slot].join(':')
    const d = state.debris || {}
    if ((d.metal || 0) + (d.crystal || 0) > 0) {
      debrisLine.textContent = 'Debris at planet: ' + Math.floor(d.metal || 0) + ' Metal, ' + Math.floor(d.crystal || 0) + ' Crystal'
      debrisLine.style.display = 'block'
    } else {
      debrisLine.textContent = ''
      debrisLine.style.display = 'none'
    }

    const buildingLabels = {
      metal_mine: 'Metal Mine',
      crystal_mine: 'Crystal Mine',
      deuterium_synthesizer: 'Deuterium Synthesizer',
      solar_plant: 'Solar Plant',
      research_lab: 'Research Lab',
      shipyard: 'Shipyard'
    }
    let html = ''
    for (const [type, level] of Object.entries(state.buildings)) {
      const label = buildingLabels[type] || type
      const desc = BUILDING_DESCRIPTIONS[type]
      const hasQueue = state.buildQueue && state.buildQueue.buildingType === type
      const cost = state.nextBuildCosts[type]
      const canAfford = cost && p.metal >= cost.metal && p.crystal >= cost.crystal && p.deuterium >= cost.deuterium
      const costStr = cost ? cost.metal + ' M, ' + cost.crystal + ' C, ' + cost.deuterium + ' D' : ''
      const disabled = hasQueue || (cost && !canAfford)
      html += '<div class="building-row">'
      html += '<span class="building-name">' + label + '<span class="building-level">(Level ' + level + ')</span>'
      if (desc) html += ' <span class="info-icon" title="' + escapeAttr(desc) + '">?</span>'
      if (costStr) html += ' <span class="building-cost">— ' + costStr + '</span>'
      html += '</span>'
      html += '<button type="button" class="btn-build" data-planet="' + p.id + '" data-type="' + type + '" ' + (disabled ? 'disabled' : '') + '>Build</button>'
      html += '</div>'
    }
    buildingsList.innerHTML = html

    if (state.buildQueue) {
      buildQueueBox.style.display = 'block'
      function updateCountdown() {
        if (!state.buildQueue) return
        const sec = Math.max(0, Math.ceil((state.buildQueue.finishesAt - Date.now()) / 1000))
        buildQueueBox.innerHTML = '<strong>' + (state.buildQueue.buildingType || '').replace(/_/g, ' ') + '</strong> Level ' + state.buildQueue.targetLevel + ' — ' + sec + 's left'
        if (sec <= 0) loadPlanet()
      }
      updateCountdown()
      if (state.buildQueueTimer) clearInterval(state.buildQueueTimer)
      state.buildQueueTimer = setInterval(updateCountdown, 1000)
    } else {
      buildQueueBox.style.display = 'none'
      if (state.buildQueueTimer) { clearInterval(state.buildQueueTimer); state.buildQueueTimer = null }
    }

    buildingsList.querySelectorAll('.btn-build').forEach(btn => {
      btn.addEventListener('click', () => {
        const planetId = parseInt(btn.dataset.planet, 10)
        const buildingType = btn.dataset.type
        socket.emit('startBuild', { planetId, buildingType })
      })
    })
  }

  const RESEARCH_TYPES = ['energy', 'weapons', 'shielding', 'propulsion', 'espionage']
  const RESEARCH_LABELS = { energy: 'Energy', weapons: 'Weapons', shielding: 'Shielding', propulsion: 'Propulsion', espionage: 'Espionage' }
  const RESEARCH_DESCRIPTIONS = {
    energy: 'Increases energy output. Needed to run more mines and buildings.',
    weapons: 'Increases weapon damage in combat (ships and defenses).',
    shielding: 'Increases shield strength in combat.',
    propulsion: 'Increases ship speed, shortening flight times.',
    espionage: 'Improves espionage reports (more intel on enemy planets).'
  }
  const SHIP_TYPES = ['small_cargo', 'large_cargo', 'fighter', 'cruiser', 'colony_ship', 'recycler', 'espionage_probe', 'bomber', 'destroyer', 'battleship']
  const SHIP_LABELS = { small_cargo: 'Small Cargo', large_cargo: 'Large Cargo', fighter: 'Fighter', cruiser: 'Cruiser', colony_ship: 'Colony Ship', recycler: 'Recycler', espionage_probe: 'Espionage Probe', bomber: 'Bomber', destroyer: 'Destroyer', battleship: 'Battleship' }
  const SHIP_DESCRIPTIONS = {
    small_cargo: 'Light cargo ship (5k capacity). Can attack, transport resources, or carry payload.',
    large_cargo: 'Heavy cargo ship (25k capacity). Use for transport or as a tank in combat.',
    fighter: 'Fast, cheap combat ship. Good for raiding and defending.',
    cruiser: 'Strong combat ship. Balanced attack and shields.',
    colony_ship: 'Creates a new colony on an empty slot. One per colonization.',
    recycler: 'Collects metal and crystal from debris fields after battles.',
    espionage_probe: 'Reveals target planet resources, fleet, defenses, and research. No combat.',
    bomber: 'Heavy hitter vs defenses. High attack, slow.',
    destroyer: 'Very strong vs ships. High attack and shields.',
    battleship: 'All-round heavy warship. Strong in attack and defense.'
  }
  const DEFENSE_TYPES = ['rocket_launcher', 'light_laser', 'heavy_laser', 'ion_cannon']
  const DEFENSE_LABELS = { rocket_launcher: 'Rocket Launcher', light_laser: 'Light Laser', heavy_laser: 'Heavy Laser', ion_cannon: 'Ion Cannon' }
  const DEFENSE_DESCRIPTIONS = {
    rocket_launcher: 'Cheap, basic defense. Good early-game.',
    light_laser: 'Stronger than rockets. Good cost/effect vs light ships.',
    heavy_laser: 'Powerful vs fighters and small ships.',
    ion_cannon: 'Heavy defense. Best vs large ships and fleets.'
  }
  const BUILDING_DESCRIPTIONS = {
    metal_mine: 'Produces metal. Each level increases output. Uses energy.',
    crystal_mine: 'Produces crystal. Each level increases output. Uses energy.',
    deuterium_synthesizer: 'Produces deuterium. Each level increases output. Uses the most energy.',
    solar_plant: 'Produces energy. Needed to run mines; build this before levelling mines.',
    research_lab: 'Required to research tech. At least level 1 needed on one planet.',
    shipyard: 'Required to build ships and defenses. At least level 1 to unlock Shipyard panel.'
  }
  function escapeAttr (s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') }
  const ATTACK_SHIP_TYPES = ['small_cargo', 'large_cargo', 'fighter', 'cruiser', 'bomber', 'destroyer', 'battleship']
  const CARGO_SHIP_TYPES = ['small_cargo', 'large_cargo']
  const CARGO_CAPACITY = { small_cargo: 5000, large_cargo: 25000 }

  function openFleetModal(fromPlanetId, toPlanetId, missionType, coords) {
    state.pendingFleet = { fromPlanetId, toPlanetId, missionType, coords }
    const labels = { attack: 'Attack', recycle: 'Recycle', espionage: 'Espionage', transport: 'Transport' }
    fleetModalTitle.textContent = (labels[missionType] || missionType) + ' — ' + coords
    let html = ''
    if (missionType === 'attack') {
      ATTACK_SHIP_TYPES.forEach(type => {
        const have = (state.ships && state.ships[type]) || 0
        html += '<div class="fleet-row"><label>' + (SHIP_LABELS[type] || type) + '</label><span>Have: ' + have + '</span> <input type="number" id="fleet-' + type + '" min="0" max="' + have + '" value="0" /></div>'
      })
    } else if (missionType === 'recycle') {
      const have = (state.ships && state.ships.recycler) || 0
      html += '<div class="fleet-row"><label>Recycler</label><span>Have: ' + have + '</span> <input type="number" id="fleet-recycler" min="0" max="' + have + '" value="' + (have >= 1 ? 1 : 0) + '" /></div>'
    } else if (missionType === 'espionage') {
      const have = (state.ships && state.ships.espionage_probe) || 0
      html += '<div class="fleet-row"><label>Espionage Probe</label><span>Have: ' + have + '</span> <input type="number" id="fleet-espionage_probe" min="0" max="' + have + '" value="' + (have >= 1 ? 1 : 0) + '" /></div>'
    } else if (missionType === 'transport') {
      const metal = (state.planet && state.planet.metal) || 0
      const crystal = (state.planet && state.planet.crystal) || 0
      const deuterium = (state.planet && state.planet.deuterium) || 0
      CARGO_SHIP_TYPES.forEach(type => {
        const have = (state.ships && state.ships[type]) || 0
        html += '<div class="fleet-row"><label>' + (SHIP_LABELS[type] || type) + '</label><span>Have: ' + have + '</span> <input type="number" id="fleet-' + type + '" min="0" max="' + have + '" value="0" /></div>'
      })
      html += '<div class="fleet-row"><label>Metal</label><input type="number" id="fleet-payload-metal" min="0" value="0" /></div>'
      html += '<div class="fleet-row"><label>Crystal</label><input type="number" id="fleet-payload-crystal" min="0" value="0" /></div>'
      html += '<div class="fleet-row"><label>Deuterium</label><input type="number" id="fleet-payload-deuterium" min="0" value="0" /></div>'
      html += '<p class="text-muted small">Max: ' + Math.floor(metal) + ' M, ' + Math.floor(crystal) + ' C, ' + Math.floor(deuterium) + ' D. Cargo: 5k/small, 25k/large.</p>'
    }
    fleetModalBody.innerHTML = html
    if (fleetModalError) fleetModalError.textContent = ''
    fleetModalOverlay.classList.add('open')
  }

  function closeFleetModal() {
    state.pendingFleet = null
    fleetModalOverlay.classList.remove('open')
  }

  function sendFleetFromModal() {
    const p = state.pendingFleet
    if (!p || !socket) return
    const ships = {}
    let payload = null
    if (p.missionType === 'attack') {
      ATTACK_SHIP_TYPES.forEach(type => {
        const input = document.getElementById('fleet-' + type)
        if (input) {
          const n = parseInt(input.value, 10) || 0
          if (n > 0) ships[type] = n
        }
      })
      if (Object.keys(ships).length === 0) {
        if (fleetModalError) fleetModalError.textContent = 'Select at least one ship to send'
        return
      }
    } else if (p.missionType === 'recycle') {
      const input = document.getElementById('fleet-recycler')
      const n = input ? (parseInt(input.value, 10) || 0) : 0
      if (n < 1) { if (fleetModalError) fleetModalError.textContent = 'Send at least 1 Recycler'; return }
      ships.recycler = n
    } else if (p.missionType === 'espionage') {
      const input = document.getElementById('fleet-espionage_probe')
      const n = input ? (parseInt(input.value, 10) || 0) : 0
      if (n < 1) { if (fleetModalError) fleetModalError.textContent = 'Send at least 1 Probe'; return }
      ships.espionage_probe = n
    } else if (p.missionType === 'transport') {
      CARGO_SHIP_TYPES.forEach(type => {
        const input = document.getElementById('fleet-' + type)
        if (input) {
          const n = parseInt(input.value, 10) || 0
          if (n > 0) ships[type] = n
        }
      })
      if ((ships.small_cargo || 0) + (ships.large_cargo || 0) < 1) {
        if (fleetModalError) fleetModalError.textContent = 'Send at least 1 cargo ship'
        return
      }
      const metal = Math.max(0, parseInt(document.getElementById('fleet-payload-metal').value, 10) || 0)
      const crystal = Math.max(0, parseInt(document.getElementById('fleet-payload-crystal').value, 10) || 0)
      const deuterium = Math.max(0, parseInt(document.getElementById('fleet-payload-deuterium').value, 10) || 0)
      if (metal + crystal + deuterium < 1) {
        if (fleetModalError) fleetModalError.textContent = 'Carry at least 1 resource'
        return
      }
      const cap = (ships.small_cargo || 0) * CARGO_CAPACITY.small_cargo + (ships.large_cargo || 0) * CARGO_CAPACITY.large_cargo
      if (metal + crystal + deuterium > cap) {
        if (fleetModalError) fleetModalError.textContent = 'Payload exceeds cargo capacity (' + cap + ')'
        return
      }
      const maxM = (state.planet && state.planet.metal) || 0
      const maxC = (state.planet && state.planet.crystal) || 0
      const maxD = (state.planet && state.planet.deuterium) || 0
      if (metal > maxM || crystal > maxC || deuterium > maxD) {
        if (fleetModalError) fleetModalError.textContent = 'Not enough resources on planet'
        return
      }
      payload = { metal, crystal, deuterium }
    }
    if (fleetModalError) fleetModalError.textContent = ''
    socket.emit('sendFleet', { fromPlanetId: p.fromPlanetId, toPlanetId: p.toPlanetId, missionType: p.missionType, ships, payload: payload || undefined })
    closeFleetModal()
  }

  function renderResearch() {
    const labLevel = (state.buildings && state.buildings.research_lab) || 0
    let html = ''
    for (const tech of RESEARCH_TYPES) {
      const level = (state.research && state.research[tech]) || 0
      const hasQueue = state.researchQueue && state.researchQueue.techType === tech
      const desc = RESEARCH_DESCRIPTIONS[tech]
      html += '<div class="building-row">'
      html += '<span class="building-name">' + (RESEARCH_LABELS[tech] || tech) + '<span class="building-level">(Level ' + level + ')</span>'
      if (desc) html += ' <span class="info-icon" title="' + escapeAttr(desc) + '">?</span>'
      html += '</span>'
      html += '<button type="button" class="btn-build btn-research" data-tech="' + tech + '" ' + (hasQueue || labLevel < 1 ? 'disabled' : '') + '>Research</button>'
      html += '</div>'
    }
    researchList.innerHTML = html
    if (state.researchQueue) {
      researchQueueBox.style.display = 'block'
      const sec = Math.max(0, Math.ceil((state.researchQueue.finishesAt - Date.now()) / 1000))
      researchQueueBox.innerHTML = '<strong>' + (state.researchQueue.techType || '').replace(/_/g, ' ') + '</strong> Level ' + state.researchQueue.targetLevel + ' — ' + sec + 's left'
      if (state.researchQueueTimer) clearInterval(state.researchQueueTimer)
      state.researchQueueTimer = setInterval(() => {
        if (!state.researchQueue) return
        const s = Math.max(0, Math.ceil((state.researchQueue.finishesAt - Date.now()) / 1000))
        researchQueueBox.innerHTML = '<strong>' + state.researchQueue.techType + '</strong> Level ' + state.researchQueue.targetLevel + ' — ' + s + 's left'
        if (s <= 0) loadPlanet()
      }, 1000)
    } else {
      researchQueueBox.style.display = 'none'
      if (state.researchQueueTimer) { clearInterval(state.researchQueueTimer); state.researchQueueTimer = null }
    }
    researchList.querySelectorAll('.btn-research').forEach(btn => {
      btn.addEventListener('click', () => socket.emit('startResearch', { techType: btn.dataset.tech }))
    })
  }

  function renderShips() {
    let html = ''
    for (const ship of SHIP_TYPES) {
      const count = (state.ships && state.ships[ship]) || 0
      const hasQueue = state.shipBuildQueue && state.shipBuildQueue.shipType === ship
      const shipyardLevel = (state.buildings && state.buildings.shipyard) || 0
      const desc = SHIP_DESCRIPTIONS[ship]
      html += '<div class="building-row">'
      html += '<span class="building-name">' + (SHIP_LABELS[ship] || ship) + ': <span class="building-level">' + count + '</span>'
      if (desc) html += ' <span class="info-icon" title="' + escapeAttr(desc) + '">?</span>'
      html += '</span>'
      html += '<button type="button" class="btn-build btn-ship" data-ship="' + ship + '" data-planet="' + (state.planet && state.planet.id) + '" ' + (hasQueue || shipyardLevel < 1 ? 'disabled' : '') + '>Build</button>'
      html += '</div>'
    }
    shipsList.innerHTML = html
    if (state.shipBuildQueue) {
      shipBuildQueueBox.style.display = 'block'
      const sec = Math.max(0, Math.ceil((state.shipBuildQueue.finishesAt - Date.now()) / 1000))
      shipBuildQueueBox.innerHTML = '<strong>' + (state.shipBuildQueue.shipType || '').replace(/_/g, ' ') + '</strong> — ' + sec + 's left'
      if (state.shipBuildQueueTimer) clearInterval(state.shipBuildQueueTimer)
      state.shipBuildQueueTimer = setInterval(() => {
        if (!state.shipBuildQueue) return
        const s = Math.max(0, Math.ceil((state.shipBuildQueue.finishesAt - Date.now()) / 1000))
        shipBuildQueueBox.innerHTML = '<strong>' + state.shipBuildQueue.shipType + '</strong> — ' + s + 's left'
        if (s <= 0) loadPlanet()
      }, 1000)
    } else {
      shipBuildQueueBox.style.display = 'none'
      if (state.shipBuildQueueTimer) { clearInterval(state.shipBuildQueueTimer); state.shipBuildQueueTimer = null }
    }
    shipsList.querySelectorAll('.btn-ship').forEach(btn => {
      btn.addEventListener('click', () => {
        const planetId = parseInt(btn.dataset.planet, 10)
        if (planetId) socket.emit('buildShip', { planetId, shipType: btn.dataset.ship })
      })
    })
  }

  function renderDefenses() {
    let html = ''
    for (const def of DEFENSE_TYPES) {
      const count = (state.defenses && state.defenses[def]) || 0
      const hasQueue = state.defenseBuildQueue && state.defenseBuildQueue.defenseType === def
      const shipyardLevel = (state.buildings && state.buildings.shipyard) || 0
      const desc = DEFENSE_DESCRIPTIONS[def]
      html += '<div class="building-row">'
      html += '<span class="building-name">' + (DEFENSE_LABELS[def] || def) + ': <span class="building-level">' + count + '</span>'
      if (desc) html += ' <span class="info-icon" title="' + escapeAttr(desc) + '">?</span>'
      html += '</span>'
      html += '<button type="button" class="btn-build btn-defense" data-defense="' + def + '" data-planet="' + (state.planet && state.planet.id) + '" ' + (hasQueue || shipyardLevel < 1 ? 'disabled' : '') + '>Build</button>'
      html += '</div>'
    }
    defensesList.innerHTML = html
    if (state.defenseBuildQueue) {
      defenseBuildQueueBox.style.display = 'block'
      const sec = Math.max(0, Math.ceil((state.defenseBuildQueue.finishesAt - Date.now()) / 1000))
      defenseBuildQueueBox.innerHTML = '<strong>' + (state.defenseBuildQueue.defenseType || '').replace(/_/g, ' ') + '</strong> — ' + sec + 's left'
      if (sec <= 0) loadPlanet()
    } else {
      defenseBuildQueueBox.style.display = 'none'
    }
    defensesList.querySelectorAll('.btn-defense').forEach(btn => {
      btn.addEventListener('click', () => {
        const planetId = parseInt(btn.dataset.planet, 10)
        if (planetId) socket.emit('buildDefense', { planetId, defenseType: btn.dataset.defense })
      })
    })
  }

  function renderAlliance() {
    if (!allianceNone || !allianceCreate || !allianceJoin || !allianceInfo) return
    if (state.alliance) {
      allianceNone.style.display = 'none'
      allianceCreate.style.display = 'none'
      allianceJoin.style.display = 'none'
      allianceInfo.style.display = 'block'
      if (allianceNameTag) allianceNameTag.textContent = state.alliance.name + ' [' + state.alliance.tag + ']'
      if (allianceMembersList) allianceMembersList.textContent = state.allianceMembers.length ? state.allianceMembers.map(m => m.nickname).join(', ') : '…'
      if (state.allianceMembers.length === 0 && socket && socket.connected) socket.emit('getMyAlliance')
    } else {
      allianceNone.style.display = 'block'
      allianceCreate.style.display = 'block'
      allianceJoin.style.display = 'block'
      allianceInfo.style.display = 'none'
    }
  }

  function renderAllianceChat() {
    if (!allianceChatList) return
    if (!state.allianceChat.length) {
      allianceChatList.innerHTML = '<p class="text-muted small">No messages.</p>'
      allianceChatList.style.display = 'block'
      return
    }
    allianceChatList.innerHTML = state.allianceChat.map(m => {
      const who = (m.nickname || '?')
      const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''
      return '<div class="alliance-msg"><span class="who">' + who + '</span> ' + (time ? ' <span class="text-muted">' + time + '</span>' : '') + '<br/>' + (m.message || '').replace(/</g, '&lt;') + '</div>'
    }).join('')
    allianceChatList.style.display = 'block'
    allianceChatList.scrollTop = allianceChatList.scrollHeight
  }

  function renderReports() {
    reportsList.style.display = 'block'
    if (!state.reports.length) {
      reportsList.innerHTML = '<p class="text-muted">No reports.</p>'
      return
    }
    let html = ''
    state.reports.forEach(r => {
      html += '<div class="report-item" data-id="' + r.id + '">'
      html += '<strong>' + r.targetCoords + '</strong> — ' + new Date(r.createdAt).toLocaleString()
      html += '</div>'
    })
    reportsList.innerHTML = html
    reportsList.querySelectorAll('.report-item').forEach(el => {
      el.addEventListener('click', () => {
        const report = state.reports.find(x => x.id === parseInt(el.dataset.id, 10))
        if (report) alert('Report ' + report.targetCoords + ':\nResources: ' + JSON.stringify(report.reportData.resources) + '\nShips: ' + JSON.stringify(report.reportData.ships) + '\nDefenses: ' + JSON.stringify(report.reportData.defenses))
      })
    })
  }

  function renderGalaxy(slots) {
    if (!slots || !slots.length) {
      galaxySlots.innerHTML = '<p class="text-muted">No slots</p>'
      return
    }
    const colonyShips = (state.ships && state.ships.colony_ship) || 0
    const recyclers = (state.ships && state.ships.recycler) || 0
    const probes = (state.ships && state.ships.espionage_probe) || 0
    const fighters = (state.ships && state.ships.fighter) || 0
    const fromPlanetId = state.planet && state.planet.id
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 8px;">'
    slots.forEach(s => {
      html += '<div style="padding: 8px 12px; background: #21262d; border-radius: 6px; min-width: 160px;">'
      html += 'Slot ' + s.slot + ': ' + (s.ownerName === 'empty' ? '<span class="text-muted">empty</span>' : s.ownerName)
      if (s.name) html += ' — ' + s.name
      if ((s.debrisMetal || 0) + (s.debrisCrystal || 0) > 0) html += ' <span class="text-muted">(' + Math.floor(s.debrisMetal || 0) + ' M, ' + Math.floor(s.debrisCrystal || 0) + ' C debris)</span>'
      html += '<div style="margin-top:4px;">'
      if (s.ownerName === 'empty' && colonyShips >= 1 && fromPlanetId) {
        html += ' <button type="button" class="btn-build colonize-btn" style="font-size:0.8rem;" data-from="' + fromPlanetId + '" data-to="' + s.planetId + '">Colonize</button>'
      }
      const hasCombatShips = (state.ships && ((state.ships.fighter || 0) + (state.ships.cruiser || 0) + (state.ships.small_cargo || 0) + (state.ships.large_cargo || 0) + (state.ships.bomber || 0) + (state.ships.destroyer || 0) + (state.ships.battleship || 0) >= 1))
      if (s.ownerName !== 'empty' && s.ownerName !== state.nickname && hasCombatShips && fromPlanetId) {
        html += ' <button type="button" class="btn-mission attack" data-from="' + fromPlanetId + '" data-to="' + s.planetId + '" data-coords="1:' + (systemInput.value || 1) + ':' + s.slot + '">Attack</button>'
      }
      if ((s.debrisMetal || 0) + (s.debrisCrystal || 0) > 0 && recyclers >= 1 && fromPlanetId) {
        html += ' <button type="button" class="btn-mission recycle" data-from="' + fromPlanetId + '" data-to="' + s.planetId + '" data-coords="1:' + (systemInput.value || 1) + ':' + s.slot + '">Recycle</button>'
      }
      if (s.ownerName !== 'empty' && probes >= 1 && fromPlanetId) {
        html += ' <button type="button" class="btn-mission spy" data-from="' + fromPlanetId + '" data-to="' + s.planetId + '" data-coords="1:' + (systemInput.value || 1) + ':' + s.slot + '">Spy</button>'
      }
      const hasCargo = (state.ships && ((state.ships.small_cargo || 0) + (state.ships.large_cargo || 0) >= 1))
      if (hasCargo && fromPlanetId && s.planetId) {
        html += ' <button type="button" class="btn-mission transport" data-from="' + fromPlanetId + '" data-to="' + s.planetId + '" data-coords="1:' + (systemInput.value || 1) + ':' + s.slot + '">Transport</button>'
      }
      html += '</div></div>'
    })
    html += '</div>'
    galaxySlots.innerHTML = html
    galaxySlots.querySelectorAll('.colonize-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        socket.emit('sendFleet', { fromPlanetId: parseInt(btn.dataset.from, 10), toPlanetId: parseInt(btn.dataset.to, 10), missionType: 'colonize', ships: { colony_ship: 1 } })
      })
    })
    galaxySlots.querySelectorAll('.btn-mission.attack').forEach(btn => {
      btn.addEventListener('click', () => {
        openFleetModal(parseInt(btn.dataset.from, 10), parseInt(btn.dataset.to, 10), 'attack', btn.dataset.coords || '')
      })
    })
    galaxySlots.querySelectorAll('.btn-mission.recycle').forEach(btn => {
      btn.addEventListener('click', () => {
        openFleetModal(parseInt(btn.dataset.from, 10), parseInt(btn.dataset.to, 10), 'recycle', btn.dataset.coords || '')
      })
    })
    galaxySlots.querySelectorAll('.btn-mission.spy').forEach(btn => {
      btn.addEventListener('click', () => {
        openFleetModal(parseInt(btn.dataset.from, 10), parseInt(btn.dataset.to, 10), 'espionage', btn.dataset.coords || '')
      })
    })
    galaxySlots.querySelectorAll('.btn-mission.transport').forEach(btn => {
      btn.addEventListener('click', () => {
        openFleetModal(parseInt(btn.dataset.from, 10), parseInt(btn.dataset.to, 10), 'transport', btn.dataset.coords || '')
      })
    })
  }

  playBtn.addEventListener('click', () => {
    const nick = (nickInput.value || '').trim().slice(0, 30)
    if (!nick) {
      loginError.textContent = 'Enter a nickname'
      return
    }
    try { sessionStorage.setItem(NICKNAME_KEY, nick) } catch (e) {}
    state.nickname = nick
    connect()
    socket.emit('identify', { nickname: nick })
  })

  planetSelect.addEventListener('change', () => {
    state.currentPlanetId = parseInt(planetSelect.value, 10)
    loadPlanet()
  })
  reportsBtn.addEventListener('click', () => {
    socket.emit('getReports')
  })
  const allianceCreateBtn = document.getElementById('allianceCreateBtn')
  const allianceJoinBtn = document.getElementById('allianceJoinBtn')
  const allianceLeaveBtn = document.getElementById('allianceLeaveBtn')
  if (allianceCreateBtn) {
    allianceCreateBtn.addEventListener('click', () => {
      const name = (document.getElementById('allianceName').value || '').trim().slice(0, 30)
      const tag = (document.getElementById('allianceTag').value || '').trim().toUpperCase().slice(0, 8)
      if (!name || !tag) { loginError.textContent = 'Name and tag required'; return }
      socket.emit('createAlliance', { name, tag })
    })
  }
  if (allianceJoinBtn) {
    allianceJoinBtn.addEventListener('click', () => {
      const tag = (document.getElementById('allianceJoinTag').value || '').trim().toUpperCase().slice(0, 8)
      if (!tag) { loginError.textContent = 'Tag required'; return }
      socket.emit('joinAlliance', { tag })
    })
  }
  if (allianceLeaveBtn) {
    allianceLeaveBtn.addEventListener('click', () => {
      if (confirm('Leave this alliance?')) socket.emit('leaveAlliance')
    })
  }
  if (allianceChatLoad) {
    allianceChatLoad.addEventListener('click', () => {
      socket.emit('getAllianceChat')
      if (allianceChatList) { allianceChatList.style.display = 'block'; allianceChatList.innerHTML = '<p class="text-muted small">Loading…</p>' }
      if (allianceChatInput) allianceChatInput.style.display = 'block'
      if (allianceChatSend) allianceChatSend.style.display = 'inline-block'
    })
  }
  if (allianceChatSend) {
    allianceChatSend.addEventListener('click', () => {
      const msg = (allianceChatInput && allianceChatInput.value || '').trim()
      if (!msg) return
      socket.emit('sendAllianceChat', { message: msg })
      if (allianceChatInput) allianceChatInput.value = ''
    })
  }
  fleetModalCancel.addEventListener('click', closeFleetModal)
  fleetModalSend.addEventListener('click', sendFleetFromModal)
  fleetModalOverlay.addEventListener('click', (e) => {
    if (e.target === fleetModalOverlay) closeFleetModal()
  })
  galaxyRefreshBtn.addEventListener('click', loadGalaxy)
  systemInput.addEventListener('change', loadGalaxy)

  try {
    const saved = sessionStorage.getItem(NICKNAME_KEY)
    if (saved) nickInput.value = saved
  } catch (e) {}

  if (backendUrl) connect()

  setInterval(() => {
    if (state.currentPlanetId && socket && socket.connected) socket.emit('getPlanet', { planetId: state.currentPlanetId })
  }, 5000)
})()
