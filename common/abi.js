const ABI = require('web3-eth-abi')
exports.getCallDataByABI = function (funcABI, args) {
  const paramTypes = funcABI.inputs.map((m) => m.type)
  if (paramTypes.length !== args.length) {
    throw new Error(`ABI and arguments are mismatched!`)
  }
  return ABI.encodeFunctionSignature(funcABI) + ABI.encodeParameters(paramTypes, args).slice(2)
}

exports.getConstructorDataByABI = function (constructorABI, args) {
  const paramTypes = constructorABI.inputs.map((m) => m.type)
  if (paramTypes.length !== args.length) {
    throw new Error(`ABI and arguments are mismatched!`)
  }
  return ABI.encodeParameters(paramTypes, args).slice(2)
}

exports.getFunctionObj = function (abiArrayObj, functionName) {
  for (let element of abiArrayObj) {
    if (element.name === functionName && element.type === 'function') {
      return {
        type: element.type,
        name: element.name,
        inputs: element.inputs,
        outputs: element.outputs,
      }
    }
  }
}

exports.getAbiFunctionsOnlyObj = function (abiArrayObj) {
  let functionsNamesObj = {}
  for (let element of abiArrayObj) {
    if (element.type === 'function') {
      let propertyName = `${element.name}`
      functionsNamesObj[propertyName] = {
        type: element.type,
        name: element.name,
        inputs: element.inputs,
        outputs: element.outputs,
        stateMutability: element.stateMutability,
      }
    }
  }
  //console.log(functionsNamesObj)
  return functionsNamesObj
}
