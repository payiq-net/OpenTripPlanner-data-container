const through = require('through2')
const Vinyl = require('vinyl')
const fs = require('fs')
const cloneable = require('cloneable-readable')
const { routerDir } = require('../util')
const { dataDir } = require('../config')

function createFile (config, fileName, source) {
  const name = `${config.id}/router/${fileName}`
  process.stdout.write(`copying ${fileName}...\n`)
  const file = new Vinyl({ path: name, contents: cloneable(fs.createReadStream(source)) })
  return file
}

// EXTRA_UPDATERS format should be {"turku-alerts": {"type": "real-time-alerts", "frequencySec": 30, "url": "https://foli-beta.nanona.fi/gtfs-rt/reittiopas", "feedId": "FOLI", "fuzzyTripMatching": true, "routers": ["waltti"]}}
// but you can only define, for example, new url and the other key value pairs will remain the same as they are defined in this file. "routers" is always mandatory.
// It is also possible to add completely new src by defining object with unused id or to remove a src by defining "remove": true
const extraUpdaters = process.env.EXTRA_UPDATERS !== undefined ? JSON.parse(process.env.EXTRA_UPDATERS) : {}

// Prepares router-config.json data for data container and applies edits/additions made in EXTRA_UPDATERS env var
function createAndProcessRouterConfig (config) {
  process.stdout.write(`copying router-config.json...\n`)
  const source = `${routerDir(config)}/router-config.json`
  const routerConfig = JSON.parse(fs.readFileSync(source, 'utf8'))
  const updaters = routerConfig.updaters
  let usedPatches = []
  for (let i = updaters.length - 1; i >= 0; i--) {
    const updaterId = updaters[i].id
    const updaterPatch = extraUpdaters[updaterId]
    if (updaterPatch !== undefined && updaterPatch.routers !== undefined && updaterPatch.routers.includes(config.id)) {
      if (updaterPatch.remove === true) {
        updaters.splice(i, 1)
      } else {
        const mergedUpdaters = { ...updaters[i], ...updaterPatch }
        delete mergedUpdaters.remove
        delete mergedUpdaters.routers
        updaters[i] = mergedUpdaters
      }
      usedPatches.push(updaterId)
    }
  }
  Object.keys(extraUpdaters).forEach(id => {
    if (!usedPatches.includes(id)) {
      const routers = extraUpdaters[id].routers
      if (routers !== undefined && routers.includes(config.id)) {
        let patchClone = Object.assign({}, extraUpdaters[id])
        delete patchClone.remove
        delete patchClone.routers
        updaters.push({ ...patchClone, id })
      }
    }
  })
  const name = `${config.id}/router/router-config.json`
  const file = new Vinyl({ path: name, contents: Buffer.from(JSON.stringify(routerConfig, null, 2)) })
  return file
}

/**
 * Make router data ready for inclusion in data container.
 */
module.exports = function (config) {
  const stream = through.obj()

  stream.push(createFile(config, 'build-config.json', `${routerDir(config)}/build-config.json`))
  stream.push(createFile(config, 'otp-config.json', `${routerDir(config)}/otp-config.json`))
  stream.push(createAndProcessRouterConfig(config))
  config.osm.forEach(osmId => {
    const name = osmId + '.pbf'
    stream.push(createFile(config, name, `${dataDir}/ready/osm/${name}`))
  })
  if (config.dem) {
    const name = config.dem + '.tif'
    stream.push(createFile(config, name, `${dataDir}/ready/dem/${name}`))
  }
  config.src.forEach(src => {
    const name = src.id + '-gtfs.zip'
    stream.push(createFile(config, name, `${dataDir}/ready/gtfs/${name}`))
  })
  stream.end()

  return stream
}
