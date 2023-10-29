const gulp = require('gulp')
require('./gulpfile')
const { promisify } = require('util')
const { execFileSync } = require('child_process')
const { postSlackMessage, updateSlackMessage } = require('./util')
const CronJob = require('cron').CronJob
const fs = require('fs')
const { router } = require('./config')

const start = promisify((task, cb) => gulp.series(task)(cb))

if (!process.env.NOSEED) {
  start('seed').then(() => {
    process.stdout.write('Seeded.\n')
    if (process.env.CRON) {
      process.stdout.write(`Starting timer with pattern: ${process.env.CRON}\n`)
	new CronJob(process.env.CRON, update, null, true, 'Europe/Helsinki') // eslint-disable-line
    } else {
      update()
    }
  }).catch((err) => {
    process.stdout.write(err + '\n')
    process.exit(1)
  })
} else {
  update()
}

async function update () {
  const slackResponse = await postSlackMessage('Starting data build')
  if (slackResponse.ok) {
    global.messageTimeStamp = slackResponse.ts
  }

  await start('dem:update')

  for (let i = 0; i < 3; i++) {
    global.blobSizeOk = false // ugly hack but gulp does not return any values from tasks
    global.OTPacceptsFile = false

    await start('osm:update')

    if (global.blobSizeOk) {
      break
    }
    if (i < 2) {
      // sleep 10 mins before next attempt
      await new Promise(resolve => setTimeout(resolve, 600000))
    }
  }

  let osmError = false

  if (!global.OTPacceptsFile) {
    osmError = true
    postSlackMessage('OSM data update failed, using previous version :boom:')
  }

  await start('gtfs:update')

  const name = router.id
  try {
    await start('router:buildGraph')
    process.stdout.write('Build docker image.\n')
    execFileSync('./build.sh', [name], { stdio: [0, 1, 2] })
    if (process.env.SKIPPED_SITES === 'all') {
      process.stdout.write('Skipping all tests')
    } else {
      process.stdout.write('Test docker image.\n')
      execFileSync('./test.sh', [], { stdio: [0, 1, 2] })
    }
    let hasFailures = false
    const logFile = 'failed_feeds.txt'

    if (fs.existsSync(logFile)) {
      hasFailures = true

      // use seed packages for failed feeds
      global.failedFeeds = fs.readFileSync(logFile, 'utf8') // comma separated list of feed ids. No newline at end!
      postSlackMessage(`GTFS packages ${global.failedFeeds} rejected, using fallback to current data`)
      await start('gtfs:fallback')

      // rebuild the graph
      process.stdout.write('Rebuild graph using fallback data\n')
      await start('router:buildGraph')

      process.stdout.write('Rebuild docker image.\n')
      execFileSync('./build.sh', [name], { stdio: [0, 1, 2] })
    }
    process.stdout.write('Deploy docker image.\n')
    execFileSync('./deploy.sh', [name], { stdio: [0, 1, 2] })
    if (osmError || hasFailures) {
      updateSlackMessage(`${name} data updated, but part of new data was rejected. :boom:`)
    } else {
      updateSlackMessage(`${name} data updated. :white_check_mark:`)
    }
  } catch (E) {
    postSlackMessage(`${name} GTFS data update failed: ` + E.message)
    updateSlackMessage('Something went wrong with the data update. More information in the reply. :boom:')
  }
}
