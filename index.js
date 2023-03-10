const gulp = require('gulp')
const { setCurrentConfig } = require('./config')
require('./gulpfile')
const { promisify } = require('util')
const everySeries = require('async/everySeries')
const { execFileSync } = require('child_process')
const { postSlackMessage, updateSlackMessage } = require('./util')
const CronJob = require('cron').CronJob

const every = promisify((list, task, cb) => {
  everySeries(list, task, function (err, result) {
    cb(err, result)
  })
})

const start = promisify((task, cb) => gulp.series(task)(cb))

const updateDEM = ['dem:update']
const updateOSM = ['osm:update']
const updateGTFS = ['gtfs:dl', 'gtfs:fit', 'gtfs:filter', 'gtfs:id']

let routers
if (process.env.ROUTERS) {
  routers = process.env.ROUTERS.replace(/ /g, '').split(',')
} else {
  routers = ['finland', 'waltti', 'hsl', 'waltti-alt', 'varely']
}

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

async function update () {
  const slackResponse = await postSlackMessage('Starting data build', null)
  let messageTimeStamp
  if (slackResponse.ok) {
    messageTimeStamp = slackResponse.ts
  }

  setCurrentConfig(routers.join(',')) // restore used config

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
    postSlackMessage('OSM data update failed, using previous version :boom:', messageTimeStamp)
  }

  await every(updateGTFS, function (task, callback) {
    start(task).then(() => { callback(null, true) })
  })

  // postSlackMessage('GTFS data updated');

  await every(routers, function (router, callback) {
    // postSlackMessage(`Starting build & deploy for ${router}...`);
    setCurrentConfig(router)
    start('router:buildGraph').then(() => {
      try {
        process.stdout.write('Executing deploy script.\n')
        execFileSync('./deploy.sh', [router],
          {
            env:
              {
                DOCKER_USER: process.env.DOCKER_USER,
                DOCKER_AUTH: process.env.DOCKER_AUTH,
                DOCKER_TAG: process.env.DOCKER_TAG,
                TEST_TAG: process.env.OTP_TAG || '',
                TOOLS_TAG: process.env.TOOLS_TAG || '',
                SKIPPED_SITES: process.env.SKIPPED_SITES || ''
              },
            stdio: [0, 1, 2]
          }
        )
        if (osmError) {
          updateSlackMessage(`${router} data updated, but there was an error updating OSM data. :boom:`, messageTimeStamp)
        } else {
          updateSlackMessage(`${router} data updated. :white-check-mark:`, messageTimeStamp)
        }
      } catch (E) {
        postSlackMessage(`${router} data update failed: ` + E.message, messageTimeStamp)
        updateSlackMessage('Something went wrong with the data update. More information in the reply. :boom:', messageTimeStamp)
      }
      callback(null, true)
    })
  })

  // postSlackMessage('Data build completed');
}
