
exports.getWorkerHeader = function (testName, contractName, constructorInputs) {
  let scriptStr = `// ${testName} test
const express = require('express')
const http = require('http')
const httpRequest = require('request-promise')
const { Web3, HttpProvider } = require('web3')
const Web3Utils = require('web3-utils')

const utils = require('../../common/utils')
const logs = require('../../common/logs')
const support = require('../../common/support')
const job = require('../../common/backgroundJob')
const test = require('./test.${testName}')
// const apiSet = require('./api.${testName}')

const INFO = (msg) => console.log(msg)
const ERROR = (msg) => console.error(msg)
const DEBUG = (msg, showLog = true) => {
  if (setting.saveLog) {
    logs.appendLog(msg)
  } else if (showLog) {
    process.stdout.write(msg)
  }
}

const testName = '${testName}'
const testContractName = '${contractName}'
// constructor: [ ${apiParamsObj2str(constructorInputs, ', ', '')} ]
const deployConstructorArguments = []

// Environment variables
const args = process.argv.slice(2)

const { setting, httpRpcUrl, configObj } = utils.prepareTestcase(testName, args)
let testContractAddr = configObj.${testName}Address
INFO(\`RPC: \${httpRpcUrl}, Contract: \${testContractName}\ (address:\${testContractAddr})\`)

const startInfoStr = \`port:\${setting.port} account:\${setting.startIdx}(\${setting.acountCnt}) contract: \${testContractAddr} opt:\${setting.chkDeployedContract} endpoint:\${httpRpcUrl}\`
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
  INFO(\`Listen on port \${setting.port}!!!\`)
  let loggingInitAccountStep = utils.getLoggingItemInterval(setting.acountCnt)
  try {
    let httpProvider = new HttpProvider(httpRpcUrl)
    let connection = new Web3(httpProvider)

    let nodeInfo = await connection.eth.getNodeInfo()
    logs.newLog(testName, setting.minerIdx)
    DEBUG(\`\${startInfoStr} \${nodeInfo}\\n\`)

    // setting 
    test.setTestEnv(httpRpcUrl, configObj.httpheaders, testContractAddr, testContractName)

    deployed = await support.checkContractDeployed(httpRpcUrl, testContractAddr)
    if (deployed == false) {
      testReadyMsg = \`Need to deploy the \${testName} contract. \`
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
        /* if (setting.chkDeployedContract) {
          // 표시하고자 하는 추가 정보들이 있다면 여기에서 처리
          additionalInfos = \`, \${표시하고자 하는 추가 정보}\`
        } */
        // INFO(\`Account[\${i}]: \${JSON.stringify(account)}\`)
        INFO(\`AccountSet[\${i}]: \${account.name} from:\${account.sender} (nonce:\${account.nonceLock}\${additionalInfos}), to:\${account.receiver}\`)
      }
    }

    let xMsg = \`Test Ready - prepare time: \${(((new Date()).valueOf() - startTime.valueOf()) / 1000).toFixed(1)} seconds\`
    INFO(xMsg)
    isTestReady = true
  } catch (err) {
    ERROR(\`web3 Error occurred: \${err}\`)
    //process.exit(1) =>> 상위레벨에서 kill시킴
  }
})

server.on('error', (error) => {
  ERROR(\`Server Error occurred: \${error}\`)
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
          // INFO(\`Success! - \${JSON.stringify(output)}\`)
          utils.responseTestSuccessJsonTxid(res, response.body.result)
          DEBUG(\`\${sendTime.valueOf()} \${response.body.result}\\n\`)
          latestTxid = response.body.result
        } else {
          // console.dir(response)
          const output = { result: false, res: response.body.error, req: request.body }
          utils.responseTestErrorJson(res, output)
          ERROR(\`Need check! - \${JSON.stringify(output)}\`)
        }
      } catch (err) {
        throw err
      }
    })
    .catch((err) => {
      const output = { result: false, error: err, req: request.body }
      utils.responseTestErrorJson(res, output)
      ERROR(\`Exception occurred! - \${JSON.stringify(output)}\`)
    })
}

const deploy = async (req, res) => {
  const output = await support.deployContract(httpRpcUrl, configObj.ownerPrivKey, testName, testContractName, deployConstructorArguments)

  if (output.contractAddress != null /* output.status == true */) {
    testContractAddr = output.contractAddress
    test.setContractAddress(output.contractAddress)
    latestTxid = output.transactionHash
    deployed = true
  }
  utils.responseJson(res, output)
}
  `
  return scriptStr
}

exports.getMainFunctions = function (functionObj) {
  let strs = `
/*
const prepareAmount = 1000000

const prepare = async (req, res) => {
  let output = support.getDefaultResponseObj(testName, testContractAddr)
  job.runBackgroundWork(req, res, output, 'Prepare', { functionObj }, { ...functionParams } )
}

const prepareEachNode = async (req, res) => {
  let output = support.getDefaultResponseObj(testName, testContractAddr)
  let issuer = utils.getAgentIssuers(setting.minerIdx)
  job.runBackgroundWork(req, res, output, 'Prepare', { functionObj }, { ...functionParams } )
}
*/\n\n`

  strs += getFunctionPostList(functionObj)
  strs += getFunctionGetList(functionObj)
  return strs
}

function getFunctionPostList(functionObj) {
  let strRouter = ''
  for(let element of functionObj) {
    if (element.type === 'function') {
      if (element.stateMutability !== 'view') {
        strRouter += `const ${element.name} = async (req, res) => {\n`
        strRouter += getRawTxTypeFunc(element)
        strRouter += `}\n\n`
      }
    }
  }
  return strRouter
}

function getRawTxTypeFunc(funcObj) {
  if (funcObj.inputs.length != 0) {
    return `  //\n  // Under Construction!!\n  //\n`
  }

  let strfunc = `  // Under Construction!
  //
  const accIdLock = acountLock++
  if (acountLock == setting.acountCnt) {
    acountLock = 0
  }
  const nonce = accounts[accIdLock].nonceLock++
  const acc = accounts[accIdLock]
  
  // Under Construction!!!!
  // const request = test.${funcObj.name}Req(acc.senderPrivKeyBytes, nonce, { ${apiParamsObj2str(funcObj.inputs, ' }, { ', '')} })

  return sendReq(request, res)\n`
  return strfunc
}

function getFunctionGetList(functionObj) {
  let strRouter = ''
  for(let element of functionObj) {
    if (element.type === 'function') {
      if (element.stateMutability === 'view') {
        let getApiName = `get${capitalize(element.name)}`
        strRouter += `const ${getApiName} = async (req, res) => {\n`
        //strRouter += `\n  // Under Construction!!\n\n`
        strRouter += `  let output = support.getDefaultResponseObj(testName, testContractAddr)\n`
        strRouter += `  ${getCallTypeFunc(element)}\n`
        strRouter += `}\n\n`
      }
    }
  }
  return strRouter
}

function getCallTypeFunc(funcObj) {
  // if (funcObj.outputs.length != 1) {
  //   return `\n  // Under Construction!! (Unusable response format!!)\n\n  utils.responseJson(res, output)`
  // }

  let strfunc = `try {`
  if (funcObj.inputs.length == 0) {
    strfunc += `\n    let responseData = await test.${funcObj.name}()\n`
  }
  else {
    strfunc += `
    let params = req.params
    let responseData = await test.${funcObj.name}(${apiParamsObj2str(funcObj.inputs, ', params.', 'params.')})\n`
  }

  let paramsArr = apiParamObjsToArray(funcObj.inputs)
  paramsArr.forEach(elem => {
    strfunc += `    output.${elem} = params.${elem}\n`
  })
  strfunc += `    output.result = true\n`
  if (funcObj.outputs.length == 1) {
    let responseName = funcObj.outputs[0].name
    responseName = responseName === '' ? funcObj.name : responseName
    strfunc += `    output.${responseName} = responseData`
  } else {
    strfunc += `    output.${funcObj.name}Result = responseData\n`
    strfunc += `    output.${funcObj.name}ResultTypes = '${apiParamObjsTypeToArrayString(funcObj.outputs)}'`
  }
  strfunc += `
  } catch (err) {
    //ERROR(\`Error occurred: \${err}\`)
    output.message = err
  }
  utils.responseJson(res, output)`

  return strfunc
}

exports.getWorkerRouter = function (functionObj) {
  let scriptStr = `
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
// router.route('/prepare').post(prepare)
// router.route('/prepareEachNode').post(prepareEachNode)

${getRoutePostList(functionObj)}
${getRouteGetList(functionObj)}
router.route('/latestTxReceipt').get(getLatestTxReceipt)
router.route('/logfile').get(getLogfile)
router.route('/ready').get(getReady)

app.use('/', router)
app.all('*', (req, res) => res.status(404).end())
  `
  return scriptStr
}

function getRoutePostList(functionObj) {
  let strRouter = ''
  for(let element of functionObj) {
    if (element.type === 'function') {
      if (element.stateMutability !== 'view') {
        strRouter += `// router.route('/${element.name}').post(${element.name})\n`
      }
    }
  }
  return strRouter
}

function getRouteGetList(functionObj) {
  let strRouter = ''
  for(let element of functionObj) {
    if (element.type === 'function') {
      if (element.stateMutability === 'view') {
        let getApiName = `get${capitalize(element.name)}`
        if (element.inputs.length > 0) {
          strRouter += `router.route('/${getApiName}${apiParamsObj2str(element.inputs)}').get(${getApiName})\n`
        }
        else {
          strRouter += `router.route('/${getApiName}').get(${getApiName})\n`
        }
      }
    }
  }
  return strRouter
}
// 첫번쨰 문자를 대문자로 변환
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function apiParamsObj2str(arrayObj, arrayMerger='/:', preFix='/:') {
  let strs = []
  arrayObj.forEach(element => {
    if (element.name.charAt(0) === '_') {
      strs.push(element.name.slice(1))
    }
    else {
      strs.push(element.name)
    }
  });
  if (strs.length == 0) {
    return ''
  }
  return preFix + strs.join(arrayMerger)
}

// modify the api param name
function apiParamObjsToArray(arrayObj) {
  let strs = []
  arrayObj.forEach(element => {
    if (element.name.charAt(0) === '_') {
      strs.push(element.name.slice(1))
    }
    else {
      strs.push(element.name)
    }
  });
  return strs
}

function apiParamObjsTypeToArrayString(arrayObj) {
  let strs = []
  arrayObj.forEach(element => {
    strs.push(element.type)
  });
  return strs.join('_')
}
