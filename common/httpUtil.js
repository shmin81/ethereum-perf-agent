
const _request = {
  method: 'POST',
  uri: null,
  json: true,
  headers: { 'Content-Type': 'application/json' },
  resolveWithFullResponse: true,
  timeout: 60000,
  body: [],
}
// http header에 JWT 인증 추가는 개발 필요함.
exports.getPostRequest = function (_url, _method, _params = [], _id = 1) {
  _request.uri = _url
  _request.body = {
    jsonrpc: '2.0',
    method: _method,
    params: _params,
    id: _id,
  }
  return _request
}

function exceptionResp(req, err, reject) {
  let msg = {
    method: req.method,
    url: req.uri
  }
  if (req.body.method !== undefined && req.body.method !== 'test') {
    msg.body = req.body
  }
  if (err.error !== undefined && err.error.code === "ECONNREFUSED") {
    msg.error = err.error
    reject(msg)
    return
  }
  if (err.statusCode !== undefined && err.statusCode > 299) {
    msg.statusCode = err.statusCode
    msg.errorMsg = err.message
    reject(msg)
    return
  }

  console.error('exception [', req.uri, ']\n', err)
  reject(err)
}

/** response가 error인 경우, reject 반환이 없고, 콘솔로 출력만... */
// 아직 사용하는 곳은 없음? 왜 이렇게 했나?
const httpRequest = require('request-promise')
exports.sendHttpTest = function (req) {
  //console.log("[http req]", req)
  return new Promise(function (resolve, reject) {
    httpRequest
      .post(req)
      .then((response) => {
        //console.log('[http res]', response)
        if (response.body.error == undefined && response.body.result !== undefined) {
          resolve(response.body.result)
        } else {
          console.error('error [', req.body, ']\n', response.body)
          //reject(response.body)
          resolve(response.body)
        }
      })
      .catch((err) => {
        // console.error('error [', req.uri, req.body, ']\n', err)
        // resolve(err)
        exceptionResp(req, err, resolve)
      })
  })
}

/** response가 error인 경우, reject 반환 */
exports.sendHttp = function (req) {
  //console.log("[http req]", req)
  return new Promise(function (resolve, reject) {
    httpRequest
      .post(req)
      .then((response) => {
        //console.log('[http res]', response)
        if (response.body.error == undefined && response.body.result !== undefined) {
          resolve(response.body.result)
        } else {
          console.error('error [', req.body, ']\n', response.body)
          reject(response.body)
        }
      })
      .catch((err) => {
        exceptionResp(req, err, reject)
      })
  })
}

/** 
 * use reject for fail
 * response가 error인 경우, reject로 error를 반환함. */
exports.sendHttpPost = function (req) {
  //console.log("[http post req]", req)
  return new Promise(function (resolve, reject) {
    httpRequest
      .post(req)
      .then((response) => {
        //console.log('[http res]', response)
        // 이 error 확인 방식은 상황에 따라 문제 있는 듯??
        if (response.body.error == undefined) {
          resolve(response.body)
        } else {
          //console.log('response.body.error:', response.body.error)
          console.error('error [', req.uri, req.body, ']\n', response.body)
          reject(response.body)
        }
      })
      .catch((err) => {
        exceptionResp(req, err, reject)
      })
  })
}

const _requestGet = {
  method: 'GET',
  uri: null,
  json: true,
  headers: { 'Content-Type': 'application/json' },
  resolveWithFullResponse: true,
  timeout: 600000,
  body: [],
}
/** use reject for fail */
exports.sendHttpGet = function (_uri) {
  //console.log("[http get req]", _uri)
  _requestGet.uri = _uri
  return new Promise(function (resolve, reject) {
    httpRequest
      .get(_requestGet)
      .then((response) => {
        //console.log('[http res]', response)
        if (response.body.error == undefined && response.body.result !== undefined) {
          resolve(response.body)
        } else {
          console.log('[Http Get]', _uri, response.body)
          reject(response.body)
        }
      })
      .catch((err) => {
        exceptionResp(_requestGet, err, reject)
      })
  })
}

exports.httpGetTxReceipt = function (_url, _txid) {
  const _body = {
    jsonrpc: '2.0',
    method: 'eth_getTransactionReceipt',
    params: [_txid],
    id: 4586,
  }

  _request.uri = _url
  _request.body = _body

  return new Promise(function (resolve, reject) {
    retryResponse(_request, _txid, resolve, reject)
  })
}

const interval = 1000
const chkMaxCount = 120
let retryResponse = function (req, txid, res, rej) {
  let tryCnt = 0
  let timerId = setInterval(function () {
    sendHttpSync(req).then((receipt) => {
      if (receipt == null) {
        if (++tryCnt > chkMaxCount) {
          clearTimeout(timerId)
          rej(`failed by time out (not found tx receipt - ${txid})`)
        }
      } else {
        clearTimeout(timerId)
        res(receipt)
      }
    }).catch((err) => {
      clearTimeout(timerId)
      exceptionResp(req, err, rej)
    })
  }, interval)
}

async function sendHttpSync(req) {
  return new Promise(function (resolve, reject) {
    httpRequest
      .post(req)
      .then((response) => {
        //if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
        if (response.body.error == undefined && response.body.result !== undefined) {
          resolve(response.body.result)
        } else {
          reject(response.body)
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}
