const fs = require('fs')
const support = require('../common/support')
const interfaceContract = require('./interfaceContract')

const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('options: testcase_name, compiled_smart_contract_filename(json or abi), forceUpdate(default:true)')
  console.log('node  2.makeTestCase.js  erc777  erc777Token  false')
  process.exit(1)
}

const cabi = support.getContractAbi(args[1])

if (cabi.length < 3) {
  console.log(`wrong abi info`, cabi)
  process.exit(1)
}

interfaceContract.convert(cabi)

if (!fs.existsSync(`../testcase/${args[0]}`)) {
  fs.mkdirSync(`../testcase/${args[0]}`)
} else if (args.length == 3 && args[2].toLowerCase() == 'false') {
  console.log(`allready exist: 'testcase/${args[0]}'`)
  process.exit(0)
}

// ==============================================

let testJSfile = `../testcase/${args[0]}/test.${args[0]}.js`
console.log(`saving... ${testJSfile}`)
fs.writeFileSync(testJSfile, interfaceContract.getTestCaseHeader())
fs.appendFileSync(testJSfile, `// ==================================================\n\n`)
fs.appendFileSync(testJSfile, interfaceContract.getDeployFuncStr())
fs.appendFileSync(testJSfile, `// ==================================================\n\n`)
fs.appendFileSync(testJSfile, interfaceContract.getContractTxApiScript())
fs.appendFileSync(testJSfile, `// ==================================================\n\n`)
fs.appendFileSync(testJSfile, interfaceContract.getContractCallApiScript())

// ==============================================

const workerScript = require('./interfaceWorkerNode')
let workerJSfile = `../testcase/${args[0]}/workerNode.${args[0]}.js`
console.log(`saving... ${workerJSfile}`)
fs.writeFileSync(workerJSfile, workerScript.getWorkerHeader(args[0], args[1], interfaceContract.getConstructorInputs()))
fs.appendFileSync(workerJSfile, workerScript.getMainFunctions(cabi))
fs.appendFileSync(workerJSfile, workerScript.getWorkerRouter(cabi))

console.log(`done`)
