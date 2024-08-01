const Web3Utils = require('web3-utils')

const utils = require('../../common/utils')
const httpUtil = require('../../common/httpUtil')
const support = require('../../common/support')

let request = null
let response = null
exports.prepareDeposit = async function (test, accountPairList, ownerPrivKey, prepareAmount, _output) {
  //console.log('***** prepareDeposit *****')
  // for backgwound job
  let output = Object.assign({}, _output)
  try {
    let accountFrom = utils.convertPrivKeyToAccount(ownerPrivKey)
    let senderNonce = await support.getTransactionCount(test.getUri(), accountFrom.address)

    response = await test.balanceOf(accountFrom.address)
    console.log(`owner balance: ${response}`)
    const acountsCnt = accountPairList.length
    const logStep = utils.getLoggingItemInterval(acountsCnt)
    for (let i = 0; i < acountsCnt; i++) {
      const acc = accountPairList[i]
      request = test.transferReq(accountFrom.privKeyBuf, senderNonce++, acc.sender, prepareAmount)
      response = await httpUtil.sendHttp(request)
      if (i % logStep == 0 || i + 1 == acountsCnt) console.log(`${i} txid: ${response}`)
    }
    output.latestTxid = response
    output.result = true
    output.message = `deposit ${acountsCnt} accounts`
  } catch (err) {
    output.message = err
  }
  console.log(output.message)
  return new Promise(function (resolve, reject) {
    resolve(output)
  })
}

exports.prepareDepositEachNode = async function (test, accountPairList, middleSenderPrivKey, ownerPrivKey, prepareAmount, includeReceiver, _output) {
  //console.log('***** prepareDepositEachNode *****')
  // for backgwound job
  let output = Object.assign({}, _output)
  try {
    let accountFrom = utils.convertPrivKeyToAccount(ownerPrivKey)
    let senderFrom = utils.convertPrivKeyToAccount(middleSenderPrivKey)

    let senderNonce = await support.getTransactionCount(test.getUri(), accountFrom.address)

    response = await test.balanceOf(accountFrom.address)
    console.log(`owner balance: ${response}`)

    const acountsCnt = accountPairList.length

    let prepareAmountFull = prepareAmount * acountsCnt * 2
    console.log(`send balance from owner: ${prepareAmountFull}`)
    request = test.transferReq(accountFrom.privKeyBuf, senderNonce++, senderFrom.address, prepareAmountFull)
    response = await httpUtil.sendHttp(request)
    let receipt = await httpUtil.httpGetTxReceipt(test.getUri(), response)
    if (receipt.status != '0x1') {
      console.log('tx receipt:', receipt)
      throw new Error('fail tx')
    }

    senderNonce = await support.getTransactionCount(test.getUri(), senderFrom.address)
    response = await test.balanceOf(senderFrom.address)
    console.log(`sender balance: ${response}`)

    const logStep = utils.getLoggingItemInterval(acountsCnt)
    for (let i = 0; i < acountsCnt; i++) {
      const acc = accountPairList[i]
      request = test.transferReq(senderFrom.privKeyBuf, senderNonce++, acc.sender, prepareAmount)
      response = await httpUtil.sendHttp(request)
      if (i % logStep == 0 || i + 1 == acountsCnt) console.log(`${i} txid: ${response}`)
      if (includeReceiver) {
        request = test.transferReq(senderFrom.privKeyBuf, senderNonce++, acc.receiver, 1)
        httpUtil.sendHttp(request)
      }
    }
    let processedCount = includeReceiver ? acountsCnt * 2 + 1 : acountsCnt + 1
    output.latestTxid = response
    output.result = true
    output.message = `deposit ${processedCount} accounts`
  } catch (err) {
    output.message = err
  }
  console.log(output.message)
  return new Promise(function (resolve, reject) {
    resolve(output)
  })
}

const maxSize = 10
exports.getAccounts = async function (req, res, test, setting, output) {
  //console.log('***** getAccounts *****')
  output.accounts = []
  try {
    let params = req.params
    let targetIdx = 0
    let sIdx = 0
    let eIdx = maxSize
    if (params.idx != undefined) {
      targetIdx = parseInt(params.idx)
      sIdx = targetIdx * maxSize
      if (sIdx >= setting.acountCnt) {
        return utils.responseJson(res, output)
      }
      eIdx = sIdx + maxSize
    }

    for (let idx = sIdx; idx < eIdx; idx++) {
      if (idx >= setting.acountCnt) {
        break
      }
      let accountx = setting.accountConf[setting.startIdx + idx]
      let senToken = await test.balanceOf(accountx.sender)
      let recToken = await test.balanceOf(accountx.receiver)
      let acc = {
        testSet: accountx.name,
        sender: {
          address: accountx.sender,
          amounts: senToken,
        },
        receiver: {
          address: accountx.receiver,
          amounts: recToken,
        },
      }
      output.accounts.push(acc)
    }
    output.result = true
  } catch (err) {
    //ERROR(`Error occurred: ${err}`)
    output.message = err
  }
  utils.responseJson(res, output)
}
