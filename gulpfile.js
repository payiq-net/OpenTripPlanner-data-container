const fs = require('fs')
const { execSync } = require('child_process')
const gulp = require('gulp')
const dl = require('./task/Download')
const dlBlob = require('./task/DownloadDEMBlob')
const { setFeedIdTask } = require('./task/SetFeedId')
const { OBAFilterTask } = require('./task/OBAFilter')
const { fitGTFSTask } = require('./task/MapFit')
const { validateBlobSize } = require('./task/BlobValidation')
const { testOTPFile } = require('./task/OTPTest')
const seed = require('./task/Seed')
const prepareRouterData = require('./task/PrepareRouterData')
const del = require('del')
const config = require('./config')
const { buildOTPGraphTask } = require('./task/BuildOTPGraph')
const { renameGTFSFile } = require('./task/GTFSRename')
const { replaceGTFSFilesTask } = require('./task/GTFSReplace')
const { moveTask } = require('./task/MoveTask')

const seedSourceDir = `${config.dataDir}/router-${config.router.id}` // e.g. data/router-hsl

/**
 * Download and test new osm data
 */
gulp.task('osm:update', () =>
  dl(config.osm)
    .pipe(gulp.dest(`${config.dataDir}/downloads/osm`))
    .pipe(validateBlobSize())
    .pipe(testOTPFile())
    .pipe(gulp.dest(`${config.dataDir}/ready/osm`)))

/**
 * Download and test new dem data
 */
gulp.task('dem:update', () => {
  if (!config.dem) {
    return Promise.resolve()
  }
  const demDownloadDir = `${config.dataDir}/downloads/dem/`
  if (!fs.existsSync(demDownloadDir)) {
    execSync(`mkdir -p ${demDownloadDir}`)
  }
  const demReadyDir = `${config.dataDir}/ready/dem/`
  if (!fs.existsSync(demReadyDir)) {
    execSync(`mkdir -p ${demReadyDir}`)
  }
  return Promise.all(dlBlob(config.dem)).catch(err => { throw err })
})

gulp.task('del:filter', () => del(`${config.dataDir}/filter`))
gulp.task('del:fit', () => del(`${config.dataDir}/fit`))
gulp.task('del:id', () => del(`${config.dataDir}/id`))

/**
 * 1. download
 * 2. name zip as <id>-gtfs.zip (in dir 'download')
 * 3. test zip with OpenTripPlanner
 * 4. copy to fit dir if test is succesful
 */
gulp.task('gtfs:dl', gulp.series('del:fit', () => dl(config.router.src)
  .pipe(replaceGTFSFilesTask(config.gtfsMap))
  .pipe(renameGTFSFile())
  .pipe(gulp.dest(`${config.dataDir}/downloads/gtfs`))
  .pipe(testOTPFile())
  .pipe(gulp.dest(`${config.dataDir}/fit/gtfs`))
))

// Add feedId to gtfs files in id dir, and moves files to directory 'ready'
gulp.task('gtfs:id', () => gulp.src(`${config.dataDir}/id/gtfs/*`)
  .pipe(setFeedIdTask())
  .pipe(gulp.dest(`${config.dataDir}/ready/gtfs`)))

// Run MapFit on gtfs files (based on config) and moves files to directory 'filter'
gulp.task('gtfs:fit', gulp.series('del:filter',
  () => gulp.src(`${config.dataDir}/fit/gtfs/*`)
    .pipe(fitGTFSTask(config.gtfsMap, config.osm))
    .pipe(gulp.dest(`${config.dataDir}/filter/gtfs`))))

gulp.task('copyRules', () =>
  gulp.src(`${config.router.id}/gtfs-rules/*`).pipe(gulp.dest(`${config.dataDir}/${config.router.id}/gtfs-rules`))
)

// Filter gtfs files and move result to directory 'id'
gulp.task('gtfs:filter', gulp.series(
  'copyRules',
  () => gulp.src(`${config.dataDir}/filter/gtfs/*.zip`)
    .pipe(moveTask(config.passOBAfilter, true, config.dataDir))
    .pipe(OBAFilterTask(config.gtfsMap))
    .pipe(moveTask(config.passOBAfilter, false, config.dataDir)),
  () => gulp.src(`${config.dataDir}/filter/gtfs/*.zip`).pipe(gulp.dest(`${config.dataDir}/id/gtfs`))
))

gulp.task('gtfs:update', gulp.series('gtfs:dl', 'gtfs:fit', 'gtfs:filter', 'gtfs:id'))

// move listed packages from seed to ready
gulp.task('gtfs:fallback', () => {
  const sources = global.failedFeeds.split(',').map(feed => `${config.dataDir}/seed/gtfs/${feed}-gtfs.zip`)
  return gulp.src(sources).pipe(gulp.dest(`${config.dataDir}/ready/gtfs`))
})

gulp.task('gtfs:del', () => del([`${config.dataDir}/seed/gtfs`, `${config.dataDir}/ready/gtfs`]))

gulp.task('gtfs:seed', gulp.series('gtfs:del',
  () => gulp.src(`${seedSourceDir}/*-gtfs.zip`).pipe(gulp.dest(`${config.dataDir}/seed/gtfs`)).pipe(gulp.dest(`${config.dataDir}/ready/gtfs`))))

gulp.task('osm:del', () => del(`${config.dataDir}/ready/osm`))

gulp.task('osm:seed', gulp.series('osm:del',
  () => gulp.src(`${seedSourceDir}/*.pbf`).pipe(gulp.dest(`${config.dataDir}/ready/osm`))))

gulp.task('dem:del', () => del(`${config.dataDir}/ready/dem`))

gulp.task('dem:seed', gulp.series('dem:del',
  () => gulp.src(`${seedSourceDir}/*.tif`).pipe(gulp.dest(`${config.dataDir}/ready/dem`))))

gulp.task('seed:cleanup', () => del([seedSourceDir, `${config.dataDir}/*.zip`]))

/**
 * Seed DEM, GTFS & OSM data with data from previous data-containes to allow
 * continuous flow of data into production when one or more updated data files
 * are broken.
 */
gulp.task('seed', gulp.series(seed, 'dem:seed', 'osm:seed', 'gtfs:seed', 'seed:cleanup'))

gulp.task('router:del', () => del(`${config.dataDir}/build`))

gulp.task('router:copy', gulp.series('router:del',
  () => prepareRouterData(config.router).pipe(gulp.dest(`${config.dataDir}/build/${config.router.id}`))))

gulp.task('router:buildGraph', gulp.series('router:copy', () => {
  gulp.src(['otp-data-container/*', 'otp-data-container/.dockerignore']).pipe(gulp.dest(`${config.dataDir}/build/${config.router.id}`))
  return buildOTPGraphTask(config.router)
}))
