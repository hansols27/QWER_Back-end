#!/bin/bash
SERVICE_NAME=qwerfansite-api.service
# CodeDeploy destination 경로와 동일해야 합니다.
DEPLOY_DIR="/root/QWER_Back-end" 

echo "> 기존 Systemd 서비스 중지 시작: $SERVICE_NAME"

# 1. 서비스 중지 로직
if systemctl is-active $SERVICE_NAME; then
    systemctl stop $SERVICE_NAME
    echo "서비스 중지 완료."
else
    echo "서비스가 실행 중이 아닙니다. 중지 스킵."
fi

# 2. 🔥 기존 배포 디렉토리 삭제 로직 추가 (필수)
echo "> 이전 배포 디렉토리 삭제 시작: $DEPLOY_DIR"

if [ -d "$DEPLOY_DIR" ]; then
    # -r: 재귀적, -f: 강제 삭제
    sudo rm -rf "$DEPLOY_DIR"
    echo "이전 배포 디렉토리 내용 전체 삭제 완료."
else
    echo "배포 디렉토리 ($DEPLOY_DIR)가 존재하지 않아 삭제를 건너뜁니다."
fi

# 3. CodeDeploy의 파일 복사(Install) 단계를 위해 빈 디렉토리 생성 (선택)
# CodeDeploy가 복사할 때 디렉토리가 없으면 자동으로 생성하지만, 명시적으로 생성해 주는 것이 좋습니다.
sudo mkdir -p "$DEPLOY_DIR" 
echo "새 배포 디렉토리 ($DEPLOY_DIR) 생성 완료."