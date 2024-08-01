# ethereum-perf-agent
Back-end for performance testing of private Ethereum

## Quick start (Local)
- back-end (multiAgent 폴더) : controller (10050 포트), testcase용 agent (10060 포트)
```
# nodejs 사전 설치 필요 (v12 버전 이상)
git clone https://github.com/shmin81/perf-ethereum-agent.git
cd perf-ethereum-agent
npm install 
# beck-end를 실행함
bash agent.run.sh
```
- front-end (test-gh-pages 폴더) : 웹페이지 (10010 포트)
```
# nodejs 사전 설치 필요 (v12 버전 이상)
git clone https://github.com/shmin81/perf-ethereum-web.git
cd perf-ethereum-web
npm install 
# front-end를 실행함
npm run start
# 인터넷 브라우저에서 http://localhost:10010/ 접속
```

### Getting started (using jmeter worker node)

```
git clone https://github.com/shmin81/perf-ethereum-agent.git
cd perf-ethereum-agent

# 라이브러리 설치작업 수행
npm install

# 설정 파일 확인 및 수정
cd configs
# config.json : 설정 파일 (파일이 없다면, 초기 실행시에 default.config.json 파일이 복사됨.)
# account_{numbers}.json : 테스트 계정 목록 (sender와 receiver의 계정 셋으로 구성된 목록임)
# endpoints.json : 접속할 besu node의 RPC 주소 (http only) 

# ./multiAgent/controllerNode.js 실행 (10050 포트번호를 사용)
sh agent.run.sh
# 실행로그 확인
tail -f controller.log
```

- 사용법: [usage.agent.md](./usage.agent.md) 파일 참조
