/*
Executes gulp tasks which download new data, builds and tests a new graph and deploys a data container containing the results.
Data errors are detected and tolerated to a certain limit thanks to fallback mechanism to older data.
Unexpected code execution errors and failures in graph build abort the data loading.
*/
const gulp = require('gulp')
const { promisify } = require('util')
const { execFileSync } = require('child_process')
const fs = require('fs')
const { postSlackMessage, updateSlackMessage } = require('../util')
require('../gulpfile')
const { router } = require('../config')

const MAX_GTFS_FALLBACK = 2 // threshold for aborting data loading

const start = promisify((task, cb) => gulp.series(task)(cb))

async function update () {
  if (!process.env.NOSEED) {
    await start('seed')
    process.stdout.write('Seeded\n')
  }

  // we track data rejections using this global variable
  global.hasFailures = false
  await start('dem:update')
  if (global.hasFailures) {
    postSlackMessage('DEM update failed, using previous version :boom:')
  }

  // OSM update is more complicated. Download often fails, so there is a retry loop,
  //  which breaks when a big enough file gets loaded
  global.blobSizeOk = false // ugly hack but gulp does not return any values from tasks
  for (let i = 0; i < 3; i++) {
    await start('osm:update')
    if (global.blobSizeOk) {
      break
    }
    if (i < 2) {
      // sleep 10 mins before next attempt
      await new Promise(resolve => setTimeout(resolve, 600000))
    }
  }
  if (!global.blobSizeOk) {
    global.hasFailures = true
    postSlackMessage('OSM data update failed, using previous version :boom:')
  }

  const name = router.id
  try {
    await start('gtfs:update')

    process.stdout.write('Build routing graph\n')
    await start('router:buildGraph')

    process.stdout.write('Build docker image\n')
    execFileSync('./build.sh', [name], { stdio: [0, 1, 2] })

    if (process.env.SKIPPED_SITES === 'all') {
      process.stdout.write('Skipping all tests')
    } else {
      process.stdout.write('Test docker image\n')
      execFileSync('./test.sh', [], { stdio: [0, 1, 2] })
    }

    const logFile = 'failed_feeds.txt'
    if (fs.existsSync(logFile)) { // testing detected routing problems
      global.hasFailures = true

      global.failedFeeds = fs.readFileSync(logFile, 'utf8') // comma separated list of feed ids. No newline at end!
      fs.unlinkSync(logFile) // cleanup for local use

      if (global.failedFeeds.split(',').length > MAX_GTFS_FALLBACK) {
        updateSlackMessage('Aborting the data update because too many quality tests failed :boom:')
        process.exit(1)
      }

      postSlackMessage(`GTFS packages ${global.failedFeeds} rejected, using fallback to current data`)
      // use seed packages for failed feeds
      await start('gtfs:fallback')

      // rebuild the graph
      process.stdout.write('Rebuild graph using fallback data\n')
      await start('router:buildGraph')

      process.stdout.write('Rebuild docker image\n')
      execFileSync('./build.sh', [name])
    }
    process.stdout.write('Deploy docker image\n')
    execFileSync('./deploy.sh', [name], { stdio: [0, 1, 2] })

    if (global.hasFailures) {
      updateSlackMessage(`${name} data updated, but partially falling back to older data :boom:`)
    } else {
      updateSlackMessage(`${name} data updated :white_check_mark:`)
    }
  } catch (err) {
    postSlackMessage(`${name} data update failed: ` + err.message)
    updateSlackMessage('Something went wrong with the data update :boom:')
  }
}

module.exports = {
  update
}
