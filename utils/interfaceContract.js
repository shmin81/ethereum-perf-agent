const headerScript = `
const ABIHelper = require('../../common/abi')
const support = require('../../common/support')
const { LegacyTransaction } = require('@ethereumjs/tx')
const Web3Utils = require('web3-utils')

let funcAbiObj = null
let customChain = null
let contractAddr = null
let gasHex = '0x186A0' // gas: 100000
const gasUp = 5000

const request = {
  method: 'POST',
  uri: null,
  json: true,
  headers: { 'Content-Type': 'application/json' },
  resolveWithFullResponse: true,
  timeout: 150000,
  body: [],
}

exports.getUri = function () {
  return request.uri
}

exports.setContractAddress = function (_contractAddr) {
  contractAddr = _contractAddr
}

exports.setTestEnv = async function (_httpRpcUrl, _httpheaders, _contractAddr, _contractName, _gas = 100000) {

  contractAddr = _contractAddr
  gasHex = Web3Utils.toHex(_gas)
  request.uri = _httpRpcUrl
  request.headers = _httpheaders

  let fullAbiObj = support.getContractAbi(_contractName)
  funcAbiObj = ABIHelper.getAbiFunctionsOnlyObj(fullAbiObj)

  customChain = await support.getCustomChain(_httpRpcUrl)
}

async function getEstimateGas(senderAddr, dataObj) {

  const gasData = {
    from: senderAddr,
    to: contractAddr,
    data: dataObj
  }
  const request = httpUtil.getPostRequest(request.uri, 'eth_estimateGas', [gasData])
  const response = await httpUtil.sendHttpTest(request)
  if (response.body.result !== undefined && response.body.result.startsWith('0x')) {
    const _gas = Web3Utils.hexToNumber(response.body.result)
    if ((_gas + gasUp) > Web3Utils.hexToNumber(gasHex)) {
      gasHex = Web3Utils.numberToHex(_gas + gasUp)
    }
    return _gas
  } else {
    console.error(response.body)
  }
}
  
function getRawTxReq(senderKey, nonce, dataObj) {

  const txData = {
    nonce: Web3Utils.toHex(nonce),
    gasLimit: gasHex,
    gasPrice: '0x00',
    to: contractAddr,
    data: dataObj
  }

  const txObj = LegacyTransaction.fromTxData(txData, customChain)
  const signedObj = txObj.sign(senderKey)
  const signedTx = signedObj.serialize()
  const signedTxHex = Buffer.from(signedTx).toString('hex')

  const _body = {
    jsonrpc: '2.0',
    method: 'eth_sendRawTransaction',
    params: [ \`0x\${signedTxHex}\` ],
    id: support.getReqId(),
  }
  request.body = _body
  return request
}\n\n`

exports.getTestCaseHeader = function () {
  return headerScript
}

let deployFuncStr = ''
exports.getDeployFuncStr = function () {
  return deployFuncStr
}

let contractTxApiScript = ''
exports.getContractTxApiScript = function () {
  return contractTxApiScript
}

let contractCallApiScript = ''
exports.getContractCallApiScript = function () {
  return contractCallApiScript
}

let constructorInputs = null
exports.getConstructorInputs = function () {
  return constructorInputs
}

exports.convert = function (cabi) {
  deployFuncStr = ''
  contractTxApiScript = ''
  contractCallApiScript = ''
  constructorInputs = null
  let i = 0
  for (let x of cabi) {
    console.log(i++, x.name, x.type)
    if (x.type === 'constructor') {
      console.log(`=== constructor ===`)
      constructorInputs = x.inputs
      deployFuncStr = funcParamsDespheaderStr(x)
      deployFuncStr += funcDefineCallStr(x.type, x.inputs)
      deployFuncStr += `  return [${funcParamsObj2str(x.inputs)}]\n`
      deployFuncStr += `}\n\n`
    } else if (x.type === 'function') {
      if (x.stateMutability === 'view') {
        console.log(`=== view function ===`, x.payable, x.stateMutability)
        console.log('inputs ', x.inputs)
        console.log('outputs', x.outputs)
        contractCallApiScript += funcParamsDespheaderStr(x)
        contractCallApiScript += makeAbi2CallFunc(x)
      } else {
        console.log(`=== tx function ===`, x.payable, x.stateMutability)
        console.log('inputs ', x.inputs)
        console.log('outputs', x.outputs)
        contractTxApiScript += funcParamsDespheaderStr(x)
        contractTxApiScript += makeAbi2TxFunc(x)
      }
    }
  }
}

function funcParamsDespheaderStr(x) {
  let subset = ''
  if (x.inputs.length > 0) {
    subset = `// input:  ${JSON.stringify(x.inputs)}\n`
  }
  if (x.outputs && x.outputs.length > 0) {
    subset += `// output: ${JSON.stringify(x.outputs)}\n`
  }
  return subset
}

function funcDefineCallStr(fName, inputs) {
  return `exports.${fName} = async function (${funcParamsObj2str(inputs)}) {\n`
}

function funcDefineTxStr(fName, inputs) {
  let input2 = inputs.slice()
  input2.unshift({ name: 'nonce' })
  input2.unshift({ name: 'senderKey' })
  return `exports.${fName}Req = function (${funcParamsObj2str(input2)}) {\n`
}

function funcDefineEstimateGasStr(fName, inputs) {
  let input2 = inputs.slice()
  input2.unshift({ name: 'senderAddr' })
  return `exports.${fName}EstimateGas = async function (${funcParamsObj2str(input2)}) {\n`
}

function makeAbi2CallFunc(x) {
  let subcall = funcDefineCallStr(x.name, x.inputs)
  let str = `
  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['${x.name}'], [${funcParamsObj2str(x.inputs)}])
  }
  let responseData = await support.sendCall(request.uri, callData)\n`
  if (x.outputs.length == 1 && IsNumberType(x.outputs[0].type)) {
    str += `  return Web3Utils.hexToNumberString(responseData)\n`
  } else {
    str += `  return responseData\n`
  }
  subcall += str
  subcall += `}\n\n`
  return subcall
}

function IsNumberType(solidityType) {
  if (solidityType.indexOf(`int`) == -1) {
    return false
  }
  return true
}

function makeAbi2TxFunc(x) {
  let subtx = funcDefineTxStr(x.name, x.inputs)
  // obj
  let str = `
  const txData = ABIHelper.getCallDataByABI(funcAbiObj['${x.name}'], [${funcParamsObj2str(x.inputs)}])
  return getRawTxReq(senderKey, nonce, txData)\n`

  subtx += str
  subtx += `}\n\n`
  subtx += funcDefineEstimateGasStr(x.name, x.inputs)
  // obj
  let str2 = `
  const txData = ABIHelper.getCallDataByABI(funcAbiObj['${x.name}'], [${funcParamsObj2str(x.inputs)}])
  return await getEstimateGas(senderAddr, txData)\n`

  subtx += str2
  subtx += `}\n\n`
  return subtx
}

let undefinedParamCnt = 0
function funcParamsObj2str(arrayObj) {
  let strs = []
  arrayObj.forEach((element) => {
    if (element.name == undefined || element.name == null || element.name === '') {
      console.log(`function param name is not defined (set name: undefined${undefinedParamCnt})`)
      strs.push(`undefined${undefinedParamCnt++}`)
    } else {
      strs.push(element.name)
    }
  })
  undefinedParamCnt = 0
  return strs.join(', ')
}
