// docu createDocument test
const express = require('express')
const http = require('http')
const httpRequest = require('request-promise')
const { Web3 } = require('web3')
const Web3Utils = require('web3-utils')

const crypto = require('crypto')

const utils = require('../../common/utils')
const httpUtil = require('../../common/httpUtil')
const logs = require('../../common/logs')
const support = require('../../common/support')
const test = require('./test.docu')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)
const DEBUG = (msg, showLog = true) => {
  if (setting.saveLog) {
    logs.appendLog(msg)
  } else if (showLog) {
    process.stdout.write(msg)
  }
}

const testName = 'docu'
const testContractName = 'ChainzDocBMT'
const deployContructorArguments = []
const txGasLimit = 200000

const startTime = new Date()
// Environment variables
const args = process.argv.slice(2)

const { setting, httpRpcUrl, configObj } = utils.prepareTestcase(testName, args)

INFO(`RPC: ${httpRpcUrl}, Contract: ${configObj.docuAddress}`)

const startInfoStr = `port:${setting.port} account:${setting.startIdx}(${setting.acountCnt}) contract: ${configObj.docuAddress} opt:${setting.chkDeployedContract} endpoint:${httpRpcUrl}`
// INFO(startInfoStr)
let isTestReady = false
let deployed = false
let testReadyMsg = ''
// In-memory status
let accounts = []
let acountLock = 0
let latestTxid = null

// Express
const app = express()
app.use((req, res, next) => next())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const server = http.createServer(app)
server.listen(setting.port, async () => {
  INFO(`Listen on port ${setting.port}!!!`)
  const loggingInitAccountStep = utils.getLoggingItemInterval(setting.acountCnt)
  try {
    let connection = null
    let httpProvider = {}

    httpProvider = new Web3.providers.HttpProvider(httpRpcUrl)
    //httpProvider = new Web3.providers.HttpProvider(httpRpcUrl, utils.getweb3HttpHeader(conf));
    connection = new Web3(httpProvider)

    let chainId = await connection.eth.getChainId()
    test.setTestEnv(httpRpcUrl, configObj.docuAddress, configObj.httpheaders, chainId, txGasLimit)

    let nodeInfo = await connection.eth.getNodeInfo()
    logs.newLog(testName, setting.minerIdx)
    DEBUG(startInfoStr + ' ' + nodeInfo + '\n')

    deployed = await support.checkContractDeployed(httpRpcUrl, configObj.docuAddress)
    if (deployed == false) {
      testReadyMsg = `Need to deploy the ${testName} contract. `
      INFO(testReadyMsg)
      if (setting.chkDeployedContract) {
        setting.chkDeployedContract = false
      }
    }
    for (let i = 0; i < setting.acountCnt; i++) {
      const account = setting.accountConf[i + setting.startIdx]
      account.senderPrivKeyBytes = Buffer.from(account.sPrivKey, 'hex')

      account.nonceLock = await connection.eth.getTransactionCount(account.sender)
      account.startTxCount = account.nonceLock

      if (setting.chkDeployedContract) {
        if (i == 0) {
          INFO(`gas: (create document) ${await test.createEstimateGas(account.sender)}`)
        }
      }
      // 변경-중복에러 방지
      account.docuCnt = account.nonceLock

      accounts[i] = account
      if (i % loggingInitAccountStep == 0 || i + 1 == setting.acountCnt) {
        // INFO(`Account[${i}]: ${JSON.stringify(account)}`)
        INFO(`AccountSet[${i}]: ${account.name} from:${account.sender} (nonce:${account.nonceLock}) to:${account.receiver}`)
      }
    }
    let endTime = new Date()
    let xMsg = `Test Ready - prepare time: ${((endTime.valueOf() - startTime.valueOf()) / 1000).toFixed(1)} seconds`
    //testReadyMsg += xMsg
    INFO(xMsg)
    isTestReady = true
  } catch (err) {
    ERROR(`web3 Error occurred: ${err}`)
    //process.exit(1) // 상위레벨에서 kill시킴
  }
})

server.on('error', (error) => {
  ERROR(`Server Error occurred: ${error}`)
})

const deploy = async (req, res) => {
  const output = await support.deployContract(httpRpcUrl, configObj.ownerPrivKey, testName, testContractName, deployContructorArguments)

  if (output.contractAddress != null /* output.status == true */) {
    test.setContractAddress(output.contractAddress)
    configObj.docuAddress = output.contractAddress
    latestTxid = output.transactionHash
    deployed = true
  }
  utils.responseJson(res, output)
}

//let documentId = 1
//let fileHash = '0x724ad11f03ec789913d203e50bbf4f8ebe391c71d9aad551fbb55e42c69ff814'
let expiredDate = Math.floor(+new Date() / 1000) + 365 * 24 * 60 * 60 // 1년 후?

const createDocu = async (req, res) => {
  const accIdLock = acountLock++
  if (acountLock == setting.acountCnt) {
    acountLock = 0
  }

  const nonce = accounts[accIdLock].nonceLock++
  //const docNum = accounts[accIdLock].docuCnt++
  const acc = accounts[accIdLock]
  const docNum = nonce

  let documentId = Web3Utils.hexToNumberString(acc.sender + docNum.toString())
  let fileHash =
    '0x' +
    crypto
      .createHash('sha256')
      .update(documentId + nonce)
      .digest('hex')
  DEBUG(`create docID: ${documentId} [${acc.sender} ${docNum}] filehash: ${fileHash}, expire: ${expiredDate}\n`)

  const request = test.createReq(acc.senderPrivKeyBytes, nonce, documentId, fileHash, expiredDate++)
  const reqId = request.body.id

  let sendTime = new Date()
  httpRequest
    .post(request)
    .then((response) => {
      try {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
          // const output = { result: true, accIdx: accIdLock, nonce, res: `${response.body.result}`, sendTime, id: reqId }
          // utils.responseTestSuccessJson(res, output)
          utils.responseTestSuccessJsonTxid(res, response.body.result)
          // INFO(`Success! - ${JSON.stringify(output)}`)
          DEBUG(`${sendTime.valueOf()} ${response.body.result}\n`)
          latestTxid = response.body.result
        } else {
          // console.dir(response)
          const output = { result: false, accIdx: accIdLock, nonce, res: response.body.error, req: request }
          utils.responseTestErrorJson(res, output)
          ERROR(`Need check! - ${JSON.stringify(output)}`)
        }
      } catch (err) {
        throw err
      }
    })
    .catch((err) => {
      const output = { result: false, accIdx: accIdLock, nonce, error: `${err}`, req: request }
      utils.responseTestErrorJson(res, output)
      ERROR(`Exception occurred! - ${JSON.stringify(output)}`)
    })
}

const getDocus = async (req, res) => {
  const output = { result: false, testcase: testName, contract: configObj.docuAddress, documents: [] }
  let docuId = null
  try {
    for (let idx = 0; idx < setting.acountCnt; idx++) {
      let docNum = accounts[idx].nonceLock - 1 // 가장 최근 정보
      docuId = Web3Utils.hexToNumberString(accounts[idx].sender + docNum.toString())
      let docObj = await test.getDoc(docuId)
      output.documents.push(docObj)
    }
    output.result = true
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.docId = docuId
    output.message = err
  }
  utils.responseJson(res, output)
}

const getDocu = async (req, res) => {
  const output = { result: false, testcase: testName, contract: configObj.docuAddress }
  let params = req.params
  let docuId = params.docuId

  try {
    let docObj = await test.getDoc(docuId)
    output.document = docObj
    output.result = true
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.docId = docuId
    output.message = err
  }
  utils.responseJson(res, output)
}

const getLatestTxReceipt = async (req, res) => {
  support.sendTxReceipt(res, httpRpcUrl, testName, latestTxid)
}
const getLogfile = async (req, res) => {
  utils.responseJson(res, { result: logs.getLogFile() })
}
const getReady = async (req, res) => {
  utils.responseJson(res, { result: { isTestReady, deployed, testcase: testName, testReadyMsg } })
}

const router = express.Router()
router.route('/deploy').post(deploy)
router.route('/createDocument').post(createDocu) // updateDocument
// router.route('/updateDocument').post(updateDocu)  // updateDocument
router.route('/getDocuments').get(getDocus)
router.route('/getDocument/:docuId').get(getDocu)
router.route('/latestTxReceipt').get(getLatestTxReceipt)
router.route('/logfile').get(getLogfile)
router.route('/ready').get(getReady)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
