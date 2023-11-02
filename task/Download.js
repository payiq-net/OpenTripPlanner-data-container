const through = require('through2')
const request = require('request')
const Vinyl = require('vinyl')
const { postSlackMessage } = require('../util')

/**
 * Download external data (gtfs, osm) resources.
 */
module.exports = function (entries) {
  let downloadCount = 0

  const stream = through.obj()

  const incProcessed = () => {
    downloadCount += 1
    if (downloadCount !== entries.length) {
      downloadIgnoreErrors(entries[downloadCount])
    } else {
      stream.end()
    }
  }

  const downloadIgnoreErrors = (entry) => {
    const downloadHandler = (err, res, body) => {
      if (err || res.statusCode !== 200) {
        postSlackMessage(`${entry.url} Download failed: ${err} :boom:`)
        incProcessed()
        return
      }
      const name = entry.url.split('/').pop()
      const fileExt = name.indexOf('.') > 0 ? '.' + name.split('.').pop() : ''
      const file = new Vinyl({ path: `${entry.id !== undefined ? (entry.id + fileExt) : name}`, contents: Buffer.from(body) })
      process.stdout.write(entry.url + ' Download SUCCESS\n')
      stream.push(file)
      incProcessed()
    }

    process.stdout.write('Downloading ' + entry.url + '...\n')
    const r = {
      url: entry.url,
      encoding: null,
      ...entry.requestOptions
    }

    request(r, downloadHandler)
  }
  downloadIgnoreErrors(entries[0])

  return stream
}
