'use strict'

const { SHIP_STATS, DEFENSE_STATS, SHIP_COST, DEFENSE_COST, DEBRIS_FACTOR } = require('./constants')

function runCombat(attackerShips, defenderShips, defenderDefenses, attackerWeapons, attackerShielding, defenderWeapons, defenderShielding) {
  const weaponBonus = (level) => 1 + level * 0.1
  const shieldBonus = (level) => 1 + level * 0.1

  let attAttack = 0
  let attShield = 0
  let attHull = 0
  const attUnits = []
  for (const [type, count] of Object.entries(attackerShips || {})) {
    if (count <= 0) continue
    const s = SHIP_STATS[type]
    if (!s) continue
    attAttack += count * s.attack * weaponBonus(attackerWeapons || 0)
    attShield += count * s.shield * shieldBonus(attackerShielding || 0)
    attHull += count * s.hull
    attUnits.push({ type, count, attack: s.attack, shield: s.shield, hull: s.hull })
  }

  let defAttack = 0
  let defShield = 0
  let defHull = 0
  const defShipUnits = []
  for (const [type, count] of Object.entries(defenderShips || {})) {
    if (count <= 0) continue
    const s = SHIP_STATS[type]
    if (!s) continue
    defAttack += count * s.attack * weaponBonus(defenderWeapons || 0)
    defShield += count * s.shield * shieldBonus(defenderShielding || 0)
    defHull += count * s.hull
    defShipUnits.push({ type, count, attack: s.attack, shield: s.shield, hull: s.hull, cost: SHIP_COST[type] })
  }
  const defDefUnits = []
  for (const [type, count] of Object.entries(defenderDefenses || {})) {
    if (count <= 0) continue
    const s = DEFENSE_STATS[type]
    if (!s) continue
    defAttack += count * s.attack * weaponBonus(defenderWeapons || 0)
    defShield += count * s.shield * shieldBonus(defenderShielding || 0)
    defHull += count * s.hull
    defDefUnits.push({ type, count, attack: s.attack, shield: s.shield, hull: s.hull, cost: DEFENSE_COST[type] })
  }

  if (attAttack <= 0 && defAttack <= 0) {
    return { attackerLosses: {}, defenderShipLosses: {}, defenderDefenseLosses: {}, debris: { metal: 0, crystal: 0 } }
  }

  const totalDefHull = defHull
  const totalAttHull = attHull
  if (totalDefHull <= 0 && totalAttHull <= 0) {
    return { attackerLosses: {}, defenderShipLosses: {}, defenderDefenseLosses: {}, debris: { metal: 0, crystal: 0 } }
  }

  const defDamageToAtt = Math.min(attHull, defAttack)
  const attDamageToDef = Math.min(defHull, attAttack)

  const attLossRatio = totalAttHull > 0 ? defDamageToAtt / totalAttHull : 0
  const defLossRatio = totalDefHull > 0 ? attDamageToDef / totalDefHull : 0

  const attackerLosses = {}
  let attHullLost = 0
  for (const u of attUnits) {
    const hullPerUnit = u.hull * u.count
    const lostHull = hullPerUnit * attLossRatio
    const lostCount = Math.min(u.count, Math.ceil(lostHull / u.hull))
    if (lostCount > 0) {
      attackerLosses[u.type] = lostCount
      attHullLost += lostCount * u.hull
    }
  }

  const defenderShipLosses = {}
  const defenderDefenseLosses = {}
  let debrisMetal = 0
  let debrisCrystal = 0

  for (const u of defShipUnits) {
    const hullPerUnit = u.hull * u.count
    const lostHull = hullPerUnit * defLossRatio
    const lostCount = Math.min(u.count, Math.ceil(lostHull / u.hull))
    if (lostCount > 0) {
      defenderShipLosses[u.type] = lostCount
      const cost = u.cost || {}
      debrisMetal += (cost.metal || 0) * lostCount * DEBRIS_FACTOR
      debrisCrystal += (cost.crystal || 0) * lostCount * DEBRIS_FACTOR
    }
  }
  for (const u of defDefUnits) {
    const hullPerUnit = u.hull * u.count
    const lostHull = hullPerUnit * defLossRatio
    const lostCount = Math.min(u.count, Math.ceil(lostHull / u.hull))
    if (lostCount > 0) {
      defenderDefenseLosses[u.type] = lostCount
      const cost = u.cost || {}
      debrisMetal += (cost.metal || 0) * lostCount * DEBRIS_FACTOR
      debrisCrystal += (cost.crystal || 0) * lostCount * DEBRIS_FACTOR
    }
  }

  return {
    attackerLosses,
    defenderShipLosses,
    defenderDefenseLosses,
    debris: { metal: Math.floor(debrisMetal), crystal: Math.floor(debrisCrystal) }
  }
}

module.exports = { runCombat }
