// erc20perf test
const express = require('express')
const http = require('http')
const httpRequest = require('request-promise')
const { Web3, HttpProvider } = require('web3')
const Web3Utils = require('web3-utils')

const utils = require('../../common/utils')
const logs = require('../../common/logs')
const support = require('../../common/support')
const job = require('../../common/backgroundJob')
const test = require('./test.erc20perf')
const apiSet = require('../erc20/api.erc20')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)
const DEBUG = (msg, showLog = true) => {
  if (setting.saveLog) {
    logs.appendLog(msg)
  } else if (showLog) {
    process.stdout.write(msg)
  }
}

const testName = 'erc20perf'
const testContractName = 'ERC20Token'
const deployContructorArguments = ['EXE', 'EXE', 18, 1000000000000000, 1000000000000000]

// Environment variables
const args = process.argv.slice(2)

const { setting, httpRpcUrl, configObj } = utils.prepareTestcase(testName, args)
let testContractAddr = configObj.erc20perfAddress
INFO(`RPC: ${httpRpcUrl}, Contract: ${testContractName} (address:${testContractAddr})`)

const startInfoStr = `port:${setting.port} account:${setting.startIdx}(${setting.acountCnt}) contract: ${testContractAddr} opt:${setting.chkDeployedContract} endpoint:${httpRpcUrl}`
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
  let startTime = new Date()
  INFO(`Listen on port ${setting.port}!!!`)
  let loggingInitAccountStep = utils.getLoggingItemInterval(setting.acountCnt)
  try {
    let httpProvider = new HttpProvider(httpRpcUrl)
    let connection = new Web3(httpProvider)

    let nodeInfo = await connection.eth.getNodeInfo()
    logs.newLog(testName, setting.minerIdx)
    DEBUG(`${startInfoStr} ${nodeInfo}\n`)

    // setting 
    test.setTestEnv(httpRpcUrl, configObj.httpheaders, testContractAddr, testContractName)

    deployed = await support.checkContractDeployed(httpRpcUrl, testContractAddr)
    if (deployed == false) {
      testReadyMsg = `Need to deploy the ${testName} contract. `
      INFO(testReadyMsg)
      if (setting.chkDeployedContract) {
        setting.chkDeployedContract = false
      }
    }

    let additionalInfos = ''
    let chkNonceZero = await connection.eth.getTransactionCount(setting.accountConf[setting.startIdx].sender)
    for (let i = 0; i < setting.acountCnt; i++) {
      const account = setting.accountConf[i + setting.startIdx]
      account.senderPrivKeyBytes = Buffer.from(account.sPrivKey, 'hex')

      account.nonceLock = await connection.eth.getTransactionCount(account.sender)
      account.startTxCount = account.nonceLock

      /*if (setting.chkDeployedContract) {
        // 스마트 컨트랙트가 배포된 상태에서 테스트 진행 가능 여부에 대한 상태 확인용 코드 추가
      }*/

      // 테스트 account 수가 많을 경우, nonce값이 0으로 잘못 들어가는 경우가 가끔식 발생했음
      if (chkNonceZero != 0 && account.nonceLock == 0) {
        account.nonceLock = await connection.eth.getTransactionCount(account.sender)
      }

      accounts[i] = account
      if (i % loggingInitAccountStep == 0 || i + 1 == setting.acountCnt) {
        if (setting.chkDeployedContract) {
          // 표시하고자 하는 추가 정보들이 있다면 여기에서 처리
          additionalInfos = `, balance:${await test.balanceOf(account.sender)}`
        }
        // INFO(`Account[${i}]: ${JSON.stringify(account)}`)
        INFO(`AccountSet[${i}]: ${account.name} from:${account.sender} (nonce:${account.nonceLock}${additionalInfos}), to:${account.receiver}`)
      }
    }

    let xMsg = `Test Ready - prepare time: ${(((new Date()).valueOf() - startTime.valueOf()) / 1000).toFixed(1)} seconds`
    INFO(xMsg)
    isTestReady = true
  } catch (err) {
    ERROR(`web3 Error occurred: ${err}`)
    //process.exit(1) =>> 상위레벨에서 kill시킴
  }
})

server.on('error', (error) => {
  ERROR(`Server Error occurred: ${error}`)
})

function sendReq(request, res) {
  let sendTime = new Date()
  httpRequest
    .post(request)
    .then((response) => {
      try {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.length === 66 && response.body.result.startsWith('0x')) {
          // const output = { result: true, accIdx: accIdLock, nonce, res: response.body.result, sendTime, id: reqId }
          // utils.responseTestSuccessJson(res, output)
          // INFO(`Success! - ${JSON.stringify(output)}`)
          utils.responseTestSuccessJsonTxid(res, response.body.result)
          DEBUG(`${sendTime.valueOf()} ${response.body.result}\n`)
          latestTxid = response.body.result
        } else {
          // console.dir(response)
          const output = { result: false, res: response.body.error, req: request.body }
          utils.responseTestErrorJson(res, output)
          ERROR(`Need check! - ${JSON.stringify(output)}`)
        }
      } catch (err) {
        throw err
      }
    })
    .catch((err) => {
      const output = { result: false, error: err, req: request.body }
      utils.responseTestErrorJson(res, output)
      ERROR(`Exception occurred! - ${JSON.stringify(output)}`)
    })
}

const deploy = async (req, res) => {
  const output = await support.deployContract(httpRpcUrl, configObj.ownerPrivKey, testName, testContractName, deployContructorArguments)

  if (output.contractAddress != null /* output.status == true */) {
    testContractAddr = output.contractAddress
    test.setContractAddress(output.contractAddress)
    latestTxid = output.transactionHash
    deployed = true
  }
  utils.responseJson(res, output)
}

const prepareAmount = 1000000
const prepare = async (req, res) => {
  let output = support.getDefaultResponseObj(testName, testContractAddr)
  job.runBackgroundWork(req, res, output, 'Prepare', apiSet.prepareDeposit, test, setting.accountConf, configObj.ownerPrivKey, prepareAmount, output)
}

const prepareEachNode = async (req, res) => {
  let output = support.getDefaultResponseObj(testName, testContractAddr)
  let issuer = utils.getAgentIssuers(setting.minerIdx)
  job.runBackgroundWork(req, res, output, 'prepareEachNode', apiSet.prepareDepositEachNode, test, accounts, issuer.privKey, configObj.ownerPrivKey, prepareAmount, false, output)
}

let transferAmount = 1
const transfer = async (req, res) => {
  
  const accIdLock = acountLock++
  if (acountLock == setting.acountCnt) {
    acountLock = 0
  }
  const nonce = accounts[accIdLock].nonceLock++
  const acc = accounts[accIdLock]
  
  const request = test.transferReq(acc.senderPrivKeyBytes, nonce, acc.receiver, transferAmount)

  return sendReq(request, res)
}

const getBalanceOf = async (req, res) => {

  let output = support.getDefaultResponseObj(testName, testContractAddr)
  try {
    let params = req.params
    let responseData = await test.balanceOf(params.owner)
    output.owner = params.owner
    output.result = true
    output.balance = responseData
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.message = err
  }
  utils.responseJson(res, output)
}

const getDecimals = async (req, res) => {

  let output = support.getDefaultResponseObj(testName, testContractAddr)
  try {
    let responseData = await test.decimals()
    output.result = true
    output.decimals = responseData
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.message = err
  }
  utils.responseJson(res, output)
}

const getName = async (req, res) => {

  let output = support.getDefaultResponseObj(testName, testContractAddr)
  try {
    let responseData = await test.name()
    output.result = true
    output.name = responseData
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.message = err
  }
  utils.responseJson(res, output)
}

const getSymbol = async (req, res) => {

  let output = support.getDefaultResponseObj(testName, testContractAddr)
  try {
    let responseData = await test.symbol()
    output.result = true
    output.symbol = responseData
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.message = err
  }
  utils.responseJson(res, output)
}

const getTotalSupply = async (req, res) => {

  let output = support.getDefaultResponseObj(testName, testContractAddr)
  try {
    let responseData = await test.totalSupply()
    output.result = true
    output.totalSupply = responseData
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.message = err
  }
  utils.responseJson(res, output)
}

const getMaxSupply = async (req, res) => {

  let output = support.getDefaultResponseObj(testName, testContractAddr)
  try {
    let responseData = await test.maxSupply()
    output.result = true
    output.maxSupply = responseData
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.message = err
  }
  utils.responseJson(res, output)
}

const getAccountInfos = async (req, res) => {
  apiSet.getAccounts(req, res, test, setting, support.getDefaultResponseObj(testName, testContractAddr))
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
router.route('/prepare').post(prepare)
router.route('/prepareEachNode').post(prepareEachNode)

router.route('/transfer').post(transfer)

router.route('/getBalanceOf/:owner').get(getBalanceOf)
router.route('/getDecimals').get(getDecimals)
router.route('/getName').get(getName)
router.route('/getSymbol').get(getSymbol)
router.route('/getTotalSupply').get(getTotalSupply)
router.route('/getMaxSupply').get(getMaxSupply)

router.route('/accounts').get(getAccountInfos)
router.route('/accounts/:idx').get(getAccountInfos)

router.route('/latestTxReceipt').get(getLatestTxReceipt)
router.route('/logfile').get(getLogfile)
router.route('/ready').get(getReady)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
  