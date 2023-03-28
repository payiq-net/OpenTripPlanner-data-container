const through = require('through2')
const JSZip = require('jszip')
const { postSlackMessage } = require('../util')

const replaceGTFSFiles = (fileContents, replacements, fileName, cb) => {
  const zip = new JSZip()
  zip.loadAsync(fileContents).then(function () {
    const promises = []
    zip.forEach((relativePath, file) => {
      const replacementFile = replacements[relativePath]
      // No replacement file defined, remove the file
      if (replacementFile === null) {
        promises.push(new Promise((resolve, reject) => {
          zip.remove(relativePath)
          process.stdout.write(`Removed ${relativePath} from ${fileName}\n`)
          resolve()
        }))
      } else if (replacementFile !== undefined) {
        // Replacement file defined, replace the file with the defined file
        // and remove the defined replacement file
        promises.push(new Promise((resolve, reject) => {
          const replacementZipFile = zip.file(replacementFile)
          if (!replacementZipFile) {
            const errorMessage =
              `${replacementFile} was defined to replace ${relativePath} but ${replacementFile} doesn't exist in ${fileName}`
            postSlackMessage(errorMessage)
            reject(new Error(errorMessage))
          } else {
            zip.file(replacements[relativePath])
              .async('string')
              .then((data) => {
                zip.file(relativePath, data)
                zip.remove(replacementFile)
                process.stdout.write(
                  `Replaced ${relativePath} from ${fileName} with ${replacementFile}\n`)
                resolve()
              })
              .catch((err) => {
                const errorMessage =
                  `${replacementFile} was defined to replace ${relativePath} but ${replacementFile} in ${fileName} but the operation failed\n ${err}`
                postSlackMessage(errorMessage)
                reject(err)
              })
          }
        }))
      }
    })
    Promise.all(promises)
      .then(() => cb(undefined, zip.generateNodeStream()))
      .catch((err) => cb(err, undefined))
  }).catch((err) => {
    postSlackMessage(`GTFS file replacement operation failed for ${fileName}\n ${err}`)
    cb(err, undefined)
  })
}

module.exports = {
  replaceGTFSFilesTask: (configMap) => {
    return through.obj(function (file, encoding, callback) {
      const gtfsFile = file.history[file.history.length - 1]
      const fileName = gtfsFile.split('/').pop()
      const id = fileName.indexOf('.zip') > 0 ? fileName.substring(0, fileName.indexOf('.zip')) : fileName
      process.stdout.write('replace id =' + id)
      const config = configMap[id]
      const replacements = config ? config.replacements : null
      if (!replacements) {
        callback(null, file)
      } else {
        replaceGTFSFiles(file.contents, replacements, fileName, (err, newContents) => {
          if (newContents) {
            file.contents = newContents
            callback(null, file)
          } else {
            callback(err, null)
          }
        })
      }
    })
  }
}
