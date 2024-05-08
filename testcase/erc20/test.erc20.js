
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
  // sign the transaction
  const txObj = LegacyTransaction.fromTxData(txData, customChain)
  const signedObj = txObj.sign(senderKey)
  const signedTx = signedObj.serialize()
  const signedTxHex = Buffer.from(signedTx).toString('hex')

  const _body = {
    jsonrpc: '2.0',
    method: 'eth_sendRawTransaction',
    params: [ `0x${signedTxHex}` ],
    id: support.getReqId(),
  }
  
  request.body = _body
  return request
}

// ==================================================

// input:  [{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}]
exports.constructor = async function (_name, _symbol) {
  return [_name, _symbol]
}

// ==================================================

// input:  [{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}]
// output: [{"internalType":"bool","name":"","type":"bool"}]
exports.approveReq = function (senderKey, nonce, spender, amount) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['approve'], [spender, amount])
  return getRawTxReq(senderKey, nonce, txData)
}

exports.approveEstimateGas = async function (senderAddr, spender, amount) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['approve'], [spender, amount])
  return await getEstimateGas(senderAddr, txData)
}

// input:  [{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}]
// output: [{"internalType":"bool","name":"","type":"bool"}]
exports.decreaseAllowanceReq = function (senderKey, nonce, spender, subtractedValue) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['decreaseAllowance'], [spender, subtractedValue])
  return getRawTxReq(senderKey, nonce, txData)
}

exports.decreaseAllowanceEstimateGas = async function (senderAddr, spender, subtractedValue) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['decreaseAllowance'], [spender, subtractedValue])
  return await getEstimateGas(senderAddr, txData)
}

// input:  [{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}]
// output: [{"internalType":"bool","name":"","type":"bool"}]
exports.increaseAllowanceReq = function (senderKey, nonce, spender, addedValue) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['increaseAllowance'], [spender, addedValue])
  return getRawTxReq(senderKey, nonce, txData)
}

exports.increaseAllowanceEstimateGas = async function (senderAddr, spender, addedValue) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['increaseAllowance'], [spender, addedValue])
  return await getEstimateGas(senderAddr, txData)
}

// input:  [{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}]
// output: [{"internalType":"bool","name":"","type":"bool"}]
exports.transferReq = function (senderKey, nonce, to, amount) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['transfer'], [to, amount])
  return getRawTxReq(senderKey, nonce, txData)
}

exports.transferEstimateGas = async function (senderAddr, to, amount) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['transfer'], [to, amount])
  return await getEstimateGas(senderAddr, txData)
}

// input:  [{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}]
// output: [{"internalType":"bool","name":"","type":"bool"}]
exports.transferFromReq = function (senderKey, nonce, from, to, amount) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['transferFrom'], [from, to, amount])
  return getRawTxReq(senderKey, nonce, txData)
}

exports.transferFromEstimateGas = async function (senderAddr, from, to, amount) {

  const txData = ABIHelper.getCallDataByABI(funcAbiObj['transferFrom'], [from, to, amount])
  return await getEstimateGas(senderAddr, txData)
}

// ==================================================

// input:  [{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}]
// output: [{"internalType":"uint256","name":"","type":"uint256"}]
exports.allowance = async function (owner, spender) {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['allowance'], [owner, spender])
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// input:  [{"internalType":"address","name":"account","type":"address"}]
// output: [{"internalType":"uint256","name":"","type":"uint256"}]
exports.balanceOf = async function (account) {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['balanceOf'], [account])
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// output: [{"internalType":"uint8","name":"","type":"uint8"}]
exports.decimals = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['decimals'], [])
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// output: [{"internalType":"uint256","name":"","type":"uint256"}]
exports.initialSupply = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['initialSupply'], [])
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// output: [{"internalType":"string","name":"","type":"string"}]
exports.name = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['name'], [])
  }
  let responseData = await support.sendCall(request.uri, callData)
  return responseData
}

// output: [{"internalType":"string","name":"","type":"string"}]
exports.symbol = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['symbol'], [])
  }
  let responseData = await support.sendCall(request.uri, callData)
  return responseData
}

// output: [{"internalType":"uint256","name":"","type":"uint256"}]
exports.totalSupply = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['totalSupply'], [])
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

