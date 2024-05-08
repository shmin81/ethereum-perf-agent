
const utils = require('./utils')

const backgroundStatus = {
  READY: 'ready',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed'
}
Object.freeze(backgroundStatus)
exports.getEnumOfBackgroundWorkStatus = function () {
  return backgroundStatus
}

let _workName = ''
let _workStatus = backgroundStatus.READY

exports.chkBackWorkStatus = function(workName, output) {
  return chkBackWorkStatus(workName, output)
}

function chkBackWorkStatus(workName, output) {
  
  output.message=`${workName}...${_workStatus}`
  switch (_workStatus) {
    case backgroundStatus.READY:
      output.result = true
      return true
    case backgroundStatus.RUNNING:
      output.result = _workName !== workName ? false : true
      return false
    case backgroundStatus.FAILED:
      output.result = false
      break
    case backgroundStatus.DONE:
      output.result = true
      break
    default:
      output.result = false
  }
  setTimeout(() => { 
    _workStatus = backgroundStatus.READY 
    console.log('BackgroundWorkStatus is changed to READY')
  }, 2000)
  
  return false
}

exports.runBackgroundWork = async function (req, res, output, workName, functionObj, ...params) {
  if (!chkBackWorkStatus(workName, output)) {
    return utils.responseJson(res, output)
  }
  try {
    _workName = workName
    _workStatus = backgroundStatus.RUNNING
    setTimeout(startingfunctions, 1, functionObj, ...params)
    output.result = true
    output.message = `[${workName}] starting background job...`
  } catch (err) {
    output.message = err
    _workStatus = backgroundStatus.FAILED
  }
  return utils.responseJson(res, output)
}

async function startingfunctions (functionObj, ...params) {
  //console.log(`startingfunctions`, params)
  let output = await functionObj(...params)
  if (output.result) {
    _workStatus = backgroundStatus.DONE
  }
  else {
    _workStatus = backgroundStatus.FAILED
  }
  console.log(`[${_workName}]`, output)
}