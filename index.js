const { promisify } = require('util')

const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const uuid = require('node-uuid')
const authenticate = require('mm-authenticate')(mongoose)
const { Team, Script, Log } = require('mm-schemas')(mongoose)
const { send, buffer } = require('micro')

mongoose.connect(process.env.MONGO_URL)
mongoose.Promise = global.Promise

const s3 = new AWS.S3({
  params: { Bucket: 'mechmania' }
})

const upload = promisify(s3.upload.bind(s3))

module.exports = authenticate(async (req, res) => {
  const urlParams = req.url.split('/')
  if(urlParams.length !== 3) {
    return send(res, 400, 'Malformed URL')
  }
  const [_, ...teamNames] = urlParams

  // Find team
  const [team1, team2] = await Promise.all(teamNames.map(name => Team.findOne({name}).exec()))

  if(!team1) {
    return send(res, 404, `Team ${team1} not found`)
  }
  if(!team2) {
    return send(res, 404, `Team ${team2} not found`)
  }
  if(!(team1.canBeAccessedBy(req.user) || team2.canBeAccessedBy(req.user))) {
    return send(res, 401, 'Unauthorized')
  }

  // Pipe file to s3
  const body = await buffer(req)
  const scriptName = uuid.v4()
  const key = 'logs/' + scriptName

  const data = await upload({
    Key: key,
    Body: body
  })

  // Add URL to mongo
  const logFile = new Log({
    key,
    url: data.Location,
    players: [team1, team2], 
    index: teamNames.sort().join('-')
  })
  await logFile.save()
  
  send(res, 200, data)
})