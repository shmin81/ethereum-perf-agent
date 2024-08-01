// ## Single Agent

const fs = require('fs')
const spawn = require('child_process').spawn
const utils = require('../common/utils')
const ctrl = require('./controllerUtil')

const express = require('express')
const http = require('http')
const cors = require('cors')
const httpUtil = require('../common/httpUtil')

const controller_port = 10050
let saveLog = true
let logCache = true

const INFO = (msg) => {
  if (logCache) ctrl.appendLog(`[INFO] ${msg}\n`)
  console.log(`${new Date().toISOString()} [INFO] ${msg}`)
}
const INFOSUB = (msg) => {
  //if (logCache) msgs += `[INFO] ${msg}`
  if (logCache) ctrl.appendLog(`[INFO] ${msg}`)
  process.stdout.write(`${new Date().toISOString()} [INFO] ${msg}`)
}
const ERROR = (msg) => {
  //if (logCache) msgs += `[ERROR] ${msg}\n`
  if (logCache) ctrl.appendLog(`[ERROR] ${msg}\n`)
  console.error(`${new Date().toISOString()} [ERROR] ${msg}`)
}

// saveLog 옵션은 테스트별 주요 로그 파일로 저장할지? 아니면 console로만 출력할지를 선택함.
const args = process.argv.slice(2)
if (args.length == 0) {
  ERROR('node controllerNode.js saveLogOption(true/false) logResponse(default=false)')
  INFO(`$ node controlAgent.js false false`)
  process.exit(0)
}

if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs')
}

let conf = utils.loadConfig()
if (args.length > 0) {
  saveLog = args[0] === 'false' ? false : true
}
if (args.length == 2) {
  logCache = args[1] === 'false' ? false : true
}

let testcase = ''

const portNumber = Number(conf.startPortNumber)
let endpointIndex = Number(conf.startEndpointIdx)

let testAccountCount = Number(conf.numberOfAccounts)
let testAccountIndex = Number(conf.startAccountIdx)
let chkContract = true
const numOfNodes = 1 // 변경 불가

let endpointConf = null
let accountConf = null
let endpointsCnt = 0
let accountCnt = 0
function chkTestEnvSetting() {
  // ethereum node
  endpointConf = utils.loadJson(conf.endpointfile)
  endpointsCnt = endpointConf.length
  ctrl.set(endpointConf[endpointIndex], portNumber, endpointIndex)

  // account
  accountConf = utils.loadJson(conf.accountfile)
  accountCnt = accountConf.length
  //INFO(`num of accounts: ${accountCnt} [(test) cnt:${conf.numberOfAccounts}, idx: ${conf.startAccountIdx}]`)

  if (Number(conf.startAccountIdx) + Number(conf.numberOfAccounts) > accountCnt) {
    INFO(`num of nodes: ${endpointsCnt}, num of accounts: ${accountCnt} [(test) cnt:${conf.numberOfAccounts}, idx: ${conf.startAccountIdx}]`)
    ERROR(`account 개수 부족 (${Number(conf.numberOfAccounts) + Number(conf.startAccountIdx)}개의 계정셋이 필요함)`)
    return false
  }
  return true
}

chkTestEnvSetting()

let runWorkerCnt = 0
let runningTask = 0
let childs = []
function newProcess(id) {
  let resultObj = chkTestName(testcase)
  if (!resultObj.result) {
    // Not ready!!
    ERROR(resultObj)
    return
  }

  let nodeScript = resultObj.script

  //INFO(`=========================================================`);
  INFO(`[${id}] new agent process => node ${nodeScript} ${portNumber} ${endpointIndex} ${testAccountIndex} ${testAccountCount} ${chkContract} ${saveLog}`)

  let process2 = spawn('node', [nodeScript, portNumber, endpointIndex, testAccountIndex, testAccountCount, chkContract, saveLog])
  runningTask++
  childs.push(process2)

  process2.stderr.on('data', function (data) {
    ERROR(`[${id}] ${data}`)
    exitAllWorkerNodes()
  })
  process2.stdout.on('data', function (data) {
    let dataStr = data.toString()
    INFOSUB(`[${id}] ${dataStr}`)
  })
  process2.on('exit', function (code) {
    if (runningTask > 0) {
      runningTask--
    }
    const idx = childs.indexOf(process2)
    if (idx > -1) {
      childs.splice(idx, 1)
    }
    let now = new Date()
    let msg = `${now.toISOString()} [${id}] exit [code: ${code}] -> ${runningTask} task remained.`
    console.log(msg)
    if (numOfNodes > 1 && runningTask > 0) {
      exitAllWorkerNodes()
    }
  })
}

function exitAllWorkerNodes(restartNode = false) {
  childs.forEach((element) => {
    if (element.killed == false) {
      INFO(`[pid:${element.pid}] ${element.spawnargs.join(' ')} -> kill...`)
      element.kill()
    }
  })

  if (restartNode) {
    if (childs.length == 0) {
      //restartMode = false
      newProcess(runWorkerCnt++)
    } else {
      setTimeout(() => {
        // re-try
        exitAllWorkerNodes(true)
      }, 200)
    }
  }
}

// ==============================================

// Express
const app = express()
app.use((req, res, next) => next())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
//app.options('*', cors())  // Enabling CORS Pre-Flight
app.use(cors()) // Enable All CORS Requests

const server = http.createServer(app)
server.listen(controller_port, async () => {
  INFO(`Listen on port ${controller_port}!!!`)
})

server.on('error', (error) => {
  ERROR(`Controller Server Error occurred: ${error}`)
  process.exit(1)
})

//
const repeatWork = function () {
  ctrl.logCacheRebase()
}
const repeatTimerId = setInterval(repeatWork, 1000)

// ==============================================

async function getTestStatus(resultObj = null, chkProcess = true, testcaseName = null) {
  let result = resultObj == null ? true : resultObj.rerult
  //let message = runningTask == 0 ? 'Not Yet!' : 'test Ready!'
  let message = 'Ready!'
  try {
    if (chkProcess) {
      if (runningTask > 0) {
        let statusTestProcess = await httpUtil.sendHttpGet(`http://localhost:${portNumber}/ready`)
        // console.log('statusTestProcess', statusTestProcess, statusTestProcess.result.isTestReady, statusTestProcess.result.testcase)
        if (statusTestProcess.result.isTestReady) {
          message = `${statusTestProcess.result.testcase} test ready!`
          if (statusTestProcess.result.deployed == false) {
            message = `${statusTestProcess.result.testcase} need to deploy!`
          }
        } else {
          message = `Preparing.... ${statusTestProcess.result.testcase}`
        }
        if (testcaseName !== statusTestProcess.result.testcase) {
          result = false
          message += ` [Warn] Testcase(${testcaseName}) is mismatched!`
        }
      } else {
        if (testcaseName != null) {
          message = `Not yet! (${testcaseName})`
          result = false
        }
      }
    }
  } catch (err) {
    // process가 생성 중이라 응답을 못하고 있을 가능성이 높음
    message = 'Preparing...'
  }
  if (resultObj != null && resultObj.message != null) {
    message = resultObj.message
  }
  conf = utils.loadConfig()
  let endpointsList = utils.loadJson(conf.endpointfile)
  let config = conf
  delete config.ownerPrivKey
  delete config.httpheaders
  return {
    result,
    ready: runningTask > 0 ? true : false,
    testcase,
    testAccountIndex,
    testAccountCount,
    accountCount: accountCnt,
    rpcEndpoint: endpointConf[endpointIndex],
    endpointIndex,
    endpointsCnt,
    endpointsList,
    // numOfNodes,
    config,
    time: new Date().toLocaleString(),
    message,
  }
}

function chkTestName(_testname) {
  let nodeScript = `../testcase/${_testname}/workerNode.${_testname}.js`
  if (fs.existsSync(nodeScript) == false) {
    //console.error(`Not found '${nodeScript}'`)
    messageStr = 'Not found the testcase (' + _testname + ')'

    return {
      result: false,
      message: messageStr,
      script: nodeScript,
    }
  }

  return chkTestParams(endpointIndex, testAccountIndex, testAccountCount, nodeScript)
}

function chkTestParams(_endpointIdx, _testAccIdx, _testAccCnt, _script = null) {
  let messageStr = 'Updated'
  let resultChk = true

  if (_endpointIdx < 0 || _endpointIdx >= endpointsCnt) {
    resultChk = false
    messageStr = `wrong endpointIndex (${_endpointIdx})`
  } else if (_testAccIdx < 0 || _testAccCnt < 1) {
    resultChk = false
    messageStr = `(Under) wrong accountIdx(${_testAccIdx}) or accountCnt(${_testAccCnt})`
    if (_testAccIdx + _testAccCnt > accountCnt) {
      messageStr = `(Over) wrong accountIdx(${_testAccIdx}) or accountCnt(${_testAccCnt})`
    }
  }

  return {
    result: resultChk,
    message: messageStr,
    script: _script,
  }
}

// ==============================================

// 입력값에 따라 conf.startAccountIdx와 conf.numberOfAccounts를 업데이트해서 사용하는 것도 고려 필요
// minerIdx도 conf에 추가??
const setNewTestCase = async (req, res) => {
  let params = req.params
  INFO(`setNewTestCase ${JSON.stringify(params)}`)

  let resultObj = chkTestName(params.testname)

  if (resultObj.result) {
    testcase = params.testname
    chkContract = false
    //newProcess(runWorkerCnt++)
    exitAllWorkerNodes(true)
  }

  const output = await getTestStatus(resultObj, false)
  utils.responseJson(res, output)
}

const setTestCase = async (req, res) => {
  let params = req.params
  INFO(`setTestCase ${JSON.stringify(params)}`)

  let resultObj = chkTestName(params.testname)

  if (resultObj.result) {
    testcase = params.testname
    chkContract = true
    //newProcess(runWorkerCnt++)
    exitAllWorkerNodes(true)
  }

  const output = await getTestStatus(resultObj, false)
  utils.responseJson(res, output)
}

const setContract = async (req, res) => {
  let params = req.params
  INFO(`setContract ${JSON.stringify(params)}`)

  let resultObj = chkTestName(params.testname)

  if (resultObj.result && (params.contractAddress == null || params.contractAddress.length != 42 || params.contractAddress.startsWith('0x') == false)) {
    resultObj.result = false
    resultObj.message = 'wrong contractAddress (' + params.contractAddress + ')'
  }

  if (resultObj.result && params.txHash != undefined && params.txHash != null) {
    if (params.txHash.length != 66 || params.txHash.startsWith('0x') == false) {
      resultObj.result = false
      resultObj.message = 'wrong txHash (' + params.txHash + ')'
    }
  }

  if (resultObj.result) {
    testcase = params.testname
    conf = utils.deployNewContract(params.testname, params.contractAddress, params.txHash)
    chkContract = false
    //newProcess(runWorkerCnt++)
    exitAllWorkerNodes(true)
  }

  const output = await getTestStatus(resultObj, false)
  utils.responseJson(res, output)
}

const setTestOptions = async (req, res) => {
  // console.log(req)
  let params = req.params
  INFO(`setTestOptions ${JSON.stringify(params)}`)

  let resultObj = chkTestParams(params.endpointIdx, params.accountIdx, params.accountCnt)

  if (resultObj.result) {
    endpointIndex = params.endpointIdx
    testAccountIndex = params.accountIdx
    testAccountCount = params.accountCnt
    conf = utils.updateTestOpts(endpointIndex, testAccountIndex, testAccountCount)
    chkTestEnvSetting()
  }

  const output = await getTestStatus(resultObj, false)
  utils.responseJson(res, output)
}

const getStatus = async (req, res) => {
  let params = req.params
  let output = null
  if (params.testname != undefined) {
    output = await getTestStatus(null, true, params.testname)
  } else {
    output = await getTestStatus(null, false)
  }
  // 상태점검이므로
  utils.responseTestSuccessJson(res, output)
}

const setEndpointFile = async (req, res) => {
  let params = req.params
  INFO(`setEndpointFile ${JSON.stringify(params)}`)
  const output = { result: false }

  let fname = params.endpointfilename
  if (conf.endpointfile == fname) {
    output.message = 'Not changed (same)'
    return utils.responseJson(res, output)
  }
  if (fname.endsWith('.json') && fname.indexOf('endpoints') > -1) {
    if (fs.existsSync(`../configs/${fname}`)) {
      conf = utils.updateEndpointFile(fname)
      // chk (?)
      output.result = true
      output.message = fname
      if (!chkTestEnvSetting()) {
        output.message = `Need to check of test options (${fname})`
      }
      output.endpoints = endpointConf
    } else {
      output.message = `Not found (${fname})`
    }
  } else {
    output.message = `Wrong name (${fname})`
  }

  utils.responseJson(res, output)
}

const setAccountsFile = async (req, res) => {
  let params = req.params
  INFO(`setAccountsFile: ${JSON.stringify(params)}`)
  const output = { result: false }

  let fname = params.accountfilename
  if (conf.accountfile == fname) {
    output.message = 'Not changed (same)'
    return utils.responseJson(res, output)
  }
  if (fname.startsWith('account') && fname.endsWith('.json')) {
    if (fs.existsSync(`../configs/${fname}`)) {
      conf = utils.updateAccountFile(fname)
      // chk (?)
      output.result = true
      output.message = fname
      if (!chkTestEnvSetting()) {
        output.message = `Need to check of test options (${fname})`
      }
      output.numOfAccounts = accountConf.length
    } else {
      output.message = `Not found (${fname})`
    }
  } else {
    output.message = `Wrong name (${fname})`
  }

  utils.responseJson(res, output)
}

const getTestcaseList = async (req, res) => {
  const output = { result: false }
  let objectInfos = fs.readdirSync('../testcase', { withFileTypes: true })
  let outdatas = []
  objectInfos.forEach((obj) => {
    if (obj.isDirectory()) {
      outdatas.push(obj.name)
    }
  })
  output.result = outdatas.length == 0 ? false : true
  output.files = outdatas

  utils.responseJson(res, output)
}

const getEndpointFiles = async (req, res) => {
  const output = { result: false }
  let filenames = fs.readdirSync('../configs')
  let outdatas = []
  filenames.forEach((fname) => {
    if (fname.endsWith('.json') && fname.indexOf('endpoints') > -1) {
      outdatas.push(fname)
    }
  })
  output.result = outdatas.length == 0 ? false : true
  output.files = outdatas

  utils.responseJson(res, output)
}

const getAccountsFiles = async (req, res) => {
  const output = { result: false }
  let filenames = fs.readdirSync('../configs')
  let outdatas = []
  filenames.forEach((fname) => {
    if (fname.startsWith('account') && fname.endsWith('.json')) {
      outdatas.push(fname)
    }
  })
  output.result = outdatas.length == 0 ? false : true
  output.files = outdatas

  utils.responseJson(res, output)
}

const controlPostMsg = async (req, res) => {
  //INFO(`/message`)
  let msg = 'Disabled POST Method'
  const output = { result: false, message: msg }
  utils.responseJson(res, output)
}

const serverExit = async (req, res) => {
  INFO(`/exit`)
  exitAllWorkerNodes()
  utils.responseJson(res)
  if (repeatTimerId != undefined) {
    clearTimeout(repeatTimerId)
  }
  process.exit(0)
}

const router = express.Router()

router.route('/setTestOptions/:endpointIdx/:accountIdx/:accountCnt').post(setTestOptions)
router.route('/setContract/:testname/:contractAddress').post(setContract)
router.route('/setContract/:testname/:contractAddress/:txHash').post(setContract)
router.route('/setEndpointFile/:endpointfilename').post(setEndpointFile)
router.route('/setAccountsFile/:accountfilename').post(setAccountsFile)

router.route('/setNewTestCase/:testname').post(setNewTestCase)
router.route('/setTestCase/:testname').post(setTestCase)

router.route('/getStatus').get(getStatus)
router.route('/getStatus/:testname').get(getStatus)
router.route('/getTestcaseList').get(getTestcaseList)
router.route('/getAccountsFiles').get(getAccountsFiles)
router.route('/getEndpointFiles').get(getEndpointFiles)

// rpc to workerNode via controllerNode
router.route('/send/:cmd').post(ctrl.postSend)
router.route('/send/:cmd/:param1').post(ctrl.postSend)
router.route('/send/:cmd').get(ctrl.getSend)
router.route('/send/:cmd/:param1').get(ctrl.getSend)

router.route('/message/:cmd').post(controlPostMsg)
router.route('/message/:cmd').get(ctrl.controlGetMsg)
router.route('/message/:cmd/:param1').get(ctrl.controlGetMsg)
router.route('/besu/:api/:paramArr').get(ctrl.controlGetBesu)

router.route('/exit').post(serverExit)
router.route('/exit').get(serverExit)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
