const through = require('through2')

module.exports = {
  renameGTFSFile: () => {
    return through.obj(function (file, encoding, callback) {
      if (!file.stem.includes('-gtfs')) {
        file.stem = file.stem + '-gtfs'
      }
      callback(null, file)
    })
  }
}
