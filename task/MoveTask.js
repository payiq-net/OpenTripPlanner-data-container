const fs = require('fs')
const through = require('through2')
const path = require('path')
const JSZip = require('jszip')
const del = require('del')

/**
* Moves files from cache to a zip file.
* @param {string} zipFile - The path to the zip file.
* @param {string} dataDir - The path to the data directory.
* @param {string[]} filesToAdd - An array of filenames to add to the zip file.
* @returns {Promise} A Promise that resolves when the operation is complete.
*/
function restoreFiles (zipFile, dataDir, filesToAdd) {
  const p = new Promise((resolve, reject) => {
    const newZip = new JSZip()
    fs.readFile(zipFile, function (err, data) {
      if (err) {
        process.stdout.write('Error reading file: ', err)
        reject(err)
      } else {
        newZip.loadAsync(data).then((zip) => {
          filesToAdd.forEach((file) => {
            try {
              const filePath = `${dataDir}/tmp/${file}`
              const folder = path.parse(zipFile).name
              const fileData = fs.readFileSync(filePath)
              if (fileData) {
                zip.file(`${folder}/${file}`, fileData)
              }
            } catch (e) {
              resolve(e)
            }
          })
          const zFileName = path.basename(zipFile)
          zip.generateAsync({ type: 'nodebuffer' }).then((content) => {
            fs.writeFileSync(zipFile, content)
            resolve()
          }).catch(e => reject(e))
        })
      }
    })
  })
  return p
}

/**
 * Extracts files from a zip archive and saves them to disk.
 * @param {string} filePath - The path to the zip archive.
 * @param {string[]} filesToExtract - An array of filenames to extract from the archive.
 * @param {string} dataDir - The path to the data directory.
 * @returns {Promise} A Promise that resolves when the operation is complete.
 */
function backupFiles (filePath, filesToExtract, dataDir) {
  if (filePath) {
    const zip = new JSZip()
    zip.loadAsync(fs.readFileSync(filePath)).then(() => {
      const promises = filesToExtract.map(fileName => {
        const file = Object.keys(zip.files).find((name) => name.endsWith(`${fileName}`))
        if (file) {
          zip.file(file).async('nodebuffer').then((fileData) => {
            fs.writeFileSync(`${dataDir}/tmp/${fileName}`, fileData)
            process.stdout.write('File extracted and moved to /tmp/')
          })
        } else {
          process.stdout.write('File not found in archive.')
          return Promise.resolve()
        }
      })
      return Promise.all(promises)
    })

    return Promise.resolve(false)
  } else {
    process.stdout.write('No file ', filePath, ' found')
    return Promise.resolve(false)
  }
}

module.exports = {
  moveTask: (passOBAfilter, cache, dataDir) => {
    if (!passOBAfilter.length) {
      return through.obj(function (file, encoding, callback) {
        callback(null, file)
      })
    }
    if (!cache) {
      return through.obj(function (file, encoding, callback) {
        const localFile = file.history[file.history.length - 1]
        restoreFiles(localFile, dataDir, passOBAfilter).then(() => {
          del([`${dataDir}/tmp/**`])
          callback(null, file)
        })
      }
      )
    }

    return through.obj(function (file, encoding, callback) {
      // Create a temp fle for files to be cached.
      if (!fs.existsSync(`${dataDir}/tmp`)) {
        fs.mkdirSync(`${dataDir}/tmp`)
      }

      const localFile = file.history[file.history.length - 1]
      backupFiles(localFile, passOBAfilter, dataDir).then((status) => {
        callback(null, file)
      })
    })
  }
}
