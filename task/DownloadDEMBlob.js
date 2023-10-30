const fs = require('fs')
const request = require('request')
const { dataDir } = require('../config')
const { postSlackMessage } = require('../util')

/**
 * Download DEM files from Azure blob storage.
 */
module.exports = function (entries) {
  return entries.map((entry) => {
    return new Promise((resolve, reject) => {
      const filePath = `${dataDir}/downloads/dem/${entry.id}.tif`
      const readyPath = `${dataDir}/ready/dem/${entry.id}.tif`
      let dataAlreadyExists = false
      let downloadSize
      let readySize
      if (fs.existsSync(readyPath)) {
        readySize = fs.statSync(readyPath).size
      }

      const r = request(entry.url)
      const stream = r.pipe(fs.createWriteStream(filePath))
      r.on('response', response => {
        if (response.statusCode === 200) {
          downloadSize = response.headers['content-length']
          if (readySize && readySize === parseInt(downloadSize)) {
            process.stdout.write(`Local DEM data for ${entry.id} was already up-to-date\n`)
            dataAlreadyExists = true
            // Abort download as remote has same size as local copy
            r.abort()
          } else {
            process.stdout.write(`Downloading new DEM data from ${entry.url}\n`)
          }
        }
      })
      r.on('error', err => {
        if (!dataAlreadyExists) {
          postSlackMessage(`${entry.url} download failed: ${JSON.stringify(err)} :boom:`)
          reject(err)
        } else {
          resolve()
        }
      })
      stream.on('finish', () => {
        // If new file was downloaded, this resolves with the file's path
        // This is also called when request is aborted but new call to resolve shouldn't do anything
        // However, if the file is really small, this could in theory be called before call to abort request
        // but that situation shouldn't happen with DEM data sizes.
        if (!dataAlreadyExists) {
          process.stdout.write(`Downloaded updated DEM data to ${filePath}\n`)
          fs.rename(filePath, readyPath, err => {
            if (err) {
              process.stdout.write(JSON.stringify(err))
              process.stdout.write(`Failed to move DEM data from ${readyPath}\n`)
              reject(err)
            } else {
              process.stdout.write(`DEM data updated for ${entry.id}\n`)
              resolve()
            }
          })
        } else {
          resolve()
        }
      })
    })
  })
}
