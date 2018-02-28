const { promisify } = require('util')

const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const uuid = require('node-uuid')
const { Team, Script, Log } = require('mm-schemas')(mongoose)
const { send, buffer } = require('micro')

mongoose.connect(process.env.MONGO_URL)
mongoose.Promise = global.Promise

const s3 = new AWS.S3({
  params: { Bucket: 'mechmania' }
})

const upload = promisify(s3.upload.bind(s3))

module.exports = async (req, res) => {
  const urlParams = req.url.split('/')
  if(urlParams.length !== 3) {
    send(res, 400, 'Malformed URL')
    return
  }
  const [_, ...teamNames] = urlParams

  // Find team
  const [team1, team2] = await Promise.all(teamNames.map(name => Team.findOne({name}).exec()))

  if(!team1) {
    send(res, 404, `Team ${team1} not found`)
    return;
  }
  if(!team2) {
    send(res, 404, `Team ${team2} not found`)
    return;
  }

  // Pipe file to s3
  const body = await buffer(req)
  const scriptName = uuid.v4();

  const data = await upload({
    Key: 'logs/' + scriptName,
    Body: body
  })

  // Add URL to mongo
  const logFile = new Log({
    url: data.Location,
    players: [team1, team2], 
    index: teamNames.sort().join('-')
  })
  await logFile.save()
  
  send(res, 200, data)
}