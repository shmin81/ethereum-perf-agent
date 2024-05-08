const fs = require('fs')

const ERROR = (msg) => console.error(`${new Date().toISOString()} [ERROR] ${msg}`)
const INFO = (msg) => console.log(`${new Date().toISOString()} [INFO] ${msg}`)
const defaultConfigName = 'default.config.json'
const testConfigName = 'config.json'
const rootConfigDir = '../'
const defaultConfigDir = '../configs/'
const confPath = `${defaultConfigDir}${testConfigName}`

let baseConfig = null

exports.loadConfig = function () {
  if (!fs.existsSync(confPath)) {
    fs.copyFileSync(`${defaultConfigDir}${defaultConfigName}`, `${defaultConfigDir}${testConfigName}`)
  }
  return loadConf(confPath)
}

function loadConf(_confPath) {
  //console.log('loadConf', _confPath)
  if (checkPath(_confPath) != _confPath) {
    ERROR(`wrong config.json path ${_confPath}`)
    process.exit(1)
  }
  //let conf = getConfig(confPath, false)
  let confContent = fs.readFileSync(confPath, 'utf8')
  baseConfig = JSON.parse(confContent)
  if (baseConfig.ownerPrivKey == null) {
    baseConfig.ownerPrivKey = '8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63'
  } else if (baseConfig.ownerPrivKey.startsWith('0x')) {
    let kStr = baseConfig.ownerPrivKey.substring(2)
    baseConfig.ownerPrivKey = kStr
  }
  //console.log('loadedConf', baseConfig)
  return initConf(baseConfig)
}

// To Do: jwt ??
function initConf(_confObj) {
  if (_confObj.jwt != undefined && _confObj.jwt.length > 30) {
    _confObj.httpheaders = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _confObj.jwt }
  } else {
    _confObj.httpheaders = { 'Content-Type': 'application/json' }
  }
  return _confObj
}

exports.getweb3HttpHeader = function (conf) {
  const httpOptions = {
    headers: [{ name: 'Content-Type', value: 'application/json' }],
  }
  if (conf.jwt != undefined && conf.jwt.length > 30) {
    httpOptions.headers.push({ name: 'Authorization', value: 'Bearer ' + jwt_token })
  }
  return httpOptions
}

function checkPath(_confPath) {
  //console.log('checkPath', _confPath)
  if (fs.existsSync(_confPath)) {
    return _confPath
  }
  if (!_confPath.startsWith(rootConfigDir)) {
    if (fs.existsSync(rootConfigDir + _confPath)) {
      return rootConfigDir + _confPath
    }
    if (fs.existsSync(defaultConfigDir + _confPath)) {
      return defaultConfigDir + _confPath
    }
  }
  if (!_confPath.toString().toLowerCase().endsWith('.json')) {
    return checkPath(_confPath + '.json')
  }

  ERROR(`Not found: ${_confPath}`)
  //process.exit(1)
  return null
}

// accounts, endpoints 파일을 읽어온다.
exports.loadJson = function (path) {
  return loadJson(path)
}

function loadJson(path) {
  path = checkPath(path)
  if (path == null) {
    return null
  }
  const jsonContent = fs.readFileSync(path, 'utf8')
  return JSON.parse(jsonContent)
}

exports.sleep = function (ms) {
  const wakeUpTime = Date.now() + ms
  while (Date.now() < wakeUpTime) {}
}

const { Address } = require('@ethereumjs/util')
exports.convertPrivKeyToAccount = function (privkey) {
  if (privkey.indexOf('0x') == 0) {
    privkey = privkey.substring(2)
  }
  let privKeyBuf = Buffer.from(privkey, 'hex')
  let addressBuf = Address.fromPrivateKey(privKeyBuf)
  let address = addressBuf.toString('hex')
  return {
    address,
    privKeyBuf,
    privateKey: `0x${privkey}`,
  }
}

exports.getAgentManagers = function () {
  const addr = loadJson('sto.addresses.json')
  const priv = loadJson('sto.privatekeys.json')
  let managers = {
    adminAddr: addr.slice(0, 1),
    adminPriv: addr.slice(0, 1),
    issueAddr: addr.slice(1, 5),
    issuePriv: priv.slice(1, 5),
    ctrlAddr: addr.slice(0, 1)
  }
  managers.privKeyBytes = Buffer.from(managers.adminPriv, 'hex')
  return managers
}

exports.getAgentIssuers = function (minerIdx) {
  const addr = loadJson('sto.addresses.json')
  const priv = loadJson('sto.privatekeys.json')
  let issuer = {
    address: addr[minerIdx + 1],
    privKey: priv[minerIdx + 1]
  }
  issuer.privKeyBytes = Buffer.from(issuer.privKey, 'hex')
  return issuer
}

exports.getCurrentTimeStr = function () {
  let date = new Date()
  date.setHours(date.getUTCHours() + 9) // UTC -> KST

  let year = date.getFullYear()
  let month = addZero(date.getMonth() + 1)
  let day = addZero(date.getDate())
  let hour = addZero(date.getHours())
  let minute = addZero(date.getMinutes())
  //let second = addZero(date.getSeconds())
  //let currentTime = `${year}${month}${day}_${hour}${minute}${second}`
  let currentTime = `${year}${month}${day}_${hour}${minute}`
  return currentTime
}
function addZero(num) {
  if (num < 10) {
    return `0${num}`
  }
  return num
}

exports.getLoggingItemInterval = function (_targetCnt) {
  //console.log('targetCnt', targetCnt)
  let targetCnt = Number(_targetCnt)
  if (targetCnt < 10) {
    return 1
  } else if (targetCnt <= 50) {
    return Math.floor(targetCnt / 5) // 20 %
  } else if (targetCnt <= 250) {
    return Math.floor(targetCnt / 7) // 14 %
  } else if (targetCnt <= 2000) {
    return Math.floor(targetCnt / 10) // 10 %
  } else if (targetCnt <= 10000) {
    return Math.floor(targetCnt / 25) // 4 %
  } else if (targetCnt <= 200000) {
    return Math.floor(targetCnt / 50) // 2 %
  } else {
    return Math.ceil(targetCnt / 100) // 1 %
  }
}
// ###########################

function updateAndReloadConfig() {
  if (confPath != null) {
    let outStr = JSON.stringify(baseConfig, null, 2)
    fs.writeFileSync(confPath, outStr)
    return loadConf(confPath)
  }
}

exports.updateTestOpts = function (startEndpointIdx, startAccountIdx, numberOfAccounts) {
  baseConfig.startEndpointIdx = startEndpointIdx
  baseConfig.startAccountIdx = startAccountIdx
  baseConfig.numberOfAccounts = numberOfAccounts
  return updateAndReloadConfig()
}

exports.updateEndpointFile = function (endpointfilename) {
  baseConfig.endpointfile = endpointfilename
  return updateAndReloadConfig()
}

exports.updateAccountFile = function (accountfilename) {
  baseConfig.accountfile = accountfilename
  return updateAndReloadConfig()
}

exports.deployNewContract = function (testcase, contractAddress, transactionHash = null) {
  //console.log('before deployNewContract: ', JSON.stringify(baseConfig, null, 2))
  let propertyName = `${testcase}Address`
  let propertyHashName = `${testcase}TxHash`
  baseConfig[propertyName] = contractAddress
  baseConfig[propertyHashName] = transactionHash

  // if (transactionHash != undefined && transactionHash != null) {
  //   conf[propertyHashName] = transactionHash
  // }
  // else {
  //   // 없는데 삭제해도 될까??
  //   // delete conf[propertyHashName]
  //   conf[propertyHashName] = ""
  // }

  //console.log('after  deployNewContract: ', JSON.stringify(baseConfig, null, 2))
  return updateAndReloadConfig()
}

exports.prepareTestcase = function (testcase, args) {
  if (args.length < 3) {
    console.log(`node  workerNode.${testcase}.js  portNumber  minerIdx  accountStartIdx accountCount [ chkContract(true) debug(false) ]`)
    process.exit(0)
  }
  const setting = {}
  setting.port = Number(args[0])
  setting.minerIdx = Number(args[1])
  setting.startIdx = Number(args[2])
  setting.acountCnt = Number(args[3])

  // Configurations from file
  const configObj = loadConf(confPath)
  // account
  setting.accountConf = loadJson(configObj.accountfile)
  let endpointConf = loadJson(configObj.endpointfile)
  let httpRpcUrl = endpointConf[setting.minerIdx]

  setting.chkDeployedContract = true
  if (args.length > 4) {
    if (args[4].toLowerCase() === 'false') {
      setting.chkDeployedContract = false
    }
  }

  setting.saveLog = false
  if (args.length == 6) {
    if (args[5].toLowerCase() === 'true') {
      setting.saveLog = true
    }
  }
  return { setting, httpRpcUrl, configObj }
}

exports.responseJson = async function (res, respData = { result: true }, statusCode = 200) {
  res.status(statusCode)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json(respData)
  if (respData.result == false || statusCode != 200) {
    INFO(JSON.stringify(respData))
  }
}

exports.responseTestSuccessJson = async function (res, respData) {
  res.status(200)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json(respData)
}

exports.responseTestSuccessJsonTxid = async function (res, txid) {
  res.status(200)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json({ result: true, txid })
}

exports.responseTestErrorJson = async function (res, respData) {
  res.status(500)
  res.set('Content-Type', 'application/json;charset=utf8')
  res.json(respData)
}
