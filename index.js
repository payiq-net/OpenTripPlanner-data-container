const gulp = require('gulp')
require('./gulpfile')
const { promisify } = require('util')
const everySeries = require('async/everySeries')
const { execFileSync } = require('child_process')
const { postSlackMessage, updateSlackMessage } = require('./util')
const CronJob = require('cron').CronJob
const fs = require('fs')

const every = promisify((list, task, cb) => {
  everySeries(list, task, function (err, result) {
    cb(err, result)
  })
})

const start = promisify((task, cb) => gulp.series(task)(cb))

const updateDEM = ['dem:update']
const updateOSM = ['osm:update']
const updateGTFS = ['gtfs:dl', 'gtfs:fit', 'gtfs:filter', 'gtfs:id']

const router = process.env.ROUTER

if (!process.env.NOSEED) {
  start('seed').then(() => {
    process.stdout.write('Seeded.\n')
    if (process.argv.length === 3 && process.argv[2] === 'once') {
      process.stdout.write('Running update once.\n')
      update()
    } else {
      const cronPattern = process.env.CRON || '0 0 3 * * *'
      process.stdout.write(`Starting timer with pattern: ${cronPattern}\n`)
      new CronJob(cronPattern, update, null, true, 'Europe/Helsinki') // eslint-disable-line
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

  await every(updateDEM, function (task, callback) {
    start(task).then(() => { callback(null, true) })
  })

  for (let i = 0; i < 3; i++) {
    global.blobSizeOk = false // ugly hack but gulp does not return any values from tasks
    global.OTPacceptsFile = false

    await every(updateOSM, function (task, callback) {
      start(task).then(() => { callback(null, true) })
    })
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

  await every(updateGTFS, function (task, callback) {
    start(task).then(() => { callback(null, true) })
  })

  try {
    await start('router:buildGraph');
    process.stdout.write('Build docker image.\n')
    execFileSync('./build.sh', [router], {stdio: [0, 1, 2]})
    if (process.env.SKIPPED_SITES  === "all" ) {
      process.stdout.write('Skipping all tests')
    } else {
      process.stdout.write('Test docker image.\n')
      execFileSync(
        './test.sh',
        [router, process.env.OTP_TAG || 'v2', process.env.TOOLS_TAG || ''],
        {stdio: [0, 1, 2]}
      )
    }
    let hasFailures=false
    const logFile = 'failed_feeds.txt'

    if (fs.existsSync(logFile)) {
      hasFailures = true
      global.failedFeeds = fs.readdirSync(logFile)
      postSlackMessage(`GTFS packages ${global.failedFeeds} rejected, using old data`)

      // use seeded packages for failed feeds
      await start('gtfs:fallback')

      // rebuild the graph
      process.stdout.write('Rebuild graph using fallback data\n')
      await start('router:buildGraph')

      process.stdout.write('Rebuild docker image.\n')
      execFileSync('./build.sh', [router], {stdio: [0, 1, 2]})
    }
    process.stdout.write('Deploy docker image.\n')
    execFileSync('./deploy.sh', [router], {
      env: {
        DOCKER_USER: process.env.DOCKER_USER,
        DOCKER_AUTH: process.env.DOCKER_AUTH,
        DOCKER_TAG: process.env.DOCKER_TAG
      },
      stdio: [0, 1, 2]
    })
    if (osmError || hasFailures) {
      updateSlackMessage(`${router} data updated, but part of new data was rejected. :boom:`)
    } else {
      updateSlackMessage(`${router} data updated. :white_check_mark:`)
    }
  } catch (E) {
    postSlackMessage(`${router} data update failed: ` + E.message)
    updateSlackMessage('Something went wrong with the data update. More information in the reply. :boom:')
  }
}
