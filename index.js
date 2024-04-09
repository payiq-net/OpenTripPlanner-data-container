const { postSlackMessage } = require('./util')

startBuild()

async function startBuild () {
  postSlackMessage('Starting data build').then(response => {
    if (response.ok) {
      global.messageTimeStamp = response.ts
    }
    const { update } = require('./task/Update')
    update()
  }).catch((err) => {
    console.log(err)
    const { update } = require('./task/Update')
    update()
  })
}
