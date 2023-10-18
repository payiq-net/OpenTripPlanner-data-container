const execSync = require('child_process').execSync
const fs = require('fs')
const { router, dataDir } = require('../config.js')
const seedTag = process.env.SEED_TAG || 'latest'

/**
 * Download seed data from previous data containers.
 */
module.exports = function () {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(`${dataDir}/root`)) {
      fs.mkdirSync(`${dataDir}/root`)
    }
    try {
      const container = `hsldevcom/opentripplanner-data-container-${router.id}:${seedTag}`
      process.stdout.write(`extracting data from ${container}...\n`)
      const script =
       `cd ${dataDir}
        docker login -u ${process.env.DOCKER_USER} -p ${process.env.DOCKER_AUTH} || true;
        docker rmi --force ${container} || true;
        docker rm data-extract-${router.id} || true;
        docker rename data-extract-${router.id} $(date +%s) || true;
        docker create --name data-extract-${router.id} ${container};
        docker cp data-extract-${router.id}:var/www/localhost/htdocs/router-${router.id}.zip .;
        docker rm data-extract-${router.id}`

      execSync(script)
      execSync(
        `cd ${dataDir} && unzip -o router-${router.id}.zip`
      )
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}
