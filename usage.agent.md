
# controllerNode 
* API가 너무 많아서 테스트 환경 셋팅을 json형식으로 한번에 적용 필요할 듯

## test agent 실행
```
#!/bin/bash
$ sh agent.run.sh
```
### 테스트 케이스
- erc20 : openzepplin
- erc20perf : TTA V&V
- docu : document service BMT
- sto : STO

### 테스트 정보를 셋팅하고, agent 노드를 실행(agent 실행시에 테스트 Contract관련 확인 안함.) - 신규로 배포(deploy)할 예정인 경우
```
echo 'run testcase and no verify to ready contract status'
curl -X POST "http://localhost:10050/setNewTestCase/erc20"
curl -X POST "http://localhost:10050/setNewTestCase/erc20perf"
curl -X POST "http://localhost:10050/setNewTestCase/docu"
curl -X POST "http://localhost:10050/setNewTestCase/sto"
```

### agent 노드를 실행 (nonce 가 잘못된 경우 등, agent만 재실행, 기존 셋팅 그대로) - 배포된 Contract가 있어야 함.
```
echo 'run testcase and verify to ready contract status'
curl -X POST "http://localhost:10050/setTestCase/erc20"
curl -X POST "http://localhost:10050/setTestCase/erc20perf"
curl -X POST "http://localhost:10050/setTestCase/docu"
curl -X POST "http://localhost:10050/setTestCase/sto"
```

### 특정 노드에서 contract deploy후에 다른 노드에 contract address를 사용하도록 등록 후, agent 노드를 실행 - 배포된 Contract가 있어야 함.
```
echo 'set contract address'
curl -X POST "http://localhost:10050/setContract/erc20/{{contractAddress:0x0000...}}"
curl -X POST "http://localhost:10050/setContract/erc20/{{contractAddress:0x0000...}}/{{txHash:0x0000...}}"
```
## 설정만 변경함
### 테스트 옵션 정보를 변경 agent 노드 실행 없음
```
echo 'set test options setting (minerIdx / accountIdx / accountCount )'
curl -X POST "http://localhost:10050/setTestOptions/0/0/1"
curl -X POST "http://localhost:10050/setTestOptions/0/0/5"
```
### 현재 상태 변경 agent 노드를 실행 없음
```
echo 'set miner list'
curl -X POST "http://localhost:10050/setEndpointFile/{{endpoints.dev-testnet.json}}"

echo 'set account list'
curl -X POST "http://localhost:10050/setAccountsFile/{{accounts_10.json}}"
```
### 현재 상태 조회 (셋팅 값 등 확인) - 테스트 가능한 상태인지도 확인
```
echo 'get testcase status'
curl -X GET "http://localhost:10050/getStatus"
```
### 사용가능 목록 조회
```
echo 'get testcase list'
curl -X GET "http://localhost:10050/getTestcaseList"

echo 'get endpoints file list'
curl -X GET "http://localhost:10050/getEndpointFiles"

echo 'get accounts file list'
curl -X GET "http://localhost:10050/getAccountsFiles"
```
### 기타 명령
```
echo 'message with sub-command'
curl -X GET "http://localhost:10050/message/{sub-command}"

echo 'remove log files'
curl -X GET "http://localhost:10050/message/removeLogs"

echo 'get log of agent (?)'
curl -X GET "http://localhost:10050/message/log"

echo 'get block interval (seconds)'
curl -X GET "http://localhost:10050/message/blockInterval"

echo 'get latest blockNumber'
curl -X GET "http://localhost:10050/message/blockNumber"

echo 'get test result (get block TPS) -> 1 node only'
curl -X GET "http://localhost:10050/message/result"

echo 'get test tx result (check tx receipt)'
curl -X GET "http://localhost:10050/message/verify"

echo 'get txpool'
curl -X GET "http://localhost:10050/message/txpool"

echo 'use besu api (https://besu.hyperledger.org/public-networks/reference/api)'
curl -X GET "http://localhost:10050/besu/{{method}}/{{decodeURIComponent(params)}}"
# params: decodeURIComponent(JSON.stringify(['0x5',true]))
# curl -X GET "http://localhost:10050/besu/eth_getBlockByNumber/%5B%220x5%22%2Ctrue%5D"

echo 'exit'
curl -X GET "http://localhost:10050/exit"
```

# rpc to workerNode via controllerNode (use 'send' API)

## workerNode common
```
echo 'deploy smart contract'
curl -X POST "http://localhost:10050/send/deploy"

echo 'latestTxReceipt'
curl -X GET "http://localhost:10050/send/latestTxReceipt"
```

##############################################
## erc20 (erc20perf) workerNode
```
echo 'prepare (deposit token for test)'
curl -X POST "http://localhost:10050/send/prepare"

echo 'transfer'
curl -X POST "http://localhost:10050/send/transfer"

echo '** transfer test using jmeter **'
curl -X POST "http://localhost:10060/transfer"

echo 'get test accounts info' 
curl -X GET "http://localhost:10050/send/accounts"

echo 'get account balance info' 
curl -X GET "http://localhost:10050/send/balanceOf/{{address}}"
```

##############################################
## sto (+erc20) workerNode
```
echo 'prepare each node (deposit token for test)'
curl -X POST "http://localhost:10050/send/prepareEachNode"

echo '** issue test using jmeter **'
curl -X POST "http://localhost:10060/issue"
```

## docu workerNode
```
echo 'create document'
curl -X POST "http://localhost:10050/send/createDocument"

echo '** create document test using jmeter **'
curl -X POST "http://localhost:10060/createDocument"

echo 'get documents (latest) - 모든 test account에 대해 createDocument 작업을 수행한 이후에 가능'
curl -X GET "http://localhost:10050/send/getDocuments"

echo 'get document form docId'
curl -X GET "http://localhost:10050/send/getDocument/{{0x000...}}"
```

## native workerNode
```
echo 'initialize target blockNumber(0)'
curl -X POST "http://localhost:10050/send/initBlockNumber"

echo '** trace_block API test using jmeter **'
curl -X POST "http://localhost:10060/traceBlock"

echo '** trace_replayBlockTransactions API test using jmeter **'
curl -X POST "http://localhost:10060/traceReplayBlockTransactions"

echo 'get all trace_block (from 0 to latest)' - 속도느림
curl -X POST "http://localhost:10060/traceBlocks"
```