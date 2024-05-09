
# How to add your new testcase

1. Smart Contract 추가 (컴파일 결과물도 같이 추가 할것)
```
# contracts 폴더에 compile된 결과물 추가 필요
solc SimpleToken.sol --bin --abi --optimize --overwrite -o .
# solcjs SimpleToken.sol --bin --abi --optimize --overwrite -o .
# truffle/hardhat의 compile 결과물(json)도 사용 가능
```

2. Test Case 생성
- testname으로 지정한 값에 의해 폴더명과 스크립트 파일명이 정해짐
```
cd utils
# test case 생성 스크립트 실행
node  2.makeTestCase.js  testcase_name  compiled_smart_contract_filename(json or abi)
# webpage에 자동 연계를 위해서는 testcase_name이 erc20, docu 혹은 sto로 시작해야 함 (아니면 test-gh-pages의 코드 수정 필요)
# ex) 생성할 테스트케이스 명이 erc1400이고, 참조할 스마트컨트랙트의 abi 정보가 있는 파일이 stoWithWhitelist.json 혹은 stoWithWhitelist.abi인 경우
#    node makeTestCase.js erc1400 stoWithWhitelist 

# test case 생성 결과 확인 (혹은 기존 테스트 케이스 폴더를 복제 후 수정해도 됨)
# cd ../testcase/{{testname}}
# test.{{testname}}.js 
# workerNode.{{testname}}.js
```

3. 생성 후 추가 작업
- 주석 처리된 부분을 확인 후, 추가 및 수정 필요함
- deploy의 constructor 함수의 parameters 입력 형식 확인 및 값 추가
- prepare/prepareEachNode 함수/API 확인 및 수정
- 스마트 컨트랙트에 구현된 함수별로 api 등이 자동 추가되었으나 일부 조건에 맞는 함수에 대해서만 생성됨. 
- transfer 함수 등 테스트 대상 함수(API)에 대한 검토 및 수정
