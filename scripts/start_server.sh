#!/bin/bash
SERVICE_NAME=qwerfansite-api.service

echo "> 서비스 설정 갱신 (daemon-reload)"
sudo systemctl daemon-reload

echo "> 서비스 활성화 (enable)"
sudo systemctl enable $SERVICE_NAME

echo "> 서비스 재시작 시작: $SERVICE_NAME"
sudo systemctl restart $SERVICE_NAME

# 서비스 상태 확인 로그 남기기
sleep 2
if [ "$(systemctl is-active $SERVICE_NAME)" = "active" ]; then
    echo "> 서비스가 성공적으로 시작되었습니다."
else
    echo "> 서비스 시작에 실패했습니다. 로그를 확인하세요."
    journalctl -u $SERVICE_NAME -n 50
    exit 1
fi
