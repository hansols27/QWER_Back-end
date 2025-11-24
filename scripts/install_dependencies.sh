#!/bin/bash
PROJECT_PATH=/root/QWER_Back-end

echo "> Node.js 의존성 설치 시작"
cd $PROJECT_PATH

# root 권한에서 npm install 시 문제가 발생하지 않도록 --unsafe-perm 사용
npm install --unsafe-perm

echo "> 의존성 설치 완료."