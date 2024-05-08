const fs = require('fs')
const utils = require('./utils')

const updateLogInterval = 500
const logDir = './logs'

// const arr = []
// let arrlth = 0
// const enqueue = (data) => {
//   arr.push(data)
//   arrlth++
// }
// const dequeue = () => {
//   arrlth--
//   return arr.shift()
// }

let logMsgs = ''
let debugLogPath = ''
let timerId = undefined
function saveLogStrSync() {
  let msgs = logMsgs
  logMsgs = ''
  if (msgs != '') {
    fs.appendFileSync(debugLogPath, msgs)
  }
}

let IsSaving = false
function saveLogStr() {
  if (IsSaving) return

  let msgs = logMsgs
  logMsgs = ''
  if (msgs != '') {
    IsSaving = true
    fs.appendFile(debugLogPath, msgs, (err) => {
      if (err != null) {
        console.error(err)
      }
      IsSaving = false
    })
  }
}

exports.newLog = function (testcase, minerIdx) {
  if (timerId != undefined) {
    clearTimeout(timerId)
    saveLogStr()
  }
  debugLogPath = `${logDir}/${testcase}.node${minerIdx}_${utils.getCurrentTimeStr()}.log`
  timerId = setInterval(saveLogStr, updateLogInterval)
}

exports.appendLog = function (msg) {
  logMsgs += msg
  // enqueue(msg)
}

exports.getLogFile = function () {
  return debugLogPath
}

exports.exit = function () {
  if (timerId != undefined) {
    clearTimeout(timerId)
    saveLogStr()
  }
}
