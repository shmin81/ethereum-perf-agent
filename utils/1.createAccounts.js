const fs = require('fs')
const { Web3 } = require('web3')
const utils = require('../common/utils')

let accountCounts = 10 // max: 999999

const DigitLength = 8
const PrePrivKeyFrom = '0x2023000000000000000000000000000000000000000000000000000000' // string
const PrePrivKeyTo = '0x2024000000000000000000000000000000000000000000000000000000' // string

const args = process.argv.slice(2)
if (args.length == 0) {
  console.log('node  1.createAccounts.js  numberOfAccounts(200)')
  process.exit(0)
}

//let confPath = args[0]
if (args.length == 1) {
  accountCounts = Number(args[0])
} else {
  console.log('wrong inputs')
  process.exit(1)
}

const pkListFile = `../configs/accounts_${accountCounts}.json`
if (fs.existsSync(pkListFile)) {
  console.log('Already existed.', pkListFile)
  process.exit(0)
}

const uniqueHexNum = accountCounts.toString(16)
const uniquelth = uniqueHexNum.length
const prefixlth = 66 - uniquelth - DigitLength
console.log('**', accountCounts, `0x${uniqueHexNum}`, uniquelth, prefixlth)

const conf = utils.loadConfig()
//console.log(JSON.stringify(conf))
const endpointConf = utils.loadJson(conf.endpointfile)
const httpRpcUrl = endpointConf[0]
console.log(`RPC: ${httpRpcUrl}`)

let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf))
const web3 = new Web3(httpProvider)

console.log('creating...', accountCounts, ' users')
utils.sleep(2000)

var writer = fs.createWriteStream(pkListFile)
writer.write('[{\n')

for (let i = 1; i < accountCounts; i++) {
  makeAcc(i)
  writer.write('}, {\n')
}

makeAcc(accountCounts)
writer.write('}]\n')

writer.end()
writer.on('finish', function () {
  console.log('finish')
})

function makeAcc(num) {
  let hexNum = num.toString(16)
  if (hexNum.length > DigitLength) {
    throw new Error('PrivKeyNum value is too big.')
  }
  while (hexNum.length < DigitLength) {
    hexNum = '0' + hexNum
  }

  let fromPrivKey = PrePrivKeyFrom.substring(0, prefixlth) + uniqueHexNum + hexNum
  console.log(fromPrivKey)
  let toPrivKey = PrePrivKeyTo.substring(0, prefixlth) + uniqueHexNum + hexNum
  let name = `  "name": "User-${num.toString().padStart(DigitLength, '0')}",\n`
  const account = web3.eth.accounts.privateKeyToAccount(fromPrivKey)
  let sender = `  "sender": "${account.address}",\n`
  let sPrivKey = `  "sPrivKey": "${fromPrivKey.substring(2)}",\n`
  const accountTo = web3.eth.accounts.privateKeyToAccount(toPrivKey)
  let receiver = `  "receiver": "${accountTo.address}",\n`
  let rprivKey = `  "rPrivKey": "${toPrivKey.substring(2)}"\n`

  writer.write(name)
  writer.write(sender)
  writer.write(sPrivKey)
  writer.write(receiver)
  writer.write(rprivKey)

  console.log(`User-${num.toString().padStart(DigitLength, '0')}`)
}
