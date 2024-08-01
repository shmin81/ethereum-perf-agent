const fs = require('fs')
const Web3Utils = require('web3-utils')
const utils = require('../common/utils')
const httpUtil = require('../common/httpUtil')
const support = require('../common/support')

const DEBUG = (msg) => {
  console.log(`${new Date().toISOString()} [DEBUG] ${msg}`)
}

const INFO = (msg) => {
  msgs.push(`[INFO] ${msg}\n`)
  console.log(`${new Date().toISOString()} [INFO] ${msg}`)
}

const ERROR = (msg) => {
  msgs.push(`[ERROR] ${msg}\n`)
  console.error(`${new Date().toISOString()} [ERROR] ${msg}`)
}

let portNumber = 0 // sub-process of agent
let targetUrl = '' // besu node
let agentIdx = 0 // index of agent and besu node
exports.set = function (_url, _port, _agentIdx) {
  targetUrl = _url
  portNumber = _port
  agentIdx = _agentIdx
}

exports.postSend = async function (req, res) {
  DEBUG(`send(POST) - ${req.originalUrl}`)

  try {
    let _url = req.originalUrl
    _url = _url.toString().replace(`/send/`, `/`)
    //DEBUG(`postSend ${req.url} -> ${_url}`)
    _url = `http://localhost:${portNumber}${_url}`
    let reqObj = httpUtil.getPostRequest(_url, 'test')
    reqObj.timeout = 600000
    let resultObj = await httpUtil.sendHttpPost(reqObj)
    utils.responseJson(res, resultObj)
  } catch (err) {
    utils.responseJson(res, { result: false, message: err })
  }
}

exports.getSend = async function (req, res) {
  DEBUG(`send(GET) - ${req.originalUrl}`)

  try {
    let _url = req.originalUrl
    _url = _url.toString().replace(`/send/`, `/`)
    _url = `http://localhost:${portNumber}${_url}`
    //DEBUG(`getSend ${req.url} -> ${_url}`)
    let resultObj = await httpUtil.sendHttpGet(_url)
    utils.responseJson(res, resultObj)
  } catch (err) {
    utils.responseJson(res, { result: false, message: err })
  }
}

exports.controlGetMsg = async function (req, res) {
  let show = true
  let params = req.params
  try {
    //DEBUG(`/message: ${JSON.stringify(params)} port:${portNumber} / ${targetUrl}`)
    let cmd = params.cmd
    switch (cmd) {
      case 'log':
        show = false
        getLogs(req, res)
        break
      case 'txpool':
        show = false
        txpool(req, res)
        break
      case 'blockTxCount':
        show = false
        getBlockTxCnt(req, res, params.param1)
        break
      case 'blockNumber':
        getBlockNumber(req, res)
        break
      case 'blockInterval':
        getBlockInterval(req, res)
        break
      case 'result':
        testResult(req, res)
        break
      case 'verify':
        testVerify(req, res)
        break
      case 'removeLogs':
        removeLogs(req, res)
        break
      default:
        utils.responseJson(res, { result: false, message: `Wrong command ${cmd}` })
    }
  } catch (err) {
    show = true
    utils.responseTestErrorJson(res, { result: false, message: err })
  }
  if (show) {
    DEBUG(`/message: ${JSON.stringify(params)} port:${portNumber} / ${targetUrl}`)
  }
}

exports.controlGetBesu = async function (req, res) {
  try {
    let params = req.params
    DEBUG(`/besu: ${JSON.stringify(params)} ${targetUrl}`)

    toBesu(req, res, params.api, params.paramArr)
  } catch (err) {
    utils.responseTestErrorJson(res, { result: false, message: err })
  }
}

let msgs = []
exports.appendLog = function (msg) {
  msgs.push(msg)
}

// 로그 수가 너무 많으면 과거 로그 일부를 삭제
exports.logCacheRebase = function () {
  if (msgs.length > 180) {
    msgs = msgs.slice(msgs.length - 150)
  }
}

const getLogs = async (req, res) => {
  const output = {
    result: true,
    log: msgs,
  }
  msgs = []
  utils.responseJson(res, output)
}

const removeLogs = async (req, res) => {
  try {
    let filenames = fs.readdirSync('./logs')
    //fs.rmdirSync('./logs', { recursive: true, force: true })
    fs.rmSync('./logs', { recursive: true })
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs')
    }
    const output = {
      result: true,
      message: `removed ${filenames.length} log files`,
    }
    utils.responseJson(res, output)
  } catch (err) {
    //ERROR(`It SHOULD NOT happen! - ${JSON.stringify(err)}`)
    utils.responseJson(res, { result: false, cmd: 'removeLogs', error: err }, 500)
  }
}

const getBlockNumber = async (req, res) => {
  const output = {
    result: true,
    blockNumber: null,
  }
  try {
    output.blockNumber = await support.getLatestblockNumber(targetUrl)
    //DEBUG(`Success! - ${JSON.stringify(output)}`)
    utils.responseJson(res, output)
  } catch (err) {
    //ERROR(`It SHOULD NOT happen! - ${JSON.stringify(err)}`)
    utils.responseJson(res, { result: false, cmd: 'blockNumber', error: err }, 500)
  }
}

const getBlockInterval = async (req, res) => {
  const output = {
    result: false,
    blockInterval: null,
  }
  try {
    let blockNumber = await support.getLatestblockNumber(targetUrl)
    output.blockInterval = await blockInterval(blockNumber)
    output.result = true
    //DEBUG(`Success! - ${JSON.stringify(output)}`)
    utils.responseJson(res, output)
  } catch (err) {
    console.log('blockInterval', err)
    //ERROR(`It SHOULD NOT happen! - ${JSON.stringify(err)}`)
    utils.responseJson(res, { result: false, cmd: 'blockInterval', error: err }, 500)
  }
}

async function blockInterval(_blockNumber) {
  let blockObj1 = await support.getBlock(targetUrl, _blockNumber)
  let blocktime1 = Web3Utils.hexToNumber(blockObj1.timestamp)
  let blockObj2 = await support.getBlock(targetUrl, _blockNumber - 1)
  let blocktime2 = Web3Utils.hexToNumber(blockObj2.timestamp)
  return blocktime1 - blocktime2
}

const getBlockTxCnt = async (req, res, blockNumber) => {
  const output = {
    result: true,
    blockNumber,
    blockTxCount: null,
  }
  try {
    output.blockTxCount = await support.getBlockTxCount(targetUrl, blockNumber)
    //DEBUG(`Success! - ${JSON.stringify(output)}`)
    utils.responseJson(res, output)
  } catch (err) {
    //ERROR(`It SHOULD NOT happen! - ${JSON.stringify(err)}`)
    utils.responseJson(res, { result: false, cmd: 'blockTxCount', error: err }, 500)
  }
}

const maxEmptyBlocks = 5
let IsResultRunning = false
const testResult = async (req, res) => {
  const output = { result: false }
  let lastBlock = null
  let firstBlock = null
  let sumTxs = 0
  let cnt = 0
  let find = false
  try {
    if (IsResultRunning) {
      output.message = 'Result is Running'
      return utils.responseJson(res, output)
    }
    IsResultRunning = true
    let latestBlock = await support.getLatestblockNumber(targetUrl)
    let result = await support.getBlockTxCount(targetUrl, latestBlock)
    // 블록에 tx가 포함되어 있는 경우. 모든 tx가 처리된 것이 확실할 때 (BLOCK에 TX가 0개) TPS를 계산
    if (result != 0) {
      IsResultRunning = false
      output.message = `Not ready to calculate TPS. Please try again after 2-3 seconds.`
      return utils.responseJson(res, output)
    }

    let firstTimestame = 0
    let lastTimestameInTx = 0
    let lastTimestameAfter = 0

    for (let i = latestBlock; i > 2; i--) {
      //console.log(i)
      let nums = await support.getBlockTxCount(targetUrl, i)
      if (nums == 0) {
        if (find == true) {
          // check 5 blocks
          if (cnt == 0) {
            // 현재 블록은 tx가 0이므로 다음 블록으로 셋팅
            firstBlock = await support.getBlock(targetUrl, i + 1)
            firstTimestame = Web3Utils.hexToNumber(firstBlock.timestamp)
          }
          if (++cnt > maxEmptyBlocks) {
            break
          }
        }
      } else {
        cnt = 0
        sumTxs += nums
        if (find == false) {
          //console.log('start??')
          find = true
          if (latestBlock != i) {
            lastBlock = await support.getBlock(targetUrl, i + 1)
            lastTimestameAfter = Web3Utils.hexToNumber(lastBlock.timestamp)
          }
          lastBlock = await support.getBlock(targetUrl, i)
          lastTimestameInTx = Web3Utils.hexToNumber(lastBlock.timestamp)
        }
      }
    }
    if (lastTimestameAfter == 0 && latestBlock < (await support.getLatestblockNumber(targetUrl))) {
      let lastAfterBlock = await support.getBlock(targetUrl, latestBlock + 1)
      lastTimestameAfter = Web3Utils.hexToNumber(lastAfterBlock.timestamp)
    }
    if (lastBlock.number == firstBlock.number) {
      // if 1 block only
      let blockPreiod = await blockInterval(Web3Utils.hexToNumber(firstBlock.number) - 1)
      output.tps = sumTxs / blockPreiod
      output.periodSeconds = blockPreiod
    } else {
      output.tps = sumTxs / (lastTimestameAfter - firstTimestame)
      output.periodSeconds = lastTimestameAfter - firstTimestame
    }
    output.txCount = sumTxs
    output.blocks = Web3Utils.hexToNumber(lastBlock.number) - Web3Utils.hexToNumber(firstBlock.number) + 1
    output.firstBlock = firstBlock.number
    output.lastBlock = lastBlock.number
    output.result = true
    utils.responseJson(res, output)
    DEBUG(`Success! - ${JSON.stringify(output)}`)
    DEBUG(`tx blocks: ${Web3Utils.hexToNumberString(firstBlock.number)} (${firstTimestame}) ~ ${Web3Utils.hexToNumberString(lastBlock.number)} (${lastTimestameInTx})`)
    DEBUG(`next block: ${Web3Utils.hexToNumber(lastBlock.number) + 1} (${lastTimestameAfter})`)
    DEBUG(`other tps (only tx block??) - ${sumTxs / (lastTimestameInTx - firstTimestame)}`)
  } catch (err) {
    console.log('[ERROR] Test Result', err)
    //console.log('** block', lastBlock, ' ~ ', firstBlock)
    utils.responseJson(res, { result: false, cmd: 'result', error: err }, 500)
  }
  IsResultRunning = false
}

let IsVerifyRunning = false
let progress = -1
let lines = []
let latestVerifyResult = null
const testVerify = async (req, res) => {
  const output = { result: true, agentIdx }

  try {
    if (IsVerifyRunning) {
      return utils.responseJson(res, { result: false, agentIdx, message: `Verify is Running.. ${progress} %` })
    } else if (latestVerifyResult != null) {
      utils.responseJson(res, latestVerifyResult)
      //latestVerifyResult = {}
      setTimeout(() => {
        latestVerifyResult = null
      }, 3000)
      return
    }
    IsVerifyRunning = true
    success = dropped = reverted = 0

    let resultObj = await httpUtil.sendHttpGet(`http://localhost:${portNumber}/logfile`)
    console.log(`logfile ->`, resultObj)
    let logFilePath = resultObj.result

    let contents = fs.readFileSync(logFilePath).toString()
    lines = contents.split(/\r\n|\n/)

    setTimeout(backgroundVerify, 10)

    let txCnt = lines.length - 2
    //console.log(`items: ${txCnt}(?)`)
    output.txCount = txCnt
    output.message = 'Verify is starting...'
    //latestVerifyResult = output
    DEBUG(`Test Verify - Started! - ${JSON.stringify(output)}`)
    utils.responseJson(res, output)
  } catch (err) {
    console.log('[ERROR] Test Verify', err)
    output.result = false
    output.message = err
    utils.responseJson(res, output, 500)
  }
}

let success = 0
let dropped = 0
let reverted = 0
const minMultiCnt = 10
async function backgroundVerify() {
  let output = {
    result: true,
    agentIdx,
  }
  const allLines = lines.length - 1
  const showProgressChaing = allLines > 50000 ? 5 : 10
  const maxMultiCnt = allLines - minMultiCnt
  try {
    for (let i = 0; i <= allLines; i++) {
      //console.log(lines[i])
      const txInfos = getTxidFromLogStr(lines[i])
      if (txInfos == null) continue
      let transactionHash = txInfos[1]
      //console.log('txid', transactionHash)
      // let progressNow = parseInt((i * 100) / allLines)
      let progressNow = parseInt((i * 100) / allLines)
      if (progress != progressNow) {
        progress = progressNow
        if (progress > 1 && progress % showProgressChaing == 0) {
          INFO(` * [${progressNow}%] Verify Tx (Hash: ${transactionHash})`)
        }
      }
      let request = httpUtil.getPostRequest(targetUrl, 'eth_getTransactionReceipt', [transactionHash])
      //console.log('req', request)
      if (i < maxMultiCnt && i % 3 != 0) {
        httpUtil.sendHttp(request).then((txResults) => {
          //console.log(txResults)
          updateTxReceipt(transactionHash, txResults)
        })
      } else {
        let txResults = await httpUtil.sendHttp(request)
        //console.log(txResults)
        updateTxReceipt(transactionHash, txResults)
      }
    }
    output.message = 'Verify is done.'
    output.txCount = success + reverted + dropped
    INFO(`Test Verify - Done! - ${JSON.stringify(output)}`)
  } catch (err) {
    console.log('[ERROR] Test Verify', err)
    ERROR(`Test Verify - ERROR - ${JSON.stringify(err)}`)
    output.message = err
    output.maybeAllTxCount = allLines - 2
    output.verifiedTxCount = success + reverted + dropped
  }
  output.success = success
  output.reverted = reverted
  output.dropped = dropped
  // set result
  latestVerifyResult = output
  IsVerifyRunning = false
  lines = []
  progress = -1
}

function updateTxReceipt(transactionHash, txReceiptObj) {
  if (txReceiptObj == undefined || txReceiptObj == null) {
    INFO(` * tx: ${transactionHash} -> Dropped`)
    dropped++
  } else {
    if (txReceiptObj.status == true || txReceiptObj.status === '0x1') {
      // console.log(` * tx: ${transactionHash} -> Seccess`)
      success++
    } else {
      INFO(` * tx: ${transactionHash} -> Reverted`)
      reverted++
    }
  }
}

function getTxidFromLogStr(lineStr) {
  if (lineStr.length != 80) {
    return null
  }
  let txInfos = lineStr.split(' ')
  if (txInfos[1].length != 66) {
    return null
  }
  return txInfos
}

const txpool = async (req, res) => {
  const output = {
    result: true,
  }
  let reqTxpool = 'txpool_besuStatistics'
  try {
    reqTxpool = httpUtil.getPostRequest(targetUrl, 'txpool_besuStatistics')
    let resp = await httpUtil.sendHttp(reqTxpool)
    output.txCount = resp.localCount + resp.remoteCount
    output.txpool = resp
    //DEBUG(`Success! - ${JSON.stringify(output)}`)
    utils.responseJson(res, output)
  } catch (err) {
    //ERROR(`[ERROR] txpool - ${JSON.stringify(err)}`)
    utils.responseJson(res, { result: false, reqTxpool, error: err }, 500)
  }
}

const toBesu = async (req, res, methodStr, paramArrStr) => {
  const output = {
    result: true,
  }
  try {
    let paramArr = []
    if (paramArrStr != null && paramArrStr != '') {
      let strUrix = decodeURIComponent(paramArrStr)
      paramArr = JSON.parse(strUrix)
      //console.log(paramArrStr, strUrix, paramArr)
    }
    //console.log(`toBesu - '${methodStr}' - '${JSON.stringify(paramArr)}'`)
    let reqBesu = httpUtil.getPostRequest(targetUrl, methodStr, paramArr)
    let resp = await httpUtil.sendHttp(reqBesu)
    // console.log('resp', resp)
    output.message = resp
    utils.responseJson(res, output)
  } catch (err) {
    console.log(`[ERROR] toBesu`, err)
    utils.responseJson(res, { result: false, reqBesu, error: err }, 500)
  }
}
