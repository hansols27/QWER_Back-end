#!/bin/bash
PROJECT_PATH=/root/QWER_Back-end

echo "> 배포 디렉토리로 이동: $PROJECT_PATH"
cd $PROJECT_PATH

# 1. 기존 node_modules 삭제 (충돌 방지)
rm -rf node_modules

# 2. 의존성 설치 (production용만 설치하면 더 빠릅니다)
echo "> Node.js 의존성 설치 시작"
npm install --production --unsafe-perm

echo "> 의존성 설치 완료."
