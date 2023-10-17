const fs = require('fs')
const through = require('through2')
const path = require('path');
const JSZip = require('jszip');


function moveFilesFromCache(zipFile, folderPath, filesToAdd) {
    const p = new Promise((resolve, reject) => {
    const Azip = new JSZip();
    fs.readFile(zipFile, function(err,data) {
        if(err) {
            process.stdout.write('Error reading file: ', err)
        }
    Azip.loadAsync(data).then((zip) => {
    filesToAdd.forEach((file) => {
        const filePath = `/tmp/${file}`;

        const fileData = fs.readFileSync(filePath);
        if(fileData)  {
            zip.file(`HSL-gtfs/${file}`, fileData);
        }

      });
      zip.generateAsync({ type: 'nodebuffer' }).then((content) => {
        fs.writeFileSync(`${folderPath}/HSL-gtfs.zip`, content);
        resolve()

      }).catch(e => reject(e));
    })
    })
})
    return p
}
function store(filePath, filesToExtract) {
    if(filePath) {
        const zip = new JSZip();
        zip.loadAsync(fs.readFileSync(filePath)).then(() => {
            const promises =  filesToExtract.map(fileName => {
            const file = Object.keys(zip.files).find((name) => name.endsWith(`/${fileName}`));
            if (file) {
                zip.file(file).async('nodebuffer').then((fileData) => {
                    fs.writeFileSync(`/tmp/${fileName}`, fileData);
                    process.stdout.write('File extracted and moved to /tmp/');
                });
            } else {
                process.stdout.write('File not found in archive.');
                return Promise.resolve();
            }
        });

        return Promise.all(promises)

        })
        
        return Promise.resolve(false)
    } else {
        process.stdout.write('No file ', filePath, ' found')
        return Promise.resolve(false)
    }
    }

module.exports = {
    moveTask: (cacheFiles, cache, dataDir) => {
        if(!cache) {
            return through.obj(function (file, encoding, callback) {
                const folderPath = `${dataDir}${path.basename(file.history[file.history.length - 1])}`
                moveFilesFromCache(folderPath,dataDir,cacheFiles).then(() => {
                    //TODO REMOVE TEMP?
                callback(null, file)
            })
        }
    )}
        return through.obj(function (file, encoding, callback) {
            let localFile = file.history[file.history.length - 1]
            store(localFile, cacheFiles).then( () => callback(null, file))
        })
    }
}
