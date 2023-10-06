const through = require('through2')
const Vinyl = require('vinyl')
const execSync = require('child_process').execSync
const fs = require('fs')
const JSZip = require('jszip')
const seedTag = process.env.SEED_TAG || 'latest'

/**
 * Download seed data from previous data containers.
 */
module.exports = function (config, regexp) {
  var stream = through.obj()

  let toProcess = 1;
  const container = `hsldevcom/opentripplanner-data-container-${config.id}:${seedTag}`
  process.stdout.write(`extracting data from ${container}...\n`)
  const script =
 `docker login -u ${process.env.DOCKER_USER} -p ${process.env.DOCKER_AUTH} || true;
  docker rmi --force ${container} || true;
  docker rm data-extract-${config.id} || true;
  docker rename data-extract-${config.id} $(date +%s) || true; 
  docker create --name data-extract-${config.id} ${container};
  docker cp data-extract-${config.id}:var/www/localhost/htdocs/router-${config.id}.zip .;
  docker rm data-extract-${config.id}`
  execSync(script)
  const file = `router-${config.id}.zip`
  fs.readFile(file, function (err, data) {
    if (err) {
      process.stdout.write(err)
      throw err
    }
    JSZip.loadAsync(data).then(function (zip) {
      const zips = zip.file(regexp)
      if (!zips || zips.length === 0) {
        stream.end()
      } else {
        toProcess += zips.length
        toProcess -= 1
        zips.forEach(f => {
          const fileName = f.name.split('/').pop()
          f.async('arraybuffer').then(data => {
            const file = new Vinyl({ path: fileName, contents: Buffer.from(data) })
            stream.push(file)
            toProcess -= 1
            process.stdout.write(fileName + ' Seed SUCCESS\n')
            if (toProcess === 0) {
              stream.end()
            }
          })
        })
      }
    })
  })

  return stream
}
