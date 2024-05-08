const fs = require('fs')
const path = require('path')
const Web3Utils = require('web3-utils')
const { Common, Chain, Hardfork } = require('@ethereumjs/common')
const { Web3 } = require('web3')

const ABIHelper = require('./abi')
const utils = require('./utils')
const http = require('./httpUtil')

/** Old Version */
exports.customChain = function (chainId, forkStr = 'istanbul') {
  let networkComm = { chainId, networkId: chainId, defaultHardfork: forkStr }
  //console.log(networkComm)
  let customChain = Common.custom(networkComm)
  //console.log(customChain)
  //return { common: customChain, hardfork: Hardfork.Istanbul }
  return { common: customChain }
}

exports.getCustomChain = async function (httpUrl, forkStr = 'istanbul') {
  let request = http.getPostRequest(httpUrl, 'eth_chainId', [])
  let chainIdStr = await http.sendHttp(request)
  let chainId = Web3Utils.hexToNumber(chainIdStr)
  let networkComm = { chainId, networkId: chainId, defaultHardfork: forkStr }
  //console.log(networkComm)
  let customChain = Common.custom(networkComm)
  //console.log(customChain)
  return { common: customChain }
}

exports.getReqId = function() {
  const hrTime = process.hrtime()
  return hrTime[0] * 1000000000 + hrTime[1]
}

exports.getDefaultResponseObj = function(testName, contractAddr=null) {
  if (contractAddr == undefined || contractAddr == null) {
    return { result: false, testcase: testName }
  }
  return { result: false, testcase: testName, contract: contractAddr }
}

/* Not Used */
exports.getContractBinary = function (contractName) {
  //console.log(contractName)
  // compiled by solc
  let binaryPath = path.join(__dirname, `../contracts/${contractName}.bin`)
  let bytecode = chkLoad(binaryPath)
  if (bytecode != null) return chkHexPrefix(bytecode)
  // compiled by solcjs
  binaryPath = path.join(__dirname, `../contracts/${contractName}_sol_${contractName}.bin`)
  bytecode = chkLoad(binaryPath)
  if (bytecode != null) return chkHexPrefix(bytecode)
  // compiled by truffle
  // To Do: 검증 필요
  binaryPath = path.join(__dirname, `../contracts/${contractName}.json`)
  bytecode = JSON.parse(chkLoad(binaryPath)).bytecode
  //bytecode = JSON.parse(chkLoad(binaryPath)).deployedBytecode
  if (bytecode != null) {
    return chkHexPrefix(bytecode)
  }
  return null
}

function chkHexPrefix(bytecode) {
  if (bytecode != null) {
    if (bytecode.startsWith('0x')) {
      return bytecode
    }
    return '0x' + bytecode
  }
  return bytecode
}

exports.getContractAbi = function (contractName) {
  //console.log(contractName)
  // compiled by solc
  let abiJsonPath = path.join(__dirname, `../contracts/${contractName}.abi`)
  let abiJson = chkLoad(abiJsonPath)
  if (abiJson != null) return JSON.parse(abiJson)
  // compiled by solcjs
  abiJsonPath = path.join(__dirname, `../contracts/${contractName}_sol_${contractName}.abi`)
  abiJson = chkLoad(abiJsonPath)
  if (abiJson != null) return JSON.parse(abiJson)
  // compiled by truffle
  // To Do: 검증 필요
  abiJsonPath = path.join(__dirname, `../contracts/${contractName}.json`)
  abiJson = JSON.parse(chkLoad(abiJsonPath)).abi
  if (abiJson != null) return abiJson
  return null
}

function chkLoad(bpath) {
  if (fs.existsSync(bpath)) {
    console.log(`loading... ${bpath}`)
    return fs.readFileSync(bpath, 'utf8')
  }
  return null
}

function getContractInfo(contractName) {
  //console.log(contractName)
  // compiled by solc
  let binaryPath = path.join(__dirname, `../contracts/${contractName}.bin`)
  let bytecode = chkLoad(binaryPath)
  if (bytecode != null) {
    let abiJson = chkLoad(binaryPath.replace('.bin', '.abi'))
    return {
      bytecode: '0x' + bytecode,
      abi: abiJson == null ? null : JSON.parse(abiJson),
    }
  }
  // compiled by solcjs
  binaryPath = path.join(__dirname, `../contracts/${contractName}_sol_${contractName}.bin`)
  bytecode = chkLoad(binaryPath)
  if (bytecode != null) {
    let abiJson = chkLoad(binaryPath.replace('.bin', '.abi'))
    return {
      bytecode: '0x' + bytecode,
      abi: abiJson == null ? null : JSON.parse(abiJson),
    }
  }
  // compiled by truffle
  // To Do: 검증 필요
  binaryPath = path.join(__dirname, `../contracts/${contractName}.json`)
  let truffleObj = JSON.parse(chkLoad(binaryPath))
  if (truffleObj != null) {
    return {
      bytecode: truffleObj.bytecode,
      abi: truffleObj.abi,
    }
  }
  return null
}

/**
 * deploy Contract (default)
 * @param {*} httpRpcUrl
 * @param {*} senderPrivKey
 * @param {*} testName
 * @param {*} contractName
 * @param {*} args
 * @returns
 */
exports.deployContract = async function (httpRpcUrl, senderPrivKey, testName, contractName, args = []) {
  const output = {
    name: 'deploy',
    result: false,
  }
  try {
    let myContract = getContractInfo(contractName)
    if (myContract == null) {
      console.log(`Not found (contract:${contractName})`)
      throw `Not found (contract:${contractName})`
    }
    let encodedArgs = ''
    if (args.length > 0) {
      let fCnt = myContract.abi.length
      let constructorObj = null
      for (let i = 0; i < fCnt; i++) {
        if (myContract.abi[i].type == 'constructor') {
          constructorObj = myContract.abi[i]
          break
        }
      }
      // console.log('constructor', constructorObj)
      console.log('deploy Args', args)
      encodedArgs = ABIHelper.getConstructorDataByABI(constructorObj, args)
      // console.log('encoded Args', encodedArgs)
    }
    let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl)
    let web3 = new Web3(httpProvider)
    let accountFrom = utils.convertPrivKeyToAccount(senderPrivKey)
    let txNonce = await web3.eth.getTransactionCount(accountFrom.address, 'pending')
    // console.log('sender', accountFrom.address, txNonce)

    const txObject = {
      data: myContract.bytecode + encodedArgs,
      from: accountFrom.address,
    }
    // console.log(txObject)
    let results = await web3.eth.estimateGas(txObject)
    console.log('estimateGas', results)
    txObject.nonce = txNonce
    txObject.gasPrice = 0
    txObject.gasLimit = results + 50000n
    // console.log(txObject)
    let signedObj = await web3.eth.accounts.signTransaction(txObject, accountFrom.privateKey)
    // console.log(signedObj)
    let _result = await web3.eth.sendSignedTransaction(signedObj.rawTransaction)
    //console.log('deploy...', _result)
    if (_result.status == true) {
      utils.deployNewContract(testName, _result.contractAddress, _result.transactionHash)
      output.result = true
      output.contractAddress = _result.contractAddress
      output.transactionHash = _result.transactionHash
    }
  } catch (err) {
    output.message = err
  }
  console.log('deploy...', output)
  return output
}

/**
 * deploy Contract with web3.js (web3.eth.Contract) - Not Used
 * @param {*} httpRpcUrl
 * @param {*} senderPrivKey
 * @param {*} testName
 * @param {*} txObject { data: 0x..., arguments: [ 'param1', ... ] }
 * @param {*} abiObj
 * @returns
 */
exports.deployContractWeb3js = async function (httpRpcUrl, senderPrivKey, testName, txObject, abiObj) {
  let _result = null
  try {
    let httpProvider = new Web3.providers.HttpProvider(httpRpcUrl)
    let web3 = new Web3(httpProvider)
    web3.eth.Contract.handleRevert = true

    let accountFrom = utils.convertPrivKeyToAccount(senderPrivKey)
    const Wallet = web3.eth.accounts.wallet.add(accountFrom)

    // Create a new contract object using the ABI and bytecode
    let MyContract = new web3.eth.Contract(abiObj)

    let myContract = MyContract.deploy(txObject)

    // optionally, estimate the gas that will be used for development and log it
    const gas = await myContract.estimateGas({
      from: accountFrom.address,
    })
    console.log('estimateGas', gas)

    // Deploy the contract to the Ganache network
    _result = await myContract.send({
      from: accountFrom.address,
      gas: gas * 2,
      gasPrice: 0,
    })
    // console.log('\n\n1.deploy...', _result)
    // console.log('\n\n2.deploy...(options)', JSON.stringify(_result.options, null, 2))

    utils.deployNewContract(testName, _result.options.address, null)
    _result.status = true
    _result.contractAddress = _result.options.address
  } catch (err) {
    _result = {
      status: false,
      message: err,
    }
  }
  return _result
}

exports.sendTxReceipt = async function (res, httpRpcUrl, testcase, txid) {
  let output = { result: false, testcase, txid, status: 'Not found', txReceipt: null }

  if (txid == undefined || txid == null || txid == '' || txid.length != 66) {
    output.message = `wrong value (txid: '${txid}')`
    return utils.responseJson(res, output)
  }

  try {
    let request = http.getPostRequest(httpRpcUrl, 'eth_getTransactionReceipt', [txid])
    let response = await http.sendHttp(request)

    output.result = true
    if (response.status == '0x1') {
      output.status = 'Success'
    }
    else if (response.status == '0x0') {
      output.status = 'Failed'
    }
    else {
      output.status = `Unknown value (${output.status})`
    }
    output.txReceipt = response
  } catch (err) {
    // ERROR(`Error occurred: ${err}`)
    output.status = 'Exception'
    output.message = err
  }
  utils.responseJson(res, output)
}

exports.checkContractDeployed = async function (httpRpcUrl, contractAddress) {
  // console.log(httpRpcUrl, contractAddress)
  if (contractAddress == undefined || contractAddress == null || contractAddress == '') {
    // console.log('No contract address')
    return false
  }

  try {
    let request = http.getPostRequest(httpRpcUrl, 'eth_getCode', [contractAddress, 'latest'])
    let response = await http.sendHttp(request)
    if (response !== '0x') {
      // console.log('Not found contract code in blockchain')
      return true
    }
  } catch (err) {
    ERROR(`Error occurred: ${err}`)
  }
  return false
}

exports.getChainId = async function (httpRpcUrl) {
  // console.log(httpRpcUrl)
  let request = http.getPostRequest(httpRpcUrl, 'eth_chainId', [])
  let response = await http.sendHttp(request)
  return response
}

exports.getTransactionCount = async function (httpRpcUrl, address) {
  // console.log(httpRpcUrl)
  let request = http.getPostRequest(httpRpcUrl, 'eth_getTransactionCount', [address, 'latest'])
  let response = await http.sendHttp(request)
  return Web3Utils.hexToNumber(response)
}

exports.getLatestblockNumber = async function (httpRpcUrl) {
  // console.log(httpRpcUrl)
  let request = http.getPostRequest(httpRpcUrl, 'eth_blockNumber')
  let response = await http.sendHttp(request)
  return Web3Utils.hexToNumber(response)
}

exports.getBlock = async function (httpRpcUrl, blockNum) {
  // console.log(httpRpcUrl, blockNum)
  let request = http.getPostRequest(httpRpcUrl, 'eth_getBlockByNumber', [`${blockNum}`, false])
  return await http.sendHttp(request)
}

exports.getBlockTxCount = async function (httpRpcUrl, blockNum) {
  // console.log(httpRpcUrl, blockNum)
  if (!blockNum.toString().startsWith('0x')){
    blockNum = Web3Utils.numberToHex(blockNum)
  }
  let request = http.getPostRequest(httpRpcUrl, 'eth_getBlockTransactionCountByNumber', [blockNum])
  let response = await http.sendHttp(request)
  return Web3Utils.hexToNumber(response)
}

exports.sendCall = async function (httpRpcUrl, callData, targetBlockParam = 'latest') {
  // console.log(httpRpcUrl)
  let request = http.getPostRequest(httpRpcUrl, 'eth_call', [callData, targetBlockParam])
  let response = await http.sendHttp(request)
  return response
}
