#!/bin/bash
SERVICE_NAME=qwerfansite-api.service
DEPLOY_DIR="/root/QWER_Back-end"

echo "> 기존 Systemd 서비스 중지 시작: $SERVICE_NAME"

# 1. 서비스 중지
if systemctl is-active --quiet $SERVICE_NAME; then
    sudo systemctl stop $SERVICE_NAME
    echo "서비스 중지 완료."
else
    echo "서비스가 실행 중이 아닙니다. 중지 스킵."
fi

# 2. 기존 파일 정리 (선택 사항)
# .env 파일을 보존하면서 나머지 파일들만 삭제하고 싶을 경우 아래처럼 사용하세요.
echo "> 이전 배포 파일 정리 (환경 변수 파일 제외)"
if [ -d "$DEPLOY_DIR" ]; then
    # .env 파일을 제외한 나머지 파일/폴더 삭제
    find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +
    echo "기존 파일 정리 완료 (.env 제외)"
else
    sudo mkdir -p "$DEPLOY_DIR"
    echo "배포 디렉토리 생성 완료."
fi
