'use strict'

const {
  ENERGY_PER_SOLAR_LEVEL,
  CONSUMPTION_PER_LEVEL,
  PRODUCTION_BASE
} = require('./constants')

function computeProduction(planet, buildings) {
  const slot = planet.slot || 1
  const metalL = buildings.metal_mine || 0
  const crystalL = buildings.crystal_mine || 0
  const deuteriumL = buildings.deuterium_synthesizer || 0
  const solarL = buildings.solar_plant || 0

  const energy = solarL * ENERGY_PER_SOLAR_LEVEL
  const consumption =
    (metalL * CONSUMPTION_PER_LEVEL.metal_mine) +
    (crystalL * CONSUMPTION_PER_LEVEL.crystal_mine) +
    (deuteriumL * CONSUMPTION_PER_LEVEL.deuterium_synthesizer)

  const metalPerHour = metalL > 0 ? PRODUCTION_BASE.metal_mine * metalL * Math.pow(1.1, metalL) : 0
  const crystalPerHour = crystalL > 0 ? PRODUCTION_BASE.crystal_mine * crystalL * Math.pow(1.1, crystalL) : 0
  const deutFactor = 0.9 - 0.01 * slot
  const deuteriumPerHour = deuteriumL > 0 ? PRODUCTION_BASE.deuterium_synthesizer * deuteriumL * Math.pow(1.1, deuteriumL) * deutFactor : 0

  let metalPerSec = metalPerHour / 3600
  let crystalPerSec = crystalPerHour / 3600
  let deuteriumPerSec = deuteriumPerHour / 3600

  if (consumption > 0 && energy < consumption) {
    const factor = energy / consumption
    metalPerSec *= factor
    crystalPerSec *= factor
    deuteriumPerSec *= factor
  }

  return {
    metalPerSec,
    crystalPerSec,
    deuteriumPerSec,
    metalPerHour: Math.round(metalPerSec * 3600),
    crystalPerHour: Math.round(crystalPerSec * 3600),
    deuteriumPerHour: Math.round(deuteriumPerSec * 3600),
    energyProduced: energy,
    energyConsumed: consumption,
    energyBalance: energy - consumption
  }
}

module.exports = { computeProduction }
