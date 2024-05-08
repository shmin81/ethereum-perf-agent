
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

async function getEstimateGas(gasData) {
  let request = httpUtil.getPostRequest(request.uri, 'eth_estimateGas', [gasData])
  let response = await httpUtil.sendHttpTest(request)
  if (response.body.result !== undefined && response.body.result.startsWith('0x')) {
    let _gas = Web3Utils.hexToNumber(response.body.result)
    if ((_gas + gasUp) > Web3Utils.hexToNumber(gasHex)) {
      gasHex = Web3Utils.numberToHex(_gas + gasUp)
    }
    return _gas
  } else {
    console.error(response.body)
  }
}

function getRawTxReq(senderKey, txData) {
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

// input:  [{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_decimals","type":"uint8"},{"name":"_initialSupply","type":"uint256"},{"name":"_maxSupply","type":"uint256"}]
exports.constructor = async function (_name, _symbol, _decimals, _initialSupply, _maxSupply) {
  return [_name, _symbol, _decimals, _initialSupply, _maxSupply]
}

// ==================================================

// input:  [{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}]
// output: [{"name":"success","type":"bool"}]
exports.transferReq = function (senderKey, nonce, _to, _value) {

  const txData = {
    nonce: Web3Utils.toHex(nonce),
    gasLimit: gasHex,
    gasPrice: '0x00',
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['transfer'], [_to, _value]),
  }
  return getRawTxReq(senderKey, txData)
}

exports.transferEstimateGas = async function (senderAddr, _to, _value) {

  const callGasData = {
    from: senderAddr,
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['transfer'], [_to, _value]),
  }
  return await getEstimateGas(request.uri, callGasData)
}

// input:  [{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}]
// output: [{"name":"success","type":"bool"}]
exports.transferFromReq = function (senderKey, nonce, _from, _to, _value) {

  const txData = {
    nonce: Web3Utils.toHex(nonce),
    gasLimit: gasHex,
    gasPrice: '0x00',
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['transferFrom'], [_from, _to, _value]),
  }
  return getRawTxReq(senderKey, txData)
}

exports.transferFromEstimateGas = async function (senderAddr, _from, _to, _value) {

  const callGasData = {
    from: senderAddr,
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['transferFrom'], [_from, _to, _value]),
  }
  return await getEstimateGas(request.uri, callGasData)
}

// input:  [{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}]
// output: [{"name":"success","type":"bool"}]
exports.approveReq = function (senderKey, nonce, _spender, _value) {

  const txData = {
    nonce: Web3Utils.toHex(nonce),
    gasLimit: gasHex,
    gasPrice: '0x00',
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['approve'], [_spender, _value]),
  }
  return getRawTxReq(senderKey, txData)
}

exports.approveEstimateGas = async function (senderAddr, _spender, _value) {

  const callGasData = {
    from: senderAddr,
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['approve'], [_spender, _value]),
  }
  return await getEstimateGas(request.uri, callGasData)
}

// input:  [{"name":"_spender","type":"address"},{"name":"_addedValue","type":"uint256"}]
// output: [{"name":"","type":"bool"}]
exports.increaseAllowanceReq = function (senderKey, nonce, _spender, _addedValue) {

  const txData = {
    nonce: Web3Utils.toHex(nonce),
    gasLimit: gasHex,
    gasPrice: '0x00',
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['increaseAllowance'], [_spender, _addedValue]),
  }
  return getRawTxReq(senderKey, txData)
}

exports.increaseAllowanceEstimateGas = async function (senderAddr, _spender, _addedValue) {

  const callGasData = {
    from: senderAddr,
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['increaseAllowance'], [_spender, _addedValue]),
  }
  return await getEstimateGas(request.uri, callGasData)
}

// input:  [{"name":"_spender","type":"address"},{"name":"_subtractedValue","type":"uint256"}]
// output: [{"name":"","type":"bool"}]
exports.decreaseAllowanceReq = function (senderKey, nonce, _spender, _subtractedValue) {

  const txData = {
    nonce: Web3Utils.toHex(nonce),
    gasLimit: gasHex,
    gasPrice: '0x00',
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['decreaseAllowance'], [_spender, _subtractedValue]),
  }
  return getRawTxReq(senderKey, txData)
}

exports.decreaseAllowanceEstimateGas = async function (senderAddr, _spender, _subtractedValue) {

  const callGasData = {
    from: senderAddr,
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['decreaseAllowance'], [_spender, _subtractedValue]),
  }
  return await getEstimateGas(request.uri, callGasData)
}

// input:  [{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"},{"name":"_extraData","type":"bytes"}]
// output: [{"name":"success","type":"bool"}]
exports.approveAndCallReq = function (senderKey, nonce, _spender, _value, _extraData) {

  const txData = {
    nonce: Web3Utils.toHex(nonce),
    gasLimit: gasHex,
    gasPrice: '0x00',
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['approveAndCall'], [_spender, _value, _extraData]),
  }
  return getRawTxReq(senderKey, txData)
}

exports.approveAndCallEstimateGas = async function (senderAddr, _spender, _value, _extraData) {

  const callGasData = {
    from: senderAddr,
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['approveAndCall'], [_spender, _value, _extraData]),
  }
  return await getEstimateGas(request.uri, callGasData)
}

// ==================================================

// output: [{"name":"","type":"string"}]
exports.name = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['name'], []),
  }
  let responseData = await support.sendCall(request.uri, callData)
  return responseData
}

// output: [{"name":"","type":"uint256"}]
exports.totalSupply = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['totalSupply'], []),
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// output: [{"name":"","type":"uint8"}]
exports.decimals = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['decimals'], []),
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// output: [{"name":"","type":"string"}]
exports.symbol = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['symbol'], []),
  }
  let responseData = await support.sendCall(request.uri, callData)
  return responseData
}

// output: [{"name":"","type":"uint256"}]
exports.maxSupply = async function () {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['maxSupply'], []),
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// input:  [{"name":"_owner","type":"address"}]
// output: [{"name":"balance","type":"uint256"}]
exports.balanceOf = async function (_owner) {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['balanceOf'], [_owner]),
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

// input:  [{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}]
// output: [{"name":"remaining","type":"uint256"}]
exports.allowance = async function (_owner, _spender) {

  const callData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(funcAbiObj['allowance'], [_owner, _spender]),
  }
  let responseData = await support.sendCall(request.uri, callData)
  return Web3Utils.hexToNumberString(responseData)
}

