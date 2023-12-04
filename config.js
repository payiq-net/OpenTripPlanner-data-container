/*
 * id = feedid (String)
 * url = feed url (String)
 * fit = mapfit shapes (true/falsy)
 * rules = OBA Filter rules to apply (array of strings or undefined)
 * replacements = replace or remove file from gtfs package (format: {'file_to_replace': 'file_to_replace_with' or null})
 * request options = optional special options for request
 */
const src = (id, url, fit, rules, replacements, requestOptions) => ({ id, url, fit, rules, replacements, requestOptions })

// OBA filter erases files which it does not recognize from GTFS packages
// this array specifies the file names which should be preserved
const passOBAfilter = ['emissions.txt', 'translations.txt']

// matkahuolto data source often fails when accessed through digitransit proxy
// here we exceptionally set up direct calls with basic auth
let mhAddress
if (process.env.MH_BASIC_AUTH) {
  const basic = Buffer.from(process.env.MH_BASIC_AUTH, 'base64').toString('utf8')
  mhAddress = `https://${basic}@minfoapi.matkahuolto.fi/gtfs/kokomaa-fi/gtfs.zip`
} else {
  mhAddress = 'http://digitransit-proxy:8080/out/minfoapi.matkahuolto.fi/gtfs/kokomaa-fi/gtfs.zip'
}

const routers = {
  hsl: {
    id: 'hsl',
    src: [
      src('HSL', 'https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip', false, undefined, { 'translations.txt': 'translations_new.txt', 'trips.txt': 'trips2.txt' })
      // src('HSLlautta', 'https://koontikartta.navici.com/tiedostot/gtfs_lautat_digitransit.zip'),
      // src('Sipoo', 'https://koontikartta.navici.com/tiedostot/rae/sipoon_kunta_sibbo_kommun.zip')
    ],
    osm: ['hsl'],
    dem: 'hsl'
  },

  finland: {
    id: 'finland',
    src: [
      src('HSL', 'https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip', false, ['finland/gtfs-rules/hsl-no-trains.rule'], { 'translations.txt': 'translations_new.txt', 'trips.txt': 'trips2.txt' }),
      src('MATKA', 'https://koontikartta.navici.com/tiedostot/gtfs_digitransit.zip', true, ['finland/gtfs-rules/matka-cleaned.rule']),
      src('tampere', 'http://ekstrat.tampere.fi/ekstrat/ptdata/tamperefeed_deprecated.zip'),
      src('LINKKI', 'https://tvv.fra1.digitaloceanspaces.com/209.zip', true),
      src('OULU', 'https://tvv.fra1.digitaloceanspaces.com/229.zip'),
      src('digitraffic', 'https://rata.digitraffic.fi/api/v1/trains/gtfs-passenger-stops.zip', false, undefined, undefined, { gzip: true }),
      src('Rauma', 'http://digitransit-proxy:8080/out/raumaadmin.mattersoft.fi/feeds/233.zip'),
      src('Hameenlinna', 'https://tvv.fra1.digitaloceanspaces.com/203.zip', true),
      src('Kotka', 'https://tvv.fra1.digitaloceanspaces.com/217.zip', true),
      src('Kouvola', 'https://tvv.fra1.digitaloceanspaces.com/219.zip', true),
      src('Lappeenranta', 'https://tvv.fra1.digitaloceanspaces.com/225.zip', true),
      src('Mikkeli', 'https://tvv.fra1.digitaloceanspaces.com/227.zip', true),
      src('Vaasa', 'https://tvv.fra1.digitaloceanspaces.com/249.zip', true),
      src('Joensuu', 'https://tvv.fra1.digitaloceanspaces.com/207.zip', true),
      src('FOLI', 'http://data.foli.fi/gtfs/gtfs.zip'),
      src('Lahti', 'https://tvv.fra1.digitaloceanspaces.com/223.zip', true),
      src('Kuopio', 'http://karttapalvelu.kuopio.fi/google_transit/google_transit.zip'),
      src('Rovaniemi', 'https://tvv.fra1.digitaloceanspaces.com/237.zip', true),
      src('Kajaani', 'https://tvv.fra1.digitaloceanspaces.com/211.zip', true),
      src('Salo', 'https://tvv.fra1.digitaloceanspaces.com/239.zip', true),
      src('Pori', 'https://tvv.fra1.digitaloceanspaces.com/231.zip', true),
      src('Viro', 'http://peatus.ee/gtfs/gtfs.zip'),
      src('Vikingline', 'https://fgwgtfsprod.blob.core.windows.net/gtfsout/latest_VIKINGLINE.zip'),
      src('Raasepori', 'https://tvv.fra1.digitaloceanspaces.com/232.zip', true),
      src('VARELY', 'http://digitransit-proxy:8080/out/varelyadmin.mattersoft.fi/feeds/102.zip', false)
    ],
    osm: ['finland', 'estonia']
  },

  waltti: {
    id: 'waltti',
    src: [
      src('Hameenlinna', 'https://tvv.fra1.digitaloceanspaces.com/203.zip', true),
      src('Kotka', 'https://tvv.fra1.digitaloceanspaces.com/217.zip', true),
      src('Kouvola', 'https://tvv.fra1.digitaloceanspaces.com/219.zip', true),
      src('Lappeenranta', 'https://tvv.fra1.digitaloceanspaces.com/225.zip', true),
      src('Mikkeli', 'https://tvv.fra1.digitaloceanspaces.com/227.zip', true),
      src('Vaasa', 'https://tvv.fra1.digitaloceanspaces.com/249.zip', true),
      src('Joensuu', 'https://tvv.fra1.digitaloceanspaces.com/207.zip', true),
      src('FOLI', 'http://data.foli.fi/gtfs/gtfs.zip'),
      src('Lahti', 'https://tvv.fra1.digitaloceanspaces.com/223.zip', true),
      src('Kuopio', 'http://karttapalvelu.kuopio.fi/google_transit/google_transit.zip'),
      src('OULU', 'https://tvv.fra1.digitaloceanspaces.com/229.zip'),
      src('LINKKI', 'https://tvv.fra1.digitaloceanspaces.com/209.zip', true),
      src('tampere', 'http://ekstrat.tampere.fi/ekstrat/ptdata/tamperefeed_deprecated.zip'),
      src('Rovaniemi', 'https://tvv.fra1.digitaloceanspaces.com/237.zip', true),
      src('digitraffic', 'https://rata.digitraffic.fi/api/v1/trains/gtfs-passenger-stops.zip', false, undefined, undefined, { gzip: true }),
      src('tampereDRT', 'https://ekstrat.tampere.fi/ekstrat/ptdata/tamperefeed_kutsuliikenne.zip'),
      src('Pori', 'https://tvv.fra1.digitaloceanspaces.com/231.zip', true),
      src('FUNI', 'https://foligtfs.blob.core.windows.net/routeplanner/gtfs-foli-ff.zip', true)
    ],
    osm: ['finland'],
    dem: 'waltti'
  },

  'waltti-alt': {
    id: 'waltti-alt',
    src: [
      src('Salo', 'https://tvv.fra1.digitaloceanspaces.com/239.zip', true),
      src('Kajaani', 'https://tvv.fra1.digitaloceanspaces.com/211.zip', true),
      src('Raasepori', 'https://tvv.fra1.digitaloceanspaces.com/232.zip', true)
    ],
    osm: ['finland']
  },

  varely: {
    id: 'varely',
    src: [
      src('VARELY', 'http://digitransit-proxy:8080/out/varelyadmin.mattersoft.fi/feeds/102.zip'),
      src('FOLI', 'http://data.foli.fi/gtfs/gtfs.zip'),
      src('Rauma', 'http://digitransit-proxy:8080/out/raumaadmin.mattersoft.fi/feeds/233.zip')
    ],
    osm: ['finland']
  },

  kela: {
    id: 'kela',
    src: [
      src('kela', 'https://koontikartta.navici.com/tiedostot/gtfs_kela.zip'),
      src('matkahuolto', mhAddress, false, ['kela/gtfs-rules/no-onnibus-mega.rule'], { 'transfers.txt': null })
    ],
    osm: ['finland']
  }
}

if (!process.env.ROUTER_NAME || !routers[process.env.ROUTER_NAME]) {
  process.stdout.write('Invalid ROUTER_NAME variable \n')
  process.exit(1)
}
const router = routers[process.env.ROUTER_NAME]

// EXTRA_SRC format should be {"FOLI": {"url": "http://data.foli.fi/gtfs/gtfs.zip",  "fit": false, "rules": ["waltti/gtfs-rules/waltti.rule"], "routers": ["hsl", "finland"]}}
// but you can only define, for example, new url and the other key value pairs will remain the same as they are defined in this file. "routers" is always a mandatory field.
// It is also possible to add completely new src by defining object with unused id or to remove a src by defining "remove": true
const extraSrc = process.env.EXTRA_SRC !== undefined ? JSON.parse(process.env.EXTRA_SRC) : {}

const usedSrc = []

// add config to every source and override config values if they are defined in extraSrc
const cfg = router
const cfgSrc = cfg.src
for (let j = cfgSrc.length - 1; j >= 0; j--) {
  const src = cfgSrc[j]
  const id = src.id
  if (extraSrc[id] && extraSrc[id].routers !== undefined && extraSrc[id].routers.includes(cfg.id)) {
    usedSrc.push(id)
    if (extraSrc[id].remove) {
      cfgSrc.splice(j, 1)
      continue
    }
    cfgSrc[j] = { ...src, ...extraSrc[src.id] }
  }
  cfgSrc[j].config = cfg
}

// Go through extraSrc keys to find keys that don't already exist in src and add those as new src
Object.keys(extraSrc).forEach(id => {
  if (!usedSrc.includes(id)) {
    const targets = extraSrc[id].routers
    if (targets.includes(router.id)) {
      router.src.push({ ...extraSrc[id], id })
    }
  }
})

// create id->src-entry map
const gtfsMap = {}
router.src.forEach(src => { gtfsMap[src.id] = src })

const osm = {
  finland: 'https://karttapalvelu.storage.hsldev.com/finland.osm/finland.osm.pbf',
  hsl: 'https://karttapalvelu.storage.hsldev.com/hsl.osm/hsl.osm.pbf',
  estonia: 'https://download.geofabrik.de/europe/estonia-latest.osm.pbf'
}

const dem = {
  waltti: 'https://elevdata.blob.core.windows.net/elevation/waltti/waltti-10m-elevation-model_20190927.tif',
  hsl: 'https://elevdata.blob.core.windows.net/elevation/hsl/hsl-10m-elevation-model_20190920.tif'
}

const constants = {
  BUFFER_SIZE: 1024 * 1024 * 32
}

module.exports = {
  router,
  gtfsMap,
  osm: router.osm.map(id => { return { id, url: osm[id] } }), // array of id, url pairs
  dem: router.dem ? [{ id: router.dem, url: dem[router.dem] }] : null, // currently only one DEM file is used
  dataToolImage: `hsldevcom/otp-data-tools:${process.env.TOOLS_TAG || 'v3'}`,
  dataDir: `${process.cwd()}/data`,
  constants,
  passOBAfilter
}
