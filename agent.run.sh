#!/bin/bash

echo 'trying ... stop agent'
curl -X GET "http://localhost:10050/exit"
sleep 1

cd multiAgent

echo '\nstart agent'
#node controllerNode.js true
nohup node controllerNode.js true true > ../controller.log 2>&1 &
