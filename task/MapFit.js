const through = require('through2')
const fs = require('fs')
const path = require('path')
const cloneable = require('cloneable-readable')
const { dataDir, dataToolImage } = require('../config.js')
const { postSlackMessage } = require('../util')
const execSync = require('child_process').execSync

const fit = function (cmd, osmExtract, src, dst) {
  process.stdout.write('fitting ' + src + '...\n')

  const dcmd = `docker pull ${dataToolImage}; docker run --rm -e TCMALLOC_LARGE_ALLOC_REPORT_THRESHOLD=2147483648 -v ${dataDir}:/data --rm ${dataToolImage} ${cmd} ${osmExtract} +init=epsg:3067 /${src} /${dst}`

  try {
    execSync(dcmd)
    return true
  } catch (e) {
    postSlackMessage(`Running command ${cmd} on ${src} failed :boom:`)
    return false
  }
}

module.exports = {
  fitGTFSTask: (gtfsMap, osm) => {
    return through.obj((file, encoding, callback) => {
      const gtfsFile = file.history[file.history.length - 1]
      const fileName = gtfsFile.split('/').pop()
      const relativeFilename = path.relative(process.cwd(), gtfsFile)
      const id = fileName.substring(0, fileName.indexOf('-gtfs'))
      const source = gtfsMap[id]
      if (!source) {
        process.stdout.write(`${gtfsFile} Could not find source for Id:${id}, ignoring fit...\n`)
        callback(null, null)
        return
      }
      if (!source.fit) {
        process.stdout.write(gtfsFile + ' fit skipped\n')
        callback(null, file)
        return
      }
      const osmFile = `${dataDir}/ready/osm/{osm[0].id}.pbf`
      if (!fs.existsSync(osmFile)) {
        process.stdout.write(`${osmFile} not available, skipping ${gtfsFile}\n`)
        callback(null, null)
        return
      }

      // use default script or string content
      const script = 'gtfs_shape_mapfit/fit_gtfs.bash &> /dev/null'
      const src = `${relativeFilename}`
      const dst = `${relativeFilename}-fitted`

      if (fit(script, osmFile, src, dst)) {
        fs.unlinkSync(src)
        fs.renameSync(dst, src)
        process.stdout.write(gtfsFile + ' fit SUCCESS\n')
        file.contents = cloneable(fs.createReadStream(gtfsFile))
        callback(null, file)
      } else {
        callback(null, null)
      }
    })
  }
}
